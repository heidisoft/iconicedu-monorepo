import type {
  AudioRecordingMessageVM,
  ChannelFileItemVM,
  FileMessageVM,
  ImageMessageVM,
} from '@iconicedu/shared-types';

export type ChannelFileVisualKind =
  | 'image'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'text'
  | 'generic';

export function getChannelFileVisualTone(kind: ChannelFileVisualKind) {
  switch (kind) {
    case 'image':
      return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
    case 'audio':
      return 'bg-orange-500/12 text-orange-700 dark:text-orange-300';
    case 'pdf':
      return 'bg-rose-500/12 text-rose-700 dark:text-rose-300';
    case 'document':
      return 'bg-sky-500/12 text-sky-700 dark:text-sky-300';
    case 'spreadsheet':
      return 'bg-lime-500/12 text-lime-700 dark:text-lime-300';
    case 'presentation':
      return 'bg-amber-500/12 text-amber-700 dark:text-amber-300';
    case 'archive':
      return 'bg-violet-500/12 text-violet-700 dark:text-violet-300';
    case 'text':
      return 'bg-slate-500/12 text-slate-700 dark:text-slate-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function formatChannelFileUploadedDate(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

export function getChannelFileVisualKind(item: Pick<ChannelFileItemVM, 'name' | 'mimeType'>) {
  const mimeType = (item.mimeType ?? '').toLowerCase();
  const extension = item.name.toLowerCase().split('.').pop() ?? '';

  if (mimeType.startsWith('image/') || extension.match(/^(png|jpe?g|gif|webp|svg|heic)$/)) {
    return 'image' satisfies ChannelFileVisualKind;
  }
  if (mimeType.startsWith('audio/') || extension.match(/^(mp3|wav|m4a|ogg|webm|aac|flac)$/)) {
    return 'audio' satisfies ChannelFileVisualKind;
  }
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return 'pdf' satisfies ChannelFileVisualKind;
  }
  if (
    mimeType.includes('word') ||
    extension.match(/^(doc|docx|odt|pages|rtf)$/)
  ) {
    return 'document' satisfies ChannelFileVisualKind;
  }
  if (
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    extension.match(/^(xls|xlsx|csv|ods|numbers)$/)
  ) {
    return 'spreadsheet' satisfies ChannelFileVisualKind;
  }
  if (
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation') ||
    extension.match(/^(ppt|pptx|odp|key)$/)
  ) {
    return 'presentation' satisfies ChannelFileVisualKind;
  }
  if (
    mimeType.includes('zip') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    extension.match(/^(zip|rar|7z|tar|gz)$/)
  ) {
    return 'archive' satisfies ChannelFileVisualKind;
  }
  if (mimeType.startsWith('text/') || extension.match(/^(txt|md|json|xml|yaml|yml)$/)) {
    return 'text' satisfies ChannelFileVisualKind;
  }
  return 'generic' satisfies ChannelFileVisualKind;
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

export function createChannelFileItems(
  channelId: string,
  message: FileMessageVM | ImageMessageVM | AudioRecordingMessageVM,
): ChannelFileItemVM[] {
  if (isImageMessage(message)) {
    const attachments = message.attachments?.length ? message.attachments : [message.attachment];
    return attachments.map((attachment, index) => ({
      ids: {
        id: `file-${message.ids.id}-${index}`,
        orgId: message.ids.orgId,
        channelId,
      },
      messageId: message.ids.id,
      senderId: message.core.sender.ids.id,
      kind: 'file',
      url: attachment.url,
      storagePath: attachment.storagePath,
      name: attachment.name,
      mimeType: 'image/*',
      createdAt: message.core.createdAt,
    }));
  }

  if (isAudioRecordingMessage(message)) {
    return [createChannelFileItem(channelId, message)];
  }

  const attachments = message.attachments?.length ? message.attachments : [message.attachment];
  return attachments.map((attachment, index) => ({
    ids: {
      id: `file-${message.ids.id}-${index}`,
      orgId: message.ids.orgId,
      channelId,
    },
    messageId: message.ids.id,
    senderId: message.core.sender.ids.id,
    kind: 'file',
    url: attachment.url,
    storagePath: attachment.storagePath,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: message.core.createdAt,
  }));
}
