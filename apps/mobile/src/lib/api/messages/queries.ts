import { File as ExpoFile } from 'expo-file-system';
import type {
  MessageSendFileInput,
  MessageSendFilesInput,
  MessageSendTextInput,
  MessageVM,
} from '@iconicedu/shared-types';
import { apiDelete, apiGet, apiPost } from '@/lib/api/http-client';
import { supabase } from '@/lib/supabase/client';

export async function fetchChannelMessages(
  orgId: string,
  channelId: string,
  currentProfileId = '',
  currentAccountId = '',
  limit = 40,
  before?: string,
): Promise<MessageVM[]> {
  return apiGet('/messages', {
    orgId,
    channelId,
    profileId: currentProfileId,
    accountId: currentAccountId,
    limit,
    before,
  });
}

export async function fetchThreadMessages(
  orgId: string,
  channelId: string,
  threadId: string,
  parentMessageId: string,
  currentProfileId = '',
  currentAccountId = '',
): Promise<MessageVM[]> {
  return apiGet('/messages/thread', {
    orgId,
    channelId,
    threadId,
    parentMessageId,
    profileId: currentProfileId,
    accountId: currentAccountId,
  });
}

export async function toggleReaction(
  messageId: string,
  accountId: string,
  profileId: string,
  emoji: string,
  orgId: string,
  reactedByMe: boolean,
): Promise<void> {
  if (reactedByMe) {
    await apiDelete('/reactions', { orgId, messageId, emoji, accountId, profileId });
    return;
  }
  await apiPost('/reactions', { orgId, messageId, emoji, accountId, profileId });
}

export async function deleteMessage(
  messageId: string,
  orgId: string,
  profileId: string,
): Promise<void> {
  await apiDelete(`/messages/${messageId}`, { orgId, profileId });
}

export async function fetchChannelReadState(channelId: string, accountId: string) {
  if (!channelId || !accountId) return null;
  return apiGet<{
    channelId: string;
    threadId?: string | null;
    lastReadMessageId: string | null;
    lastReadAt: string | null;
    unreadCount: number;
  } | null>(`/channels/${channelId}/read-state`, { accountId });
}

export async function markChannelReadState(input: {
  orgId: string;
  accountId: string;
  profileId: string;
  channelId: string;
  lastReadMessageId?: string;
}): Promise<number> {
  const response = await apiPost<{ unreadCount?: number }>(
    `/channels/${input.channelId}/read-state`,
    input,
  );
  return response.unreadCount ?? 0;
}

export async function markChannelsReadByIds(input: {
  orgId: string;
  accountId: string;
  profileId: string;
  channelIds: string[];
}): Promise<void> {
  const uniqueChannelIds = [...new Set(input.channelIds.filter(Boolean))];
  if (!uniqueChannelIds.length) return;

  await Promise.all(
    uniqueChannelIds.map((channelId) =>
      markChannelReadState({
        orgId: input.orgId,
        accountId: input.accountId,
        profileId: input.profileId,
        channelId,
      }),
    ),
  );
}

export async function markThreadReadState(input: {
  orgId: string;
  accountId: string;
  profileId: string;
  channelId: string;
  threadId: string;
  lastReadMessageId?: string | null;
}): Promise<number> {
  const response = await apiPost<{ unreadCount?: number }>(
    `/channels/${input.channelId}/read-state`,
    input,
  );
  return response.unreadCount ?? 0;
}

export async function sendTextMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  text: string,
  threadParentId?: string,
  threadId?: string,
) {
  const content = text.trim();
  if (!content) throw new Error('Message text is required');
  return apiPost('/messages/text', {
    orgId,
    channelId,
    senderProfileId,
    content,
    threadParentId,
    threadId,
  } satisfies MessageSendTextInput);
}

const CHANNEL_FILES_BUCKET = 'channel-files';

function sanitizeStorageFileName(name: string, fallback = 'file') {
  const trimmed = name.trim() || fallback;
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

function buildStorageFileKey(name: string, fallbackExt?: string): string {
  const hasExt = /\.[^./]+$/.test(name);
  const rawExt = hasExt ? name.split('.').pop()?.toLowerCase() : null;
  const ext = rawExt ?? fallbackExt ?? null;
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const baseName = sanitizeStorageFileName(name.replace(/\.[^/.]+$/, '')).replace(
    /\.+$/g,
    '',
  );
  return ext
    ? `${timestamp}-${randomSuffix}-${baseName}.${ext}`
    : `${timestamp}-${randomSuffix}-${baseName}`;
}

export function buildMessageStoragePath(
  orgId: string,
  channelId: string,
  profileId: string,
  mimeType: string,
  fileName: string,
): string {
  const kind = mimeType.startsWith('image/')
    ? 'images'
    : mimeType.startsWith('audio/')
      ? 'audio'
      : 'files';
  const fileKey = buildStorageFileKey(fileName);
  return `${orgId}/${channelId}/${kind}/${profileId}/${fileKey}`;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

export async function uploadChannelFile(
  localUri: string,
  storagePath: string,
  mimeType: string,
  prereadBase64?: string,
): Promise<void> {
  const data: Uint8Array = prereadBase64
    ? base64ToUint8Array(prereadBase64)
    : await new ExpoFile(localUri).bytes();

  const { error } = await supabase.storage
    .from(CHANNEL_FILES_BUCKET)
    .upload(storagePath, data, { contentType: mimeType, upsert: false });

  if (error) throw error;
}

export type FileAttachmentInput = {
  storagePath: string;
  name: string;
  mimeType: string;
  size?: number;
  durationSeconds?: number;
};

export async function sendFileMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  file: FileAttachmentInput,
  content?: string,
  threadParentId?: string,
  threadId?: string,
) {
  const result = await apiPost<{ id: string }>('/messages/file', {
    orgId,
    channelId,
    senderProfileId,
    name: file.name,
    storagePath: file.storagePath,
    mimeType: file.mimeType,
    size: file.size,
    durationSeconds: file.durationSeconds,
    content,
    threadParentId: threadParentId ?? null,
    threadId: threadId ?? null,
  } satisfies MessageSendFileInput);

  return { id: result.id };
}

export async function sendFilesMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  files: FileAttachmentInput[],
  content?: string,
  threadParentId?: string,
  threadId?: string,
) {
  if (!files.length) throw new Error('No files provided');
  const result = await apiPost<{ id: string }>('/messages/files', {
    orgId,
    channelId,
    senderProfileId,
    assets: files.map((file) => ({
      name: file.name,
      storagePath: file.storagePath,
      mimeType: file.mimeType,
      size: file.size,
    })),
    content,
    threadParentId: threadParentId ?? null,
    threadId: threadId ?? null,
  } satisfies MessageSendFilesInput);

  return { id: result.id };
}
