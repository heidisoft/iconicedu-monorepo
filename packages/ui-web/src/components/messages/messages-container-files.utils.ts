import type {
  AudioRecordingMessageVM,
  ChannelFileItemVM,
  FileMessageVM,
  ImageMessageVM,
} from '@iconicedu/shared-types';

function getAudioFileName(message: AudioRecordingMessageVM): string {
  const fileName = message.audio.storagePath?.split('/').pop();
  return fileName && fileName.length > 0 ? fileName : 'Voice message';
}

function isImageMessage(
  message: FileMessageVM | ImageMessageVM | AudioRecordingMessageVM,
): message is ImageMessageVM {
  return message.core.type === 'image';
}

function isAudioRecordingMessage(
  message: FileMessageVM | ImageMessageVM | AudioRecordingMessageVM,
): message is AudioRecordingMessageVM {
  return message.core.type === 'audio-recording';
}

export function createChannelFileItem(
  channelId: string,
  message: FileMessageVM | ImageMessageVM | AudioRecordingMessageVM,
): ChannelFileItemVM {
  if (isImageMessage(message)) {
    return {
      ids: {
        id: `file-${message.ids.id}`,
        orgId: message.ids.orgId,
        channelId,
      },
      messageId: message.ids.id,
      senderId: message.core.sender.ids.id,
      kind: 'file',
      url: message.attachment.url,
      storagePath: message.attachment.storagePath,
      name: message.attachment.name,
      mimeType: 'image/*',
      createdAt: message.core.createdAt,
    };
  }

  if (isAudioRecordingMessage(message)) {
    return {
      ids: {
        id: `file-${message.ids.id}`,
        orgId: message.ids.orgId,
        channelId,
      },
      messageId: message.ids.id,
      senderId: message.core.sender.ids.id,
      kind: 'file',
      url: message.audio.url,
      storagePath: message.audio.storagePath,
      name: getAudioFileName(message),
      mimeType: message.audio.mimeType,
      size: message.audio.fileSize,
      createdAt: message.core.createdAt,
    };
  }

  return {
    ids: {
      id: `file-${message.ids.id}`,
      orgId: message.ids.orgId,
      channelId,
    },
    messageId: message.ids.id,
    senderId: message.core.sender.ids.id,
    kind: 'file',
    url: message.attachment.url,
    storagePath: message.attachment.storagePath,
    name: message.attachment.name,
    mimeType: message.attachment.mimeType,
    size: message.attachment.size,
    createdAt: message.core.createdAt,
  };
}
