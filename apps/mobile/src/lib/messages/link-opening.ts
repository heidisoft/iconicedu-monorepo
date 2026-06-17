import { Alert, Linking } from 'react-native';

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<>()]+)/gi;
const TRUSTED_HOSTS = [
  'iconicedu.com',
  'apps.apple.com',
  'itunes.apple.com',
  'play.google.com',
];

export type MessageTextPart =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string; url: string };

function normalizeUrl(value: string): string {
  const trimmed = value.trim().replace(/[),.!?;:]+$/, '');
  return trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.!?;:]+$/, '');
}

function getHostname(url: string): string | null {
  try {
    return new URL(normalizeUrl(url)).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isTrustedExternalLink(url: string): boolean {
  const hostname = getHostname(url);
  if (!hostname) return false;
  return TRUSTED_HOSTS.some((trustedHost) => {
    const normalizedTrustedHost = trustedHost.replace(/^www\./, '');
    return (
      hostname === normalizedTrustedHost || hostname.endsWith(`.${normalizedTrustedHost}`)
    );
  });
}

export function splitMessageTextByLinks(text: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawValue = match[0];
    const index = match.index ?? 0;
    const displayValue = stripTrailingPunctuation(rawValue);
    const normalized = normalizeUrl(displayValue);
    const trailing = rawValue.slice(displayValue.length);

    if (index > cursor) {
      parts.push({ kind: 'text', value: text.slice(cursor, index) });
    }

    parts.push({ kind: 'link', value: displayValue, url: normalized });
    if (trailing) {
      parts.push({ kind: 'text', value: trailing });
    }
    cursor = index + rawValue.length;
  }

  if (cursor < text.length) {
    parts.push({ kind: 'text', value: text.slice(cursor) });
  }

  return parts.length ? parts : [{ kind: 'text', value: text }];
}

export function openMessageLink(url: string): void {
  const normalizedUrl = normalizeUrl(url);
  if (isTrustedExternalLink(normalizedUrl)) {
    void Linking.openURL(normalizedUrl).catch(() => null);
    return;
  }

  Alert.alert('Leave IconicEdu?', 'This link will open outside the app.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Open',
      style: 'default',
      onPress: () => {
        void Linking.openURL(normalizedUrl).catch(() => null);
      },
    },
  ]);
}
