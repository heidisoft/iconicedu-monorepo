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
const mockInjectJavaScript = jest.fn();
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: React.forwardRef(function MockWebView(
      props: Record<string, unknown>,
      ref: unknown,
    ) {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript }));
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
    await act(async () => {});
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
    fireEvent.press(screen.getByLabelText('More whiteboard actions'));
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
    fireEvent.press(screen.getByLabelText('More whiteboard actions'));
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

it('fills the board without a heading and exposes options through floating controls', async () => {
  jest.mocked(capabilityGet).mockResolvedValue(snapshot);
  const onClose = jest.fn();
  const screen = render(<NativeWhiteboard token="synthetic" onClose={onClose} />);
  await waitFor(() => expect(screen.getByTestId('drawing-canvas')).toBeTruthy());
  expect(screen.queryByText('Class whiteboard')).toBeNull();
  expect(screen.queryByText('Allow student editing')).toBeNull();
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  expect(screen.getByText('Allow student editing')).toBeTruthy();
  expect(screen.getByLabelText('Library')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close More whiteboard actions'));
  expect(screen.queryByText('Allow student editing')).toBeNull();
  expect(screen.queryByLabelText('Return to video')).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
});

it('routes native library and export options to the canvas without sharing capabilities', async () => {
  jest.mocked(capabilityGet).mockResolvedValue(snapshot);
  const screen = render(<NativeWhiteboard token="synthetic-capability" />);
  await act(async () => {});
  fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('Library'));
  expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
    'window.classroomCommand?.({"type":"library"}); true;',
  );
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  fireEvent.press(screen.getByText('Export whiteboard image'));
  expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
    'window.classroomAction?.("export"); true;',
  );
});

it('explains view-only permissions without showing teacher editing controls', async () => {
  jest.mocked(capabilityGet).mockResolvedValue({
    ...snapshot,
    role: 'student',
    document: { ...snapshot.document, studentEditing: false },
  });
  const screen = render(<NativeWhiteboard token="synthetic" embedded />);
  await waitFor(() => expect(screen.getByTestId('drawing-canvas')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  expect(screen.getByText('View only. Ask the host to allow editing.')).toBeTruthy();
  expect(screen.queryByText('Allow student editing')).toBeNull();
});

it.each(['drawing', 'retrying', 'saving'] as const)(
  'observes a remote stop while local edits are %s',
  async (phase) => {
    jest.useFakeTimers();
    let value = {
      ...snapshot,
      presentationActive: true,
      document: {
        ...snapshot.document,
        presentation: {
          presentationId: 'present-1',
          presenterId: 'peer',
          sessionId: 'session',
        },
      },
    };
    let finishSave: (value: typeof snapshot) => void = () => {};
    const repository = {
      load: jest.fn(async () => value),
      save:
        phase === 'saving'
          ? jest.fn(
              () =>
                new Promise<typeof snapshot>((resolve) => {
                  finishSave = resolve;
                }),
            )
          : jest.fn().mockRejectedValue(new Error('offline')),
    };
    const onPresentation = jest.fn();
    const screen = render(
      <NativeWhiteboard
        token="synthetic"
        repository={repository}
        onPresentation={onPresentation}
      />,
    );
    try {
      await act(async () => {});
      expect(onPresentation).toHaveBeenLastCalledWith(true);
      fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
        nativeEvent: {
          data: JSON.stringify(
            phase === 'drawing'
              ? { type: 'drawing' }
              : { type: 'elements', elements: [element] },
          ),
        },
      });
      await act(async () => {});
      value = { ...value, revision: 2, presentationActive: false };
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      expect(onPresentation).toHaveBeenLastCalledWith(false);
      expect(repository.load).toHaveBeenCalledTimes(2);
      if (phase === 'retrying')
        expect(screen.getByRole('alert')).toHaveTextContent(
          /Changes are waiting to save\. Keep this board open and tap Retry\./,
        );
      await act(async () =>
        finishSave({ ...value, revision: 1, presentationActive: true }),
      );
      expect(onPresentation).toHaveBeenLastCalledWith(false);
    } finally {
      screen.unmount();
      jest.useRealTimers();
    }
  },
);

it('offers tutor following by default and participant or free navigation choices', async () => {
  const repository = {
    load: jest.fn().mockResolvedValue({
      ...snapshot,
      role: 'student',
      actorId: 'self',
      presence: [
        { id: 'tutor', name: 'Tutor', role: 'teacher' },
        { id: 'peer', name: 'Peer', role: 'student' },
      ],
    }),
    save: jest.fn(),
    viewports: jest.fn().mockResolvedValue([
      {
        actorId: 'tutor',
        viewport: { centerX: 30, centerY: 40, zoom: 2 },
        expiresAt: Date.now() + 10000,
      },
    ]),
    publishViewport: jest.fn().mockResolvedValue({}),
  };
  const screen = render(<NativeWhiteboard token="token" repository={repository} />);
  await act(async () => {});
  fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
    nativeEvent: { data: JSON.stringify({ type: 'ready' }) },
  });
  await act(async () => {});
  expect(mockInjectJavaScript).toHaveBeenCalledWith(
    expect.stringContaining(
      'classroomViewport?.({"centerX":30,"centerY":40,"zoom":2}, "tutor:1")',
    ),
  );
  expect(screen.queryByLabelText('Follow viewport')).toBeNull();
  fireEvent.press(screen.getByLabelText('Focus tutor'));
  await act(async () => {});
  expect(repository.viewports).toHaveBeenCalledTimes(2);
});

it('keeps save status and participant presence inside More', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(capabilityGet).mockResolvedValue({
    ...snapshot,
    presence: [{ id: 'teacher', name: 'Teacher Person', role: 'teacher' }],
  });
  const screen = render(<NativeWhiteboard token="fixture" />);
  await act(async () => {});
  expect(screen.queryByText('Saved')).toBeNull();
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  expect(screen.getByText('Saved')).toBeTruthy();
  expect(screen.getByLabelText('Whiteboard participants: Teacher Person')).toBeTruthy();
  expect(screen.getByText('TP')).toBeTruthy();
});
it('exports SVG through a separate canvas action', async () => {
  jest.mocked(capabilityGet).mockResolvedValue(snapshot);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  const screen = render(<NativeWhiteboard token="fixture" />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  fireEvent.press(screen.getByLabelText('Export whiteboard SVG'));
  expect(mockInjectJavaScript).toHaveBeenCalledWith(
    'window.classroomAction?.("export-svg"); true;',
  );
  await act(async () =>
    fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'export-svg',
          svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
        }),
      },
    }),
  );
  await waitFor(() =>
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/\.svg$/),
      expect.objectContaining({ mimeType: 'image/svg+xml' }),
    ),
  );
});
it('exports queued edits and discards them only after confirmation and successful reload', async () => {
  jest.mocked(capabilityGet).mockResolvedValue(snapshot);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(capabilityPost).mockRejectedValue(new Error('offline'));
  const { Alert } = require('react-native');
  const alert = jest.spyOn(Alert, 'alert');
  const screen = render(<NativeWhiteboard token="fixture" />);
  await act(async () => {});
  fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
    nativeEvent: { data: JSON.stringify({ type: 'elements', elements: [element] }) },
  });
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  await waitFor(() => expect(screen.getByText('Unsaved · retrying')).toBeTruthy());
  await act(async () => fireEvent.press(screen.getByLabelText('Download unsaved edits')));
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
    expect.stringMatching(/\.json$/),
    expect.stringContaining('"type":"elements"'),
  );
  fireEvent.press(screen.getByLabelText('Discard unsaved edits'));
  expect(screen.getByText('Unsaved · retrying')).toBeTruthy();
  const buttons = alert.mock.calls.at(-1)?.[2];
  await act(async () =>
    buttons?.find((button: { text: string }) => button.text === 'Discard')?.onPress?.(),
  );
  expect(screen.queryByText('Unsaved · retrying')).toBeNull();
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('classroom-drawing:board:teacher');
  alert.mockRestore();
});
it('toggles tutor following directly from the toolbar without opening More', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(capabilityGet).mockResolvedValue(snapshot);
  const screen = render(<NativeWhiteboard token="fixture" />);
  await act(async () => {});
  fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  expect(
    screen.getByLabelText('Focus tutor').props.accessibilityState.selected,
  ).toBeUndefined();
  fireEvent.press(screen.getByLabelText('Focus tutor'));
  expect(
    screen.getByLabelText('Focus tutor').props.accessibilityState.selected,
  ).toBeUndefined();
  expect(screen.queryByLabelText('Close More whiteboard actions')).toBeNull();
  fireEvent.press(screen.getByLabelText('Focus tutor'));
  expect(
    screen.getByLabelText('Focus tutor').props.accessibilityState.selected,
  ).toBeUndefined();
});

it('does not offer tutors a stop action for another participant board', async () => {
  jest.mocked(capabilityGet).mockResolvedValue({
    ...snapshot,
    role: 'teacher',
    actorId: 'tutor',
    presentationActive: true,
    document: {
      ...snapshot.document,
      presentation: {
        presenterId: 'student',
        presentationId: 'share',
        sessionId: 'session',
      },
    },
  });
  const screen = render(<NativeWhiteboard token="synthetic" />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('More whiteboard actions'));
  expect(screen.queryByText('Stop sharing for everyone')).toBeNull();
  expect(screen.queryByText('Present board')).toBeNull();
});

it('keeps the WebView source stable while drawing updates toolbar state', async () => {
  jest.mocked(capabilityGet).mockResolvedValue(snapshot);
  const screen = render(<NativeWhiteboard token="synthetic" />);
  await waitFor(() => expect(screen.getByTestId('drawing-canvas')).toBeTruthy());
  const source = screen.getByTestId('drawing-canvas').props.source;
  fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
    nativeEvent: { data: JSON.stringify({ type: 'ready' }) },
  });
  fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
    nativeEvent: {
      data: JSON.stringify({
        type: 'tool-state',
        tool: 'freedraw',
        color: '#e03131',
        width: 2,
        fill: 'transparent',
      }),
    },
  });
  expect(screen.getByTestId('drawing-canvas').props.source).toBe(source);
  fireEvent.press(screen.getByLabelText('Close drawing styles'));
  fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
    nativeEvent: {
      data: JSON.stringify({
        type: 'tool-state',
        tool: 'freedraw',
        color: '#e03131',
        width: 3,
        fill: 'transparent',
      }),
    },
  });
  expect(screen.queryByLabelText('Stroke color #e03131')).toBeNull();
  fireEvent.press(screen.getByLabelText('Pen'));
  expect(screen.getByLabelText('Stroke color #e03131')).toBeTruthy();
  expect(screen.getByTestId('drawing-canvas').props.source).toBe(source);
});

it('offers expand and collapse using the fullscreen control without an on-canvas hide action', async () => {
  jest.mocked(capabilityGet).mockResolvedValue(snapshot);
  const onExpand = jest.fn();
  const props = { token: 'synthetic', onExpand };
  const screen = render(<NativeWhiteboard {...props} />);
  await waitFor(() => expect(screen.getByTestId('drawing-canvas')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Expand whiteboard to full screen'));
  expect(onExpand).toHaveBeenCalledTimes(1);
  screen.rerender(<NativeWhiteboard {...props} expanded />);
  fireEvent.press(screen.getByLabelText('Collapse whiteboard'));
  expect(onExpand).toHaveBeenCalledTimes(2);
  expect(screen.queryByLabelText('Return to video')).toBeNull();
});

it('offers canvas zoom actions without opening the drawing toolbar menus', async () => {
  jest.mocked(capabilityGet).mockResolvedValue(snapshot);
  const screen = render(<NativeWhiteboard token="synthetic" />);
  await waitFor(() => expect(screen.getByTestId('drawing-canvas')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Zoom in'));
  expect(mockInjectJavaScript).not.toHaveBeenCalledWith(
    'window.classroomCommand?.({"type":"zoom","delta":0.1}); true;',
  );
  fireEvent(screen.getByTestId('drawing-canvas'), 'message', {
    nativeEvent: { data: JSON.stringify({ type: 'ready' }) },
  });
  for (const [label, command] of [
    ['Fit content', { type: 'fit' }],
    ['Zoom in', { type: 'zoom', delta: 0.1 }],
    ['Zoom out', { type: 'zoom', delta: -0.1 }],
    ['Reset zoom to 100%', { type: 'reset-zoom' }],
  ] as const) {
    fireEvent.press(screen.getByLabelText(label));
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      `window.classroomCommand?.(${JSON.stringify(command)}); true;`,
    );
  }
});
