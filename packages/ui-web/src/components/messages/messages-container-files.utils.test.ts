import { describe, expect, it } from 'vitest';

import {
  createChannelFileItem,
  createChannelFileItems,
  formatChannelFileUploadedDate,
  getChannelFileVisualKind,
  getChannelFileVisualTone,
} from './messages-container-files.utils';

describe('createChannelFileItem', () => {
  it('maps an image message into a files-tab item', () => {
    const item = createChannelFileItem('channel-1', {
      ids: { id: 'message-1', orgId: 'org-1' },
      core: {
        type: 'image',
        createdAt: '2026-02-23T10:00:00.000Z',
        visibility: { type: 'all' },
        sender: { ids: { id: 'profile-1' } },
      },
      social: { reactions: [] },
      attachment: {
        type: 'image',
        url: 'https://example.com/photo.png',
        storagePath: 'org-1/channel-1/images/profile-1/photo.png',
        name: 'photo.png',
      },
    } as never);

    expect(item).toEqual(
      expect.objectContaining({
        messageId: 'message-1',
        name: 'photo.png',
        mimeType: 'image/*',
        storagePath: 'org-1/channel-1/images/profile-1/photo.png',
      }),
    );
  });

  it('maps an audio recording into a files-tab item using the storage file name', () => {
    const item = createChannelFileItem('channel-1', {
      ids: { id: 'message-2', orgId: 'org-1' },
      core: {
        type: 'audio-recording',
        createdAt: '2026-02-24T10:00:00.000Z',
        visibility: { type: 'all' },
        sender: { ids: { id: 'profile-2' } },
      },
      social: { reactions: [] },
      audio: {
        url: 'https://example.com/voice.webm',
        storagePath: 'org-1/channel-1/audio/profile-2/voice.webm',
        durationSeconds: 9,
        fileSize: 55,
        mimeType: 'audio/webm',
      },
    } as never);

    expect(item).toEqual(
      expect.objectContaining({
        messageId: 'message-2',
        name: 'voice.webm',
        mimeType: 'audio/webm',
        size: 55,
      }),
    );
  });

  it('expands grouped file attachments into separate files-tab items', () => {
    const items = createChannelFileItems('channel-1', {
      ids: { id: 'message-3', orgId: 'org-1' },
      core: {
        type: 'file',
        createdAt: '2026-02-24T10:00:00.000Z',
        visibility: { type: 'all' },
        sender: { ids: { id: 'profile-3' } },
      },
      social: { reactions: [] },
      attachment: {
        type: 'file',
        url: 'https://example.com/brief.pdf',
        storagePath: 'org-1/channel-1/files/profile-3/brief.pdf',
        name: 'brief.pdf',
      },
      attachments: [
        {
          type: 'file',
          url: 'https://example.com/brief.pdf',
          storagePath: 'org-1/channel-1/files/profile-3/brief.pdf',
          name: 'brief.pdf',
        },
        {
          type: 'file',
          url: 'https://example.com/notes.pdf',
          storagePath: 'org-1/channel-1/files/profile-3/notes.pdf',
          name: 'notes.pdf',
        },
      ],
    } as never);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.name)).toEqual(['brief.pdf', 'notes.pdf']);
  });

  it('derives a visual kind from mime type and file extension', () => {
    expect(
      getChannelFileVisualKind({ name: 'brief.pdf', mimeType: 'application/pdf' }),
    ).toBe('pdf');
    expect(
      getChannelFileVisualKind({
        name: 'worksheet.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    ).toBe('spreadsheet');
    expect(getChannelFileVisualKind({ name: 'voice.webm', mimeType: 'audio/webm' })).toBe(
      'audio',
    );
    expect(
      getChannelFileVisualKind({ name: 'archive.zip', mimeType: 'application/zip' }),
    ).toBe('archive');
    expect(
      getChannelFileVisualKind({
        name: 'unknown.bin',
        mimeType: 'application/octet-stream',
      }),
    ).toBe('generic');
  });

  it('returns a stable visual tone for file kinds', () => {
    expect(getChannelFileVisualTone('pdf')).toContain('rose');
    expect(getChannelFileVisualTone('spreadsheet')).toContain('lime');
    expect(getChannelFileVisualTone('audio')).toContain('orange');
    expect(getChannelFileVisualTone('generic')).toContain('text-muted-foreground');
  });

  it('formats the uploaded date for files-tab metadata', () => {
    expect(formatChannelFileUploadedDate('2026-02-24T10:00:00.000Z')).toBe(
      'Feb 24, 2026',
    );
  });
});
