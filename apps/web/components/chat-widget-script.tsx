import Script from 'next/script';

import { getMarketingChatWidget } from '@iconicedu/web/lib/config/chat-widget';

export function ChatWidgetScript() {
  const widget = getMarketingChatWidget();

  return (
    <Script
      id={widget.scriptId}
      strategy={widget.strategy}
      dangerouslySetInnerHTML={{ __html: widget.inlineScript }}
    />
  );
}
