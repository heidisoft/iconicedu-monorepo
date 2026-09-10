import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * Cloudflare Turnstile public site key, or null when unconfigured. When null the
 * widget renders nothing and callers send no `captchaToken` — correct while
 * Supabase Attack Protection / CAPTCHA is disabled.
 *
 * `babel-preset-expo` inlines `EXPO_PUBLIC_*` at build time wherever it appears,
 * so reading it inside a function is equivalent to a module constant.
 */
export function getTurnstileSiteKey(): string | null {
  return process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

/**
 * Origin the Turnstile widget page runs as. Turnstile validates this hostname
 * against the widget's allowed domains, so it must be registered in the
 * Cloudflare dashboard. Kept constant across environments; override only if a
 * different registered host is needed.
 */
export function getTurnstileWidgetOrigin(): string {
  return (
    process.env.EXPO_PUBLIC_TURNSTILE_WIDGET_ORIGIN?.trim() || 'https://app.iconicedu.com'
  );
}

export function isTurnstileConfigured(): boolean {
  return getTurnstileSiteKey() !== null;
}

const CHALLENGE_HEIGHT = 72;

function buildHtml(siteKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  #container { display: flex; justify-content: center; align-items: center; }
</style>
</head>
<body>
<div id="container"></div>
<script>
  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(message);
    }
  }
  function renderWidget() {
    if (!window.turnstile) {
      window.setTimeout(renderWidget, 50);
      return;
    }
    window.turnstile.render('#container', {
      sitekey: ${JSON.stringify(siteKey)},
      appearance: 'interaction-only',
      callback: function (token) { post('token:' + token); },
      'error-callback': function () { post('error'); return true; },
      'expired-callback': function () { post('expired'); },
      'timeout-callback': function () { post('timeout'); },
      'before-interactive-callback': function () { post('challenge'); },
      'after-interactive-callback': function () { post('solved'); }
    });
  }
  renderWidget();
</script>
</body>
</html>`;
}

type TurnstileWebViewProps = {
  /** Token on success; null on expiry / error / timeout. */
  onToken: (token: string | null) => void;
};

/**
 * Hosts a managed Cloudflare Turnstile widget inside a WebView and posts the
 * token back. Invisible until Cloudflare asks for an interactive challenge, at
 * which point it expands to a tappable height. Renders nothing when unconfigured.
 */
export function TurnstileWebView({ onToken }: TurnstileWebViewProps) {
  const [challengeActive, setChallengeActive] = useState(false);
  const siteKey = getTurnstileSiteKey();

  const html = useMemo(() => (siteKey ? buildHtml(siteKey) : ''), [siteKey]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data ?? '';
      if (data.startsWith('token:')) {
        setChallengeActive(false);
        onToken(data.slice('token:'.length));
        return;
      }
      switch (data) {
        case 'challenge':
          setChallengeActive(true);
          break;
        case 'solved':
          setChallengeActive(false);
          break;
        case 'expired':
        case 'error':
        case 'timeout':
          setChallengeActive(false);
          onToken(null);
          break;
        default:
          break;
      }
    },
    [onToken],
  );

  if (!siteKey) {
    return null;
  }

  return (
    <View
      style={[styles.container, challengeActive ? styles.challenge : styles.hidden]}
      pointerEvents={challengeActive ? 'auto' : 'none'}
      accessibilityElementsHidden={!challengeActive}
      importantForAccessibility={challengeActive ? 'auto' : 'no-hide-descendants'}
    >
      <WebView
        testID="turnstile-webview"
        originWhitelist={['*']}
        source={{ html, baseUrl: getTurnstileWidgetOrigin() }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        style={styles.webview}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignSelf: 'center', overflow: 'hidden' },
  hidden: { height: 0 },
  challenge: { height: CHALLENGE_HEIGHT },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
