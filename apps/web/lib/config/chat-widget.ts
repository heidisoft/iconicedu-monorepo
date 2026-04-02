export type ChatWidgetProvider = 'tawk';

export interface ChatWidgetDefinition {
  readonly provider: ChatWidgetProvider;
  readonly scriptId: string;
  readonly strategy: 'afterInteractive';
  readonly inlineScript: string;
}

const CHAT_WIDGET_DEFINITIONS: Record<ChatWidgetProvider, ChatWidgetDefinition> = {
  tawk: {
    provider: 'tawk',
    scriptId: 'tawk-chat',
    strategy: 'afterInteractive',
    inlineScript: `
      var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
      (function () {
        var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
        s1.async = true;
        s1.src = "https://embed.tawk.to/69ce37e8b8aa781c3b30f2c2/1jl6okpif";
        s1.charset = "UTF-8";
        s1.setAttribute("crossorigin", "*");
        s0.parentNode.insertBefore(s1, s0);
      })();
    `.trim(),
  },
};

const ACTIVE_MARKETING_CHAT_WIDGET_PROVIDER: ChatWidgetProvider = 'tawk';

export function getMarketingChatWidget(
  provider: ChatWidgetProvider = ACTIVE_MARKETING_CHAT_WIDGET_PROVIDER,
): ChatWidgetDefinition {
  return CHAT_WIDGET_DEFINITIONS[provider];
}
