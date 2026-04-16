import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { ChatPdfViewer } from './chat-pdf-viewer';
import { lightColors as LIGHT } from '@/lib/theme';

const mockCreateSignedUrl = jest.fn();
const mockShareAsync = jest.fn();
const mockSharingAvailable = jest.fn();
const mockDownloadFileAsync = jest.fn();
const mockOpenBrowserAsync = jest.fn();

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    appOwnership: null,
    executionEnvironment: 'bare',
  },
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
  WebBrowserPresentationStyle: {
    PAGE_SHEET: 'pageSheet',
  },
}));

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
    static pickDirectoryAsync = jest.fn();

    exists = false;
    uri: string;

    constructor(...parts: string[]) {
      this.uri = parts.join('/');
    }

    create = jest.fn(() => {
      this.exists = true;
    });
  }

  class MockFile {
    exists = false;
    uri: string;

    constructor(parent: { uri?: string } | string, name?: string) {
      const parentUri =
        typeof parent === 'string' ? parent : (parent.uri ?? 'file:///tmp');
      this.uri = name ? `${parentUri}/${name}` : parentUri;
    }

    delete = jest.fn(() => {
      this.exists = false;
    });

    copy = jest.fn();

    static downloadFileAsync = (...args: unknown[]) => mockDownloadFileAsync(...args);
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      cache: 'file:///cache',
    },
  };
});

describe('ChatPdfViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NativeModules.RNPDFPdfView = {};
    Constants.executionEnvironment = 'bare';
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example.com/files/worksheet.pdf' },
      error: null,
    });
    mockDownloadFileAsync.mockResolvedValue({
      uri: 'file:///cache/worksheet.pdf',
      exists: true,
      delete: jest.fn(),
      copy: jest.fn(),
    });
    mockSharingAvailable.mockResolvedValue(true);
    mockOpenBrowserAsync.mockResolvedValue(undefined);
  });

  it('shows a loading state and disables share/save while the PDF is preparing', () => {
    let resolveDownload: ((value: { uri: string; exists: boolean }) => void) | null =
      null;
    mockDownloadFileAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        }),
    );

    render(
      <ChatPdfViewer
        visible
        url="https://example.com/worksheet.pdf"
        storagePath="org-1/channel-1/worksheet.pdf"
        filename="Worksheet.pdf"
        colors={LIGHT}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Opening PDF preview…')).toBeTruthy();
    expect(screen.getByLabelText('Share PDF').props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.getByLabelText('Save PDF').props.accessibilityState.disabled).toBe(
      true,
    );

    resolveDownload?.({ uri: 'file:///cache/worksheet.pdf', exists: true });
  });

  it('renders an error state with retry when the signed URL cannot be resolved', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: new Error('signed url failed'),
    });

    render(
      <ChatPdfViewer
        visible
        url="https://example.com/worksheet.pdf"
        storagePath="org-1/channel-1/worksheet.pdf"
        filename="Worksheet.pdf"
        colors={LIGHT}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load PDF')).toBeTruthy();
    });
    expect(screen.getByText('signed url failed')).toBeTruthy();
    expect(screen.getByLabelText('Retry PDF preview')).toBeTruthy();
  });

  it('renders the in-app PDF once the local file is ready', async () => {
    render(
      <ChatPdfViewer
        visible
        url="https://example.com/worksheet.pdf"
        storagePath="org-1/channel-1/worksheet.pdf"
        filename="Worksheet.pdf"
        colors={LIGHT}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-pdf-view')).toBeTruthy();
    });
    expect(screen.getByText('Worksheet.pdf')).toBeTruthy();
  });

  it('falls back to the browser flow when the native PDF module is unavailable', async () => {
    Constants.executionEnvironment = 'storeClient';

    const onClose = jest.fn();
    render(
      <ChatPdfViewer
        visible
        url="https://example.com/worksheet.pdf"
        storagePath="org-1/channel-1/worksheet.pdf"
        filename="Worksheet.pdf"
        colors={LIGHT}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
        'https://signed.example.com/files/worksheet.pdf',
        expect.objectContaining({ presentationStyle: 'pageSheet' }),
      );
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
