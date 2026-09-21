export type LinkPreviewMetadata = {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  favicon?: string;
};

const URL_PATTERN = /(https?:\/\/[^\s]+)/i;
const PRIVATE_HOST_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/i;

const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 512 * 1024; // 512KB is ample for <head> metadata
const MAX_REDIRECTS = 3;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMetaContent(html: string, property: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return undefined;
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1] ? decodeHtml(titleMatch[1].trim()) : undefined;
}

function resolveRelativeUrl(baseUrl: string, candidate?: string) {
  if (!candidate) return undefined;

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export function extractFirstUrl(text: string) {
  return text.match(URL_PATTERN)?.[1] ?? null;
}

export function isSafeLinkPreviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    return !PRIVATE_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

/** Reads at most maxBytes from a response body, then aborts — bounds memory/time on huge or slow responses. */
async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (received >= maxBytes) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  return text;
}

/** Fetches a URL, manually following same-safety-class redirects up to a bound so SSRF can't hide behind a hop. */
async function fetchFollowingSafeRedirects(
  startUrl: string,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: string } | null> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal,
      headers: { 'user-agent': 'ICONICEDULinkPreviewBot/1.0' },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      const nextUrl = resolveRelativeUrl(currentUrl, location);
      if (!nextUrl || !isSafeLinkPreviewUrl(nextUrl)) return null;
      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  return null;
}

function fallbackMetadata(url: string): LinkPreviewMetadata {
  const fallbackHost = new URL(url).hostname.replace(/^www\./, '');
  return {
    url,
    title: fallbackHost,
    siteName: fallbackHost,
    favicon: resolveRelativeUrl(url, '/favicon.ico'),
  };
}

export async function fetchLinkPreviewMetadata(
  url: string,
): Promise<LinkPreviewMetadata> {
  if (!isSafeLinkPreviewUrl(url)) {
    throw new Error('Unsafe URL for link preview');
  }
  const normalizedUrl = new URL(url).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const result = await fetchFollowingSafeRedirects(normalizedUrl, controller.signal);
    if (!result || !result.response.ok) {
      return fallbackMetadata(normalizedUrl);
    }

    const contentType = result.response.headers?.get?.('content-type') ?? '';
    if (contentType && !contentType.toLowerCase().includes('text/html')) {
      return fallbackMetadata(result.finalUrl);
    }

    const html = await readBoundedText(result.response, MAX_RESPONSE_BYTES);
    const ogTitle = extractMetaContent(html, 'og:title');
    const ogDescription = extractMetaContent(html, 'og:description');
    const ogImage = extractMetaContent(html, 'og:image');
    const ogSiteName = extractMetaContent(html, 'og:site_name');
    const metaDescription = extractMetaContent(html, 'description');
    const fallback = fallbackMetadata(result.finalUrl);
    const faviconHref =
      html.match(
        /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
      )?.[1] ?? '/favicon.ico';

    return {
      url: result.finalUrl,
      title: ogTitle ?? extractTitle(html) ?? fallback.title,
      description: ogDescription ?? metaDescription,
      imageUrl: resolveRelativeUrl(result.finalUrl, ogImage),
      siteName: ogSiteName ?? fallback.siteName,
      favicon: resolveRelativeUrl(result.finalUrl, faviconHref),
    };
  } catch {
    return fallbackMetadata(normalizedUrl);
  } finally {
    clearTimeout(timeout);
  }
}
