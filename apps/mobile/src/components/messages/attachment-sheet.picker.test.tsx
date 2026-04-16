import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AttachmentSheet } from './attachment-sheet';

const mockLaunchImageLibraryAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestMediaLibraryPermissionsAsync(...args),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: class MockFile {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    info() {
      return { size: 128 };
    }
  },
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn(),
}));

jest.mock('@/lib/analytics/report-error', () => ({
  reportMobileObservedError: jest.fn(),
}));

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      pageBg: '#fff',
      border: '#ddd',
      tealBg: '#eef',
      teal: '#008080',
      text: '#111',
      textMuted: '#666',
    },
  }),
}));

describe('AttachmentSheet photo picker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///photo.jpg',
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
          fileSize: 123,
          base64: 'abc123',
        },
      ],
    });
  });

  it('opens the system picker without pre-requesting media library permission', async () => {
    const onAttach = jest.fn();
    const onClose = jest.fn();

    const screen = render(
      <AttachmentSheet visible onClose={onClose} onAttach={onAttach} />,
    );

    fireEvent.press(screen.getByText('Photo Library'));

    await waitFor(() => {
      expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 0.85,
          base64: true,
        }),
      );
    });

    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(onAttach).toHaveBeenCalledWith([
      expect.objectContaining({
        uri: 'file:///photo.jpg',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 123,
        base64: 'abc123',
      }),
    ]);
  });
});
