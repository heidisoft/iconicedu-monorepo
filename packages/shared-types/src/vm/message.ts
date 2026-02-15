import type { ConnectionVM, IdsBaseVM, ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { UserProfileVM } from '@iconicedu/shared-types/vm/profile';

export interface ReactionVM {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
  sampleUserIds?: UUID[];
}

export interface ChannelReadStateVM {
  channelId: UUID;
  lastReadMessageId?: UUID;
  lastReadAt?: ISODateTime;
  unreadCount: number;
}

export interface ThreadReadStateVM {
  threadId: UUID;
  channelId?: UUID;
  lastReadMessageId?: UUID;
  lastReadAt?: ISODateTime;
  unreadCount?: number;
}

export type AttachmentTypeVM = 'image' | 'file' | 'design-file';

export interface BaseAttachmentVM {
  type: AttachmentTypeVM;
  url: string;
  name: string;
}

export interface ImageAttachmentVM extends BaseAttachmentVM {
  type: 'image';
  width?: number;
  height?: number;
}

export interface FileAttachmentVM extends BaseAttachmentVM {
  type: 'file';
  size?: number;
  mimeType?: string;
}

export interface DesignFileAttachmentVM extends BaseAttachmentVM {
  type: 'design-file';
  tool: 'figma' | 'sketch' | 'adobe-xd' | 'canva' | 'other';
  version?: string;
  lastModified?: ISODateTime;
  thumbnail?: string;
}

export type AttachmentVM = ImageAttachmentVM | FileAttachmentVM | DesignFileAttachmentVM;

export interface ThreadVM {
  ids: IdsBaseVM;

  parent: {
    messageId: UUID;
    snippet?: string | null;
    authorId?: UUID | null;
    authorName?: string | null;
  };

  stats: {
    messageCount: number;
    lastReplyAt: ISODateTime;
  };

  participants: UserProfileVM[];

  readState?: ThreadReadStateVM;
}

export type MessagesRightPanelIntent =
  | { key: 'channel_info' }
  | { key: 'saved' }
  | { key: 'profile'; userId: UUID }
  | { key: 'thread'; threadId: UUID };

export type MessagesRightPanelIntentKey = MessagesRightPanelIntent['key'];

export interface MessagesRightSidebarState {
  isOpen: boolean;
  intent: MessagesRightPanelIntent | null;
  width?: number;
}

export type MessagesRightPanelRegistry<T> = Record<MessagesRightPanelIntentKey, T>;

export interface ThreadPanelPropsVM {
  thread: ThreadVM;
  replies: ConnectionVM<MessageVM>;
  parentMessage?: MessageVM;

  actions: {
    onSendReply: (content: string) => void;
    onProfileClick: (userId: UUID) => void;
    onToggleReaction?: (messageId: UUID, emoji: string) => void;
    onToggleSaved?: (messageId: UUID) => void;
    onToggleHidden?: (messageId: UUID) => void;
  };

  readState?: ThreadReadStateVM;
  currentUserId?: UUID;
}

export type MessageVisibilityVM =
  | { type: 'all' }
  | { type: 'sender-only' }
  | { type: 'recipient-only'; userId: UUID }
  | { type: 'specific-users'; userIds: UUID[] };

export type MessageTypeVM =
  | 'text'
  | 'image'
  | 'file'
  | 'design-file-update'
  | 'payment-reminder'
  | 'event-reminder'
  | 'feedback-request'
  | 'lesson-assignment'
  | 'progress-update'
  | 'session-booking'
  | 'session-complete'
  | 'session-summary'
  | 'homework-submission'
  | 'link-preview'
  | 'audio-recording';

export interface MessageCoreVM {
  type: MessageTypeVM;
  sender: UserProfileVM;
  createdAt: ISODateTime;
  visibility: MessageVisibilityVM;
}

export interface MessageStateVM {
  isEdited?: boolean;
  editedAt?: ISODateTime;
  isSaved?: boolean;
  isHidden?: boolean;
}

export interface MessageSocialVM {
  reactions: ReactionVM[];
  thread?: ThreadVM;
}

interface BaseMessageVM {
  ids: IdsBaseVM;
  core: MessageCoreVM;
  social: MessageSocialVM;
  state?: MessageStateVM;
}

export interface TextMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'text' };
  content: { text: string };
}

export interface ImageMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'image' };
  content?: { text?: string };
  attachment: ImageAttachmentVM;
}

export interface FileMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'file' };
  content?: { text?: string };
  attachment: FileAttachmentVM;
}

export interface DesignFileUpdateMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'design-file-update' };
  content?: { text?: string };
  attachment: DesignFileAttachmentVM;

  diff?: {
    changesSummary?: string[];
    previousVersion?: string;
  };
}

export interface PaymentReminderMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'payment-reminder' };
  content: { text: string };
  payment: {
    amount: number;
    currency: string;
    dueAt: ISODateTime;
    status: 'pending' | 'paid' | 'overdue';
    invoiceId?: string;
    description?: string;
  };
}

export interface EventReminderMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'event-reminder' };
  content: { text: string };
  event: {
    status?: string | null;
    title: string;
    startAt: ISODateTime;
    endAt?: ISODateTime;
    location?: string;
    meetingLink?: string;
    attendees?: UserProfileVM[];
    isAllDay?: boolean;
  };
}

export interface FeedbackRequestMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'feedback-request' };
  content?: { text?: string };
  feedback: {
    prompt: string;
    sessionTitle?: string | null;
    submittedAt?: ISODateTime | null;
    rating?: number | null;
    comment?: string | null;
  };
}

export interface LessonAssignmentMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'lesson-assignment' };
  content: { text: string };
  assignment: {
    title: string;
    description: string;
    dueAt: ISODateTime;
    subject: string;
    attachments?: AttachmentVM[];
    estimatedDuration?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  };
}

export interface ProgressUpdateMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'progress-update' };
  content: { text: string };
  progress: {
    subject: string;
    metric: string;
    previousValue: number;
    currentValue: number;
    targetValue?: number;
    improvement: number;
    summary: string;
  };
}

export interface SessionBookingMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'session-booking' };
  content: { text: string };
  session: {
    title: string;
    subject: string;
    startAt: ISODateTime;
    endAt?: ISODateTime;
    durationMinutes: number;
    meetingLink?: string;
    location?: string;
    status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
    topics?: string[];
  };
}

export interface SessionCompleteMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'session-complete' };
  content?: { text?: string };
  session: {
    title: string;
    startAt: ISODateTime;
    endAt?: ISODateTime;
    completedAt?: ISODateTime | null;
  };
}

export interface SessionSummaryMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'session-summary' };
  content?: { text?: string };
  session: {
    title: string;
    startAt: ISODateTime;
    durationMinutes?: number;
    summary: string;
    highlights?: string[];
    nextSteps?: string[];
  };
}

export interface HomeworkSubmissionMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'homework-submission' };
  content: { text: string };
  homework: {
    assignmentTitle: string;
    submittedAt: ISODateTime;
    attachments: AttachmentVM[];
    status: 'submitted' | 'graded' | 'needs-revision';
    grade?: string;
    feedback?: string;
  };
}

export interface LinkPreviewMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'link-preview' };
  content?: { text?: string };
  link: {
    url: string;
    title: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
    favicon?: string;
  };
}

export interface AudioRecordingMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'audio-recording' };
  content?: { text?: string };
  audio: {
    url: string;
    durationSeconds: number;
    waveform?: number[];
    fileSize?: number;
    mimeType?: string;
  };
}

export type MessageVM =
  | TextMessageVM
  | ImageMessageVM
  | FileMessageVM
  | DesignFileUpdateMessageVM
  | PaymentReminderMessageVM
  | EventReminderMessageVM
  | FeedbackRequestMessageVM
  | LessonAssignmentMessageVM
  | ProgressUpdateMessageVM
  | SessionBookingMessageVM
  | SessionCompleteMessageVM
  | SessionSummaryMessageVM
  | HomeworkSubmissionMessageVM
  | LinkPreviewMessageVM
  | AudioRecordingMessageVM;
