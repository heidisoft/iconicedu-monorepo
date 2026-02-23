'use client';

import { memo } from 'react';
import type { MessageVM, ThreadVM, UUID } from '@iconicedu/shared-types';
import {
  isTextMessage,
  isImageMessage,
  isFileMessage,
  isDesignFileUpdateMessage,
  isPaymentReminderMessage,
  isEventReminderMessage,
  isFeedbackRequestMessage,
  isLessonAssignmentMessage,
  isProgressUpdateMessage,
  isSessionBookingMessage,
  isSessionCompleteMessage,
  isSessionSummaryMessage,
  isHomeworkSubmissionMessage,
  isLinkPreviewMessage,
  isAudioRecordingMessage,
  isMessageVisibleToUser,
} from '@iconicedu/ui-web/lib/message-guards';
import {
  TextMessage,
  ImageMessage,
  FileMessage,
  DesignFileMessage,
  PaymentReminderMessage,
  EventReminderMessage,
  FeedbackRequestMessage,
  LessonAssignmentMessage,
  ProgressUpdateMessage,
  SessionBookingMessage,
  SessionCompleteMessage,
  SessionSummaryMessage,
  HomeworkSubmissionMessage,
  AudioMessage,
  LinkPreviewMessage,
} from '@iconicedu/ui-web/components/messages/message-types';

interface MessageItemProps {
  message: MessageVM;
  onOpenThread: (thread: ThreadVM, parentMessage: MessageVM) => void | Promise<void>;
  isThreadReply?: boolean;
  currentUserId?: UUID;
  onProfileClick: (userId: UUID) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onToggleSaved?: (messageId: string) => void;
  onToggleHidden?: (messageId: string) => void;
  onToggleImportant?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

export const MessageItem = memo(function MessageItem({
  message,
  onOpenThread,
  isThreadReply = false,
  currentUserId = 'user-1',
  onProfileClick,
  onToggleReaction,
  onToggleSaved,
  onToggleHidden,
  onToggleImportant,
  onDelete,
}: MessageItemProps) {
  if (!isMessageVisibleToUser(message, currentUserId)) {
    return null;
  }

  const handleToggleReaction = (emoji: string) => {
    onToggleReaction?.(message.ids.id, emoji);
  };

  const handleToggleSaved = () => {
    onToggleSaved?.(message.ids.id);
  };

  const handleToggleHidden = () => {
    onToggleHidden?.(message.ids.id);
  };

  const handleToggleImportant = () => {
    onToggleImportant?.(message.ids.id);
  };

  const handleDelete = () => {
    onDelete?.(message.ids.id);
  };

  const commonProps = {
    onOpenThread,
    isThreadReply,
    onProfileClick,
    onToggleReaction: handleToggleReaction,
    onToggleSaved: handleToggleSaved,
    onToggleHidden: handleToggleHidden,
    onToggleImportant: handleToggleImportant,
    onDelete: handleDelete,
    currentUserId,
  };

  if (isTextMessage(message)) {
    return <TextMessage message={message} {...commonProps} />;
  }

  if (isImageMessage(message)) {
    return <ImageMessage message={message} {...commonProps} />;
  }

  if (isFileMessage(message)) {
    return <FileMessage message={message} {...commonProps} />;
  }

  if (isDesignFileUpdateMessage(message)) {
    return <DesignFileMessage message={message} {...commonProps} />;
  }

  if (isPaymentReminderMessage(message)) {
    return <PaymentReminderMessage message={message} {...commonProps} />;
  }

  if (isEventReminderMessage(message)) {
    return <EventReminderMessage message={message} {...commonProps} />;
  }

  if (isFeedbackRequestMessage(message)) {
    return <FeedbackRequestMessage message={message} {...commonProps} />;
  }

  if (isLessonAssignmentMessage(message)) {
    return <LessonAssignmentMessage message={message} {...commonProps} />;
  }

  if (isProgressUpdateMessage(message)) {
    return <ProgressUpdateMessage message={message} {...commonProps} />;
  }

  if (isSessionBookingMessage(message)) {
    return <SessionBookingMessage message={message} {...commonProps} />;
  }

  if (isSessionCompleteMessage(message)) {
    return <SessionCompleteMessage message={message} {...commonProps} />;
  }

  if (isSessionSummaryMessage(message)) {
    return <SessionSummaryMessage message={message} {...commonProps} />;
  }

  if (isHomeworkSubmissionMessage(message)) {
    return <HomeworkSubmissionMessage message={message} {...commonProps} />;
  }

  if (isAudioRecordingMessage(message)) {
    return <AudioMessage message={message} {...commonProps} />;
  }

  if (isLinkPreviewMessage(message)) {
    return <LinkPreviewMessage message={message} {...commonProps} />;
  }

  return null;
});
