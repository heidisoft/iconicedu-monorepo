import type { MessageVM } from '@iconicedu/shared-types';

const EMOJI_ONLY_PATTERN =
  /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)/gu;

function getMessageTextContent(message: MessageVM): string | null {
  if (!('content' in message) || !message.content || typeof message.content !== 'object') {
    return null;
  }

  return 'text' in message.content && typeof message.content.text === 'string'
    ? message.content.text
    : null;
}

export function isEmojiOnlyText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  const nonEmojiContent = trimmed.replace(EMOJI_ONLY_PATTERN, '').replace(/\s+/g, '');
  return nonEmojiContent.length === 0;
}

export function shouldHideMessageQuickActions(message: MessageVM): boolean {
  const text = getMessageTextContent(message);
  return text !== null && isEmojiOnlyText(text);
}
