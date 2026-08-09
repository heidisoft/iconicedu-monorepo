import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type TurnstileWidgetProps = {
  siteKey: string;
  baseUrl: string;
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
};

export function TurnstileWidget({
  siteKey,
  baseUrl,
  onTokenChange,
  resetKey = 0,
}: TurnstileWidgetProps) {
  const html = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head><body><div class="cf-turnstile" data-size="flexible" data-sitekey=${JSON.stringify(siteKey)}
data-callback="verified" data-expired-callback="expired" data-error-callback="expired"></div>
<script>
function verified(token){window.ReactNativeWebView.postMessage(JSON.stringify({token:token}))}
function expired(){window.ReactNativeWebView.postMessage(JSON.stringify({token:null}))}
</script></body></html>`;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { token?: unknown };
      onTokenChange(typeof payload.token === 'string' ? payload.token : null);
    } catch {
      onTokenChange(null);
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="Cloudflare Turnstile verification">
      <WebView
        key={resetKey}
        source={{ html, baseUrl }}
        originWhitelist={[
          baseUrl,
          'https://challenges.cloudflare.com',
          'about:blank',
          'about:srcdoc',
        ]}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 70, width: '100%' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
