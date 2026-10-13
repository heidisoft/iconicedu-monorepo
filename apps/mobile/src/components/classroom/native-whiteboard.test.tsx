import React from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { capabilityGet, capabilityPost } from '@/lib/api/http-client';
import { NativeWhiteboard } from './native-whiteboard';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: React.forwardRef(function MockWebView(
      props: Record<string, unknown>,
      ref: unknown,
    ) {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
      return React.createElement(View, { ...props, testID: 'drawing-canvas' });
    }),
  };
});
jest.mock('./canvas/canvas.generated', () => ({ classroomCanvasHtml: '<html></html>' }), {
  virtual: true,
});
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { card: 'white', text: 'black' }, isDark: false }),
}));
jest.mock('@/lib/api/http-client', () => ({
  capabilityGet: jest.fn(),
  capabilityPost: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
const snapshot: WhiteboardSnapshotVM = {
  id: 'board',
  revision: 1,
  role: 'teacher',
  presence: [],
  document: {
    schemaVersion: 1,
    studentEditing: false,
    pages: [{ id: 'page', title: 'Class', elements: [] }],
  },
};
const element = {
  id: 'stroke',
  version: 1,
  nonce: 1,
  deleted: false,
  data: { type: 'freedraw' },
};
describe('native collaborative whiteboard recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(capabilityGet).mockResolvedValue(snapshot);
    jest.mocked(capabilityPost).mockResolvedValue({ ...snapshot, revision: 2 });
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });
  it('keeps capabilities out of the WebView and saves native drawing changes through the API', async () => {
    const screen = render(<NativeWhiteboard token="private-capability" />);
    await waitFor(() => expect(capabilityGet).toHaveBeenCalled());
    fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
      nativeEvent: { data: JSON.stringify({ type: 'elements', elements: [element] }) },
    });
    await waitFor(() =>
      expect(capabilityPost).toHaveBeenCalledWith(
        '/whiteboards/current/operations',
        'private-capability',
        expect.objectContaining({
          type: 'elements',
          pageId: 'page',
          elements: [element],
        }),
      ),
    );
    expect(screen.getByTestId('drawing-canvas').props.source.html).not.toContain(
      'private-capability',
    );
    expect(AsyncStorage.setItem.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(capabilityPost).mock.invocationCallOrder[0],
    );
  });
  it('sends canvas laser movement through native transport without saving drawing elements', async () => {
    const screen = render(<NativeWhiteboard token="synthetic-capability" />);
    await act(async () => {});
    fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
      nativeEvent: { data: '{"type":"ready"}' },
    });
    await act(async () => {});
    fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
      nativeEvent: { data: '{"type":"laser","x":100,"y":200,"button":"down"}' },
    });
    await waitFor(() =>
      expect(capabilityPost).toHaveBeenCalledWith(
        '/whiteboards/current/laser',
        'synthetic-capability',
        [
          expect.objectContaining({
            x: 100,
            y: 200,
            button: 'down',
            id: expect.any(String),
          }),
        ],
      ),
    );
    expect(
      jest.mocked(capabilityPost).mock.calls.every((call) => call[0].endsWith('/laser')),
    ).toBe(true);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
  it('exports canvas PNGs through the native share sheet without exposing capabilities', async () => {
    const screen = render(<NativeWhiteboard token="synthetic" />);
    fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'export',
          dataUrl: 'data:image/png;base64,aGVsbG8=',
        }),
      },
    });
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/cache\/classroom-.*\.png$/),
      'aGVsbG8=',
      { encoding: 'base64' },
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ mimeType: 'image/png' }),
    );
  });
  it('rejects non-image export messages from the canvas', async () => {
    const screen = render(<NativeWhiteboard token="synthetic" />);
    await act(async () => {});
    await act(async () => {
      fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
        nativeEvent: {
          data: JSON.stringify({
            type: 'export',
            dataUrl: 'data:text/html;base64,aGVsbG8=',
          }),
        },
      });
    });
    await waitFor(() => expect(screen.getByText('Retry saving')).toBeTruthy());
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
  it('retries the same idempotency key after a lost save response', async () => {
    jest
      .mocked(capabilityPost)
      .mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValue({ ...snapshot, revision: 2 });
    const screen = render(<NativeWhiteboard token="synthetic" />);
    await waitFor(() => expect(capabilityGet).toHaveBeenCalled());
    fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
      nativeEvent: { data: JSON.stringify({ type: 'elements', elements: [element] }) },
    });
    await waitFor(() => expect(screen.getByText('Retry saving')).toBeTruthy());
    const first = jest.mocked(capabilityPost).mock.calls[0][2];
    fireEvent.press(screen.getByText('Retry saving'));
    await waitFor(() => expect(capabilityPost).toHaveBeenCalledTimes(2));
    expect(jest.mocked(capabilityPost).mock.calls[1][2]).toEqual(first);
  });
  it('recovers locally queued operations after reopening the same authorized board', async () => {
    const operation = {
      id: 'synthetic-operation',
      type: 'elements',
      pageId: 'page',
      elements: [element],
    };
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValue(
        JSON.stringify({ savedAt: Date.now(), operations: [operation] }),
      );
    render(<NativeWhiteboard token="renewed-capability" />);
    await waitFor(() =>
      expect(capabilityPost).toHaveBeenCalledWith(
        '/whiteboards/current/operations',
        'renewed-capability',
        operation,
      ),
    );
  });
  it('does not show teacher controls to a student and observes remote presentation', async () => {
    jest
      .mocked(capabilityGet)
      .mockResolvedValue({ ...snapshot, role: 'student', presentationActive: true });
    const onPresentation = jest.fn();
    const screen = render(
      <NativeWhiteboard token="synthetic" onPresentation={onPresentation} />,
    );
    await waitFor(() => expect(onPresentation).toHaveBeenCalledWith(true));
    expect(screen.queryByText('Allow student editing')).toBeNull();
    expect(screen.queryByText('Clear board')).toBeNull();
  });
  it('marks in-progress strokes as pending before the batch is committed', async () => {
    const onPending = jest.fn();
    const screen = render(<NativeWhiteboard token="synthetic" onPending={onPending} />);
    await act(async () => {});
    fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
      nativeEvent: { data: '{"type":"drawing"}' },
    });
    expect(onPending).toHaveBeenCalledWith(true);
  });
});
