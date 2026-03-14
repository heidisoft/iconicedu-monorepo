/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildMessageById,
  buildMessagesByChannelId,
} from '@iconicedu/web/lib/messages/builders/message.builder';

const getMessageById = vi.fn();
const buildUserProfileById = vi.fn();
const mapMessageRowToVM = vi.fn();
const buildThreadById = vi.fn();
const getMessageFilesByMessageIds = vi.fn(async () => ({ data: [] }));
const getMessageImagesByMessageIds = vi.fn(async () => ({ data: [] }));
const getMessageAudioRecordingsByMessageIds = vi.fn(async () => ({ data: [] }));
const getMessageLiveSessionStartedByMessageIds = vi.fn(async () => ({ data: [] }));
const getMessageReactionsByMessageIds = vi.fn(async () => ({ data: [] }));
const getMessageReactionCountsByMessageIds = vi.fn(async () => ({ data: [] }));
const getMessageSavesByMessageIds = vi.fn(async () => ({ data: [] }));
const getMessagesByChannelId = vi.fn(async () => ({ data: [] }));
const getProfilesByAccountIds = vi.fn(async () => ({ data: [] }));

vi.mock('@iconicedu/web/lib/messages/queries/messages.query', () => ({
  getMessageById: (...args: unknown[]) => getMessageById(...args),
  getMessagesByChannelId: (...args: unknown[]) => getMessagesByChannelId(...args),
  getMessageTextByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageImagesByMessageIds: (...args: unknown[]) =>
    getMessageImagesByMessageIds(...args),
  getMessageFilesByMessageIds: (...args: unknown[]) =>
    getMessageFilesByMessageIds(...args),
  getMessageDesignFileUpdatesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessagePaymentRemindersByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageEventRemindersByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageFeedbackRequestsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageSessionFeedbackByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageLessonAssignmentsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageProgressUpdatesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageSessionBookingsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageSessionCompletesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageSessionSummariesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageHomeworkSubmissionsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageLinkPreviewsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageAudioRecordingsByMessageIds: (...args: unknown[]) =>
    getMessageAudioRecordingsByMessageIds(...args),
  getMessageLiveSessionStartedByMessageIds: (...args: unknown[]) =>
    getMessageLiveSessionStartedByMessageIds(...args),
  getMessageReactionsByMessageIds: (...args: unknown[]) =>
    getMessageReactionsByMessageIds(...args),
  getMessageReactionCountsByMessageIds: (...args: unknown[]) =>
    getMessageReactionCountsByMessageIds(...args),
  getMessageSavesByMessageIds: (...args: unknown[]) =>
    getMessageSavesByMessageIds(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileById: (...args: unknown[]) => buildUserProfileById(...args),
}));

vi.mock('@iconicedu/web/lib/messages/mappers/message.mapper', () => ({
  mapMessageRowToVM: (...args: unknown[]) => mapMessageRowToVM(...args),
}));

vi.mock('@iconicedu/web/lib/messages/builders/thread.builder', () => ({
  buildThreadById: (...args: unknown[]) => buildThreadById(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByAccountIds: (...args: unknown[]) => getProfilesByAccountIds(...args),
}));

describe('buildMessageById', () => {
  beforeEach(() => {
    getMessageById.mockReset();
    buildUserProfileById.mockReset();
    mapMessageRowToVM.mockReset();
    buildThreadById.mockReset();
    getMessageFilesByMessageIds.mockResolvedValue({ data: [] });
    getMessageImagesByMessageIds.mockResolvedValue({ data: [] });
    getMessageAudioRecordingsByMessageIds.mockResolvedValue({ data: [] });
    getMessageLiveSessionStartedByMessageIds.mockResolvedValue({ data: [] });
    getMessageReactionsByMessageIds.mockResolvedValue({ data: [] });
    getMessageReactionCountsByMessageIds.mockResolvedValue({ data: [] });
    getMessageSavesByMessageIds.mockResolvedValue({ data: [] });
    getMessagesByChannelId.mockResolvedValue({ data: [] });
    getProfilesByAccountIds.mockResolvedValue({ data: [] });
  });

  it('returns null when message does not exist', async () => {
    getMessageById.mockResolvedValueOnce({ data: null });

    const result = await buildMessageById({} as any, 'org-1', 'message-1');

    expect(result).toBeNull();
  });

  it('maps and returns a message', async () => {
    const row = {
      id: 'message-1',
      org_id: 'org-1',
      sender_profile_id: 'profile-1',
      type: 'text',
      created_at: new Date().toISOString(),
    };
    getMessageById.mockResolvedValueOnce({ data: row });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({ ids: { id: 'message-1', orgId: 'org-1' } });

    const result = await buildMessageById({} as any, 'org-1', 'message-1');

    expect(mapMessageRowToVM).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-1',
        is_saved: false,
      }),
      expect.objectContaining({
        payload: null,
        reactions: [],
      }),
    );
    expect(result).toEqual({ ids: { id: 'message-1', orgId: 'org-1' } });
  });

  it('maps saved state from per-profile message saves', async () => {
    const row = {
      id: 'message-saved',
      org_id: 'org-1',
      sender_profile_id: 'profile-1',
      type: 'text',
      created_at: new Date().toISOString(),
    };
    getMessageById.mockResolvedValueOnce({ data: row });
    getMessageSavesByMessageIds.mockResolvedValueOnce({
      data: [{ message_id: 'message-saved' }],
    });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-saved', orgId: 'org-1' },
    });

    await buildMessageById({} as any, 'org-1', 'message-saved', {
      profileId: 'profile-1',
    });

    expect(mapMessageRowToVM).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-saved',
        is_saved: true,
      }),
      expect.anything(),
    );
  });

  it('includes reactedByMe and sampleUserIds when building a single message', async () => {
    const row = {
      id: 'message-reacted',
      org_id: 'org-1',
      sender_profile_id: 'profile-2',
      type: 'text',
      created_at: new Date().toISOString(),
    };
    getMessageById.mockResolvedValueOnce({ data: row });
    getMessageReactionCountsByMessageIds.mockResolvedValueOnce({
      data: [{ message_id: 'message-reacted', emoji: '👍', count: 2 }],
    });
    getProfilesByAccountIds.mockResolvedValueOnce({
      data: [
        { account_id: 'account-1', id: 'profile-1' },
        { account_id: 'account-2', id: 'profile-2' },
      ],
    });
    getMessageReactionsByMessageIds.mockResolvedValueOnce({
      data: [
        {
          message_id: 'message-reacted',
          emoji: '👍',
          account_id: 'account-1',
        },
        {
          message_id: 'message-reacted',
          emoji: '👍',
          account_id: 'account-2',
        },
      ],
    });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-2', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-reacted', orgId: 'org-1' },
    });

    await buildMessageById({} as any, 'org-1', 'message-reacted', {
      accountId: 'account-1',
      profileId: 'profile-1',
    });

    expect(mapMessageRowToVM).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reactions: [
          {
            emoji: '👍',
            count: 2,
            reactedByMe: true,
            sampleUserIds: ['profile-1', 'profile-2'],
          },
        ],
      }),
    );
  });

  it('builds channel messages with viewer-specific reaction state', async () => {
    const row = {
      id: 'message-channel-1',
      org_id: 'org-1',
      sender_profile_id: 'profile-2',
      type: 'text',
      created_at: new Date().toISOString(),
    };
    getMessagesByChannelId.mockResolvedValueOnce({ data: [row] });
    getMessageReactionCountsByMessageIds.mockResolvedValueOnce({
      data: [{ message_id: 'message-channel-1', emoji: '🔥', count: 1 }],
    });
    getProfilesByAccountIds.mockResolvedValueOnce({
      data: [{ account_id: 'account-2', id: 'profile-2' }],
    });
    getMessageReactionsByMessageIds.mockResolvedValueOnce({
      data: [
        {
          message_id: 'message-channel-1',
          emoji: '🔥',
          account_id: 'account-2',
        },
      ],
    });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-2', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-channel-1', orgId: 'org-1' },
    });

    await buildMessagesByChannelId({} as any, 'org-1', 'channel-1', {
      accountId: 'account-1',
      profileId: 'profile-1',
    });

    expect(mapMessageRowToVM).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reactions: [
          {
            emoji: '🔥',
            count: 1,
            reactedByMe: false,
            sampleUserIds: ['profile-2'],
          },
        ],
      }),
    );
  });

  it('loads thread read state with account context when thread exists', async () => {
    const row = {
      id: 'message-2',
      org_id: 'org-1',
      sender_profile_id: 'profile-1',
      type: 'text',
      thread_id: 'thread-1',
      created_at: new Date().toISOString(),
    };
    getMessageById.mockResolvedValueOnce({ data: row });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    buildThreadById.mockResolvedValueOnce({ ids: { id: 'thread-1', orgId: 'org-1' } });
    mapMessageRowToVM.mockReturnValueOnce({ ids: { id: 'message-2', orgId: 'org-1' } });

    await buildMessageById({} as any, 'org-1', 'message-2', { accountId: 'account-1' });

    expect(buildThreadById).toHaveBeenCalledWith({} as any, 'org-1', 'thread-1', {
      accountId: 'account-1',
    });
  });

  it('keeps private image and audio payload urls stable while adding storage paths', async () => {
    const imageRow = {
      id: 'message-image',
      org_id: 'org-1',
      sender_profile_id: 'profile-1',
      type: 'image',
      created_at: new Date().toISOString(),
    };
    getMessageById.mockResolvedValueOnce({ data: imageRow });
    getMessageImagesByMessageIds.mockResolvedValueOnce({
      data: [
        {
          message_id: 'message-image',
          payload: { url: 'org-1/channel-1/profile-1/image.png', name: 'image.png' },
        },
      ],
    });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-image', orgId: 'org-1' },
    });

    await buildMessageById({} as any, 'org-1', 'message-image');

    expect(mapMessageRowToVM).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-image',
        is_saved: false,
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          url: 'org-1/channel-1/profile-1/image.png',
          storagePath: 'org-1/channel-1/profile-1/image.png',
        }),
      }),
    );

    const audioRow = {
      id: 'message-audio',
      org_id: 'org-1',
      sender_profile_id: 'profile-1',
      type: 'audio-recording',
      created_at: new Date().toISOString(),
    };
    getMessageById.mockResolvedValueOnce({ data: audioRow });
    getMessageAudioRecordingsByMessageIds.mockResolvedValueOnce({
      data: [
        {
          message_id: 'message-audio',
          payload: { url: 'org-1/channel-1/profile-1/audio.m4a', durationSeconds: 10 },
        },
      ],
    });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-audio', orgId: 'org-1' },
    });

    await buildMessageById({} as any, 'org-1', 'message-audio');

    expect(mapMessageRowToVM).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-audio',
        is_saved: false,
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          url: 'org-1/channel-1/profile-1/audio.m4a',
          storagePath: 'org-1/channel-1/profile-1/audio.m4a',
        }),
      }),
    );
  });

  it('normalizes grouped image attachment storage paths before mapping', async () => {
    const row = {
      id: 'message-gallery',
      org_id: 'org-1',
      sender_profile_id: 'profile-1',
      type: 'image',
      created_at: new Date().toISOString(),
    };
    getMessageById.mockResolvedValueOnce({ data: row });
    getMessageImagesByMessageIds.mockResolvedValueOnce({
      data: [
        {
          message_id: 'message-gallery',
          payload: {
            url: 'org-1/channel-1/profile-1/image-1.png',
            name: 'image-1.png',
            attachments: [
              {
                url: 'org-1/channel-1/profile-1/image-1.png',
                storagePath: 'org-1/channel-1/profile-1/image-1.png',
                name: 'image-1.png',
              },
              {
                url: 'org-1/channel-1/profile-1/image-2.png',
                storagePath: 'org-1/channel-1/profile-1/image-2.png',
                name: 'image-2.png',
              },
            ],
          },
        },
      ],
    });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-gallery', orgId: 'org-1' },
    });

    await buildMessageById({} as any, 'org-1', 'message-gallery');

    expect(mapMessageRowToVM).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-gallery',
        is_saved: false,
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          attachments: [
            expect.objectContaining({
              url: 'org-1/channel-1/profile-1/image-1.png',
              storagePath: 'org-1/channel-1/profile-1/image-1.png',
            }),
            expect.objectContaining({
              url: 'org-1/channel-1/profile-1/image-2.png',
              storagePath: 'org-1/channel-1/profile-1/image-2.png',
            }),
          ],
        }),
      }),
    );
  });
});
