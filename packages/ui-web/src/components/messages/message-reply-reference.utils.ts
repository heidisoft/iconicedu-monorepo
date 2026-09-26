import type {
  MessageReplyReferenceVM,
  MessageTypeVM,
  MessageVM,
} from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';

const REPLY_SNIPPET_MAX_LENGTH = 140;

const FALLBACK_SNIPPET_BY_TYPE: Partial<Record<MessageTypeVM, string>> = {
  image: 'Photo',
  file: 'File',
  'audio-recording': 'Voice message',
  'lesson-assignment': 'Assignment',
  'homework-submission': 'Homework submission',
  'session-summary': 'Session summary',
  'session-booking': 'Session booking',
  'session-complete': 'Session completed',
  'progress-update': 'Progress update',
  'event-reminder': 'Event reminder',
  'payment-reminder': 'Payment reminder',
  'feedback-request': 'Feedback request',
  'design-file-update': 'Design file update',
  'link-preview': 'Link',
  'live-session-started': 'Live session started',
};

/** Best-effort human-readable snippet for a message, used to render a compact reply reference. */
export function getMessageReplySnippet(message: MessageVM): string {
  if ('content' in message && message.content?.text) {
    const trimmed = message.content.text.trim();
    if (trimmed) {
      return trimmed.length > REPLY_SNIPPET_MAX_LENGTH
        ? `${trimmed.slice(0, REPLY_SNIPPET_MAX_LENGTH).trimEnd()}…`
        : trimmed;
    }
  }
  return FALLBACK_SNIPPET_BY_TYPE[message.core.type] ?? 'Message';
}

/**
 * Builds a client-side reply reference snapshot purely for immediate composer UI (the
 * compact quote chip above the input). This is never sent to the server — only the
 * target message id is sent, and the server returns the sender-authoritative
 * `social.replyTo` snapshot on the created message.
 */
export function buildReplyReferenceFromMessage(
  message: MessageVM,
): MessageReplyReferenceVM {
  return {
    messageId: message.ids.id,
    senderId: message.core.sender.ids.id,
    senderName: getProfileDisplayName(message.core.sender.profile),
    snippet: getMessageReplySnippet(message),
    type: message.core.type,
  };
}
