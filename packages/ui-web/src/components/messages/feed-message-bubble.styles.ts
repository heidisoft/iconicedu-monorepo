// flag-exempt: readability maintenance matching existing mobile feed bubbles.
export function getFeedMessageBubbleClassName(isOwn: boolean) {
  return `rounded-[12px] px-3 py-2 ${isOwn ? 'bg-feed-bubble-own' : 'bg-feed-bubble-other'}`;
}
