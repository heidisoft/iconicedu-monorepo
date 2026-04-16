import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChatImageViewer } from './chat-image-viewer';
import { lightColors as LIGHT } from '@/lib/theme';

const mockCreateSignedUrl = jest.fn();
const mockShareAsync = jest.fn();
const mockSharingAvailable = jest.fn();
const mockDownloadFileAsync = jest.fn();
const mockPickDirectoryAsync = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockSharingAvailable(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('expo-file-system', () => {
  class MockDirectory {
    static pickDirectoryAsync = (...args: unknown[]) => mockPickDirectoryAsync(...args);

    exists = false;
    uri: string;
    create = jest.fn(() => {
      this.exists = true;
    });

    constructor(...parts: string[]) {
      this.uri = parts.join('/');
    }
  }

  class MockFile {
    static downloadFileAsync = (...args: unknown[]) => mockDownloadFileAsync(...args);

    exists = false;
    uri: string;
    delete = jest.fn(() => {
      this.exists = false;
    });
    copy = jest.fn();

    constructor(parent: { uri?: string } | string, name?: string) {
      const parentUri =
        typeof parent === 'string' ? parent : (parent.uri ?? 'file:///tmp');
      this.uri = name ? `${parentUri}/${name}` : parentUri;
    }
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      cache: 'file:///cache',
      document: 'file:///documents',
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64' },
}));

describe('ChatImageViewer save flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: null });
    mockSharingAvailable.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockPickDirectoryAsync.mockResolvedValue({ uri: 'file:///picked' });
    mockDownloadFileAsync.mockImplementation((_url, target) =>
      Promise.resolve({
        uri: target.uri,
        exists: true,
        delete: jest.fn(),
        copy: jest.fn(),
      }),
    );
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saves the image into a user-selected directory instead of the media library', async () => {
    const screen = render(
      <ChatImageViewer
        visible
        items={[
          {
            key: 'img-1',
            originalUrl: 'https://example.com/image.jpg',
            filename: 'image.jpg',
            mimeType: 'image/jpeg',
          },
        ]}
        initialIndex={0}
        colors={LIGHT}
        onClose={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Save image'));

    await waitFor(() => {
      expect(mockPickDirectoryAsync).toHaveBeenCalled();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Saved',
      'Image saved to the selected folder.',
    );
  });
});
