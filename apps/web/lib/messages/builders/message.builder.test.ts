import { describe, expect, it, vi } from 'vitest';

import { buildMessageById } from '@iconicedu/web/lib/messages/builders/message.builder';

const getMessageById = vi.fn();
const buildUserProfileById = vi.fn();
const mapMessageRowToVM = vi.fn();
const buildThreadById = vi.fn();

vi.mock('@iconicedu/web/lib/messages/queries/messages.query', () => ({
  getMessageById: (...args: unknown[]) => getMessageById(...args),
  getMessagesByChannelId: vi.fn(async () => ({ data: [] })),
  getMessageTextByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageImagesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageFilesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageDesignFileUpdatesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessagePaymentRemindersByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageEventRemindersByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageFeedbackRequestsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageLessonAssignmentsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageProgressUpdatesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageSessionBookingsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageSessionCompletesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageSessionSummariesByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageHomeworkSubmissionsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageLinkPreviewsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageAudioRecordingsByMessageIds: vi.fn(async () => ({ data: [] })),
  getMessageReactionCountsByMessageIds: vi.fn(async () => ({ data: [] })),
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

describe('buildMessageById', () => {
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
    buildUserProfileById.mockResolvedValueOnce({ ids: { id: 'profile-1', orgId: 'org-1' } });
    mapMessageRowToVM.mockReturnValueOnce({ ids: { id: 'message-1', orgId: 'org-1' } });

    const result = await buildMessageById({} as any, 'org-1', 'message-1');

    expect(mapMessageRowToVM).toHaveBeenCalledWith(
      row,
      expect.objectContaining({
        payload: null,
        reactions: [],
      }),
    );
    expect(result).toEqual({ ids: { id: 'message-1', orgId: 'org-1' } });
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
    buildUserProfileById.mockResolvedValueOnce({ ids: { id: 'profile-1', orgId: 'org-1' } });
    buildThreadById.mockResolvedValueOnce({ ids: { id: 'thread-1', orgId: 'org-1' } });
    mapMessageRowToVM.mockReturnValueOnce({ ids: { id: 'message-2', orgId: 'org-1' } });

    await buildMessageById({} as any, 'org-1', 'message-2', { accountId: 'account-1' });

    expect(buildThreadById).toHaveBeenCalledWith({} as any, 'org-1', 'thread-1', {
      accountId: 'account-1',
    });
  });
});
