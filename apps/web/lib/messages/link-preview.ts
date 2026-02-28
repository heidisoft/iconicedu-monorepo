export type LinkPreviewMetadata = {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  favicon?: string;
};

const URL_PATTERN = /(https?:\/\/[^\s]+)/i;

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
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`, 'i'),
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

export async function fetchLinkPreviewMetadata(url: string): Promise<LinkPreviewMetadata> {
  const normalizedUrl = new URL(url).toString();
  const fallbackHost = new URL(normalizedUrl).hostname.replace(/^www\./, '');

  try {
    const response = await fetch(normalizedUrl, {
      redirect: 'follow',
      headers: {
        'user-agent': 'IconicEduLinkPreviewBot/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch link preview: ${response.status}`);
    }

    const html = await response.text();
    const ogTitle = extractMetaContent(html, 'og:title');
    const ogDescription = extractMetaContent(html, 'og:description');
    const ogImage = extractMetaContent(html, 'og:image');
    const ogSiteName = extractMetaContent(html, 'og:site_name');
    const metaDescription = extractMetaContent(html, 'description');
    const title = ogTitle ?? extractTitle(html) ?? fallbackHost;
    const faviconHref =
      html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ??
      '/favicon.ico';

    return {
      url: normalizedUrl,
      title,
      description: ogDescription ?? metaDescription,
      imageUrl: resolveRelativeUrl(normalizedUrl, ogImage),
      siteName: ogSiteName ?? fallbackHost,
      favicon: resolveRelativeUrl(normalizedUrl, faviconHref),
    };
  } catch {
    return {
      url: normalizedUrl,
      title: fallbackHost,
      siteName: fallbackHost,
      favicon: resolveRelativeUrl(normalizedUrl, '/favicon.ico'),
    };
  }
}
