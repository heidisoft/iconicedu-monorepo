import type {
  MessageVM,
  TextMessageVM,
  ImageMessageVM,
  FileMessageVM,
  DesignFileUpdateMessageVM,
  PaymentReminderMessageVM,
  EventReminderMessageVM,
  FeedbackRequestMessageVM,
  LessonAssignmentMessageVM,
  ProgressUpdateMessageVM,
  SessionBookingMessageVM,
  SessionCompleteMessageVM,
  SessionSummaryMessageVM,
  HomeworkSubmissionMessageVM,
  LinkPreviewMessageVM,
  AudioRecordingMessageVM,
  LiveSessionStartedMessageVM,
  UUID,
} from '@iconicedu/shared-types';

export function isTextMessage(message: MessageVM): message is TextMessageVM {
  return message.core.type === 'text';
}

export function isImageMessage(message: MessageVM): message is ImageMessageVM {
  return message.core.type === 'image';
}

export function isFileMessage(message: MessageVM): message is FileMessageVM {
  return message.core.type === 'file';
}

export function isDesignFileUpdateMessage(
  message: MessageVM,
): message is DesignFileUpdateMessageVM {
  return message.core.type === 'design-file-update';
}

export function isPaymentReminderMessage(
  message: MessageVM,
): message is PaymentReminderMessageVM {
  return message.core.type === 'payment-reminder';
}

export function isEventReminderMessage(
  message: MessageVM,
): message is EventReminderMessageVM {
  return message.core.type === 'event-reminder';
}

export function isFeedbackRequestMessage(
  message: MessageVM,
): message is FeedbackRequestMessageVM {
  return message.core.type === 'feedback-request';
}

export function isLessonAssignmentMessage(
  message: MessageVM,
): message is LessonAssignmentMessageVM {
  return message.core.type === 'lesson-assignment';
}

export function isProgressUpdateMessage(
  message: MessageVM,
): message is ProgressUpdateMessageVM {
  return message.core.type === 'progress-update';
}

export function isSessionBookingMessage(
  message: MessageVM,
): message is SessionBookingMessageVM {
  return message.core.type === 'session-booking';
}

export function isSessionCompleteMessage(
  message: MessageVM,
): message is SessionCompleteMessageVM {
  return message.core.type === 'session-complete';
}

export function isSessionSummaryMessage(
  message: MessageVM,
): message is SessionSummaryMessageVM {
  return message.core.type === 'session-summary';
}

export function isHomeworkSubmissionMessage(
  message: MessageVM,
): message is HomeworkSubmissionMessageVM {
  return message.core.type === 'homework-submission';
}

export function isLinkPreviewMessage(
  message: MessageVM,
): message is LinkPreviewMessageVM {
  return message.core.type === 'link-preview';
}

export function isAudioRecordingMessage(
  message: MessageVM,
): message is AudioRecordingMessageVM {
  return message.core.type === 'audio-recording';
}

export function isLiveSessionStartedMessage(
  message: MessageVM,
): message is LiveSessionStartedMessageVM {
  return message.core.type === 'live-session-started';
}

export function isMessageVisibleToUser(message: MessageVM, userId: UUID): boolean {
  const visibility = message.core.visibility;
  const senderId = message.core.sender.ids.id;

  switch (visibility.type) {
    case 'all':
      return true;
    case 'sender-only':
      return senderId === userId;
    case 'recipient-only':
      return visibility.userId === userId || senderId === userId;
    case 'specific-users':
      return visibility.userIds.includes(userId) || senderId === userId;
    default:
      return true;
  }
}
