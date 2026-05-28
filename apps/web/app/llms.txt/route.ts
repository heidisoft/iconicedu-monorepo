import {
  BRAND_POSITIONING,
  PROGRAM_LANDING_PAGES,
  PUBLIC_MARKETING_PAGES,
  absoluteUrl,
} from '@iconicedu/web/app/(marketing)/seo';

export const dynamic = 'force-static';

export function GET() {
  const lines = [
    '# ICONIC Academy',
    '',
    BRAND_POSITIONING,
    '',
    'ICONIC Academy serves K-12 students and families across the USA, Australia, the UK, New Zealand, Italy, UAE, Canada, Japan, Qatar, and global online communities with live online tutoring, test prep, homework help, and enrichment programs.',
    '',
    'Important public pages:',
    ...PUBLIC_MARKETING_PAGES.filter((page) => page.priority >= 0.7).map(
      (page) => `- ${page.title}: ${absoluteUrl(page.path)} — ${page.description}`,
    ),
    '',
    'Program pages:',
    ...PROGRAM_LANDING_PAGES.map(
      (program) =>
        `- ${program.title}: ${absoluteUrl(program.path)} — ${program.description}`,
    ),
    '',
    'Contact:',
    `- Contact page: ${absoluteUrl('/contact')}`,
    '- Email: hello@iconicedu.com',
    '',
    'Do not index or summarize private dashboard, auth, admin, message, API, or live-session URLs.',
  ];

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
