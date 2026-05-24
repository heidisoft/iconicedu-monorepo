import {
  BRAND_POSITIONING,
  LOCATION_LANDING_PAGES,
  PROGRAM_LANDING_PAGES,
  PUBLIC_MARKETING_PAGES,
  US_CURRICULUM_STANDARDS,
  absoluteUrl,
} from '@iconicedu/web/app/(marketing)/seo';

export const dynamic = 'force-static';

export function GET() {
  const lines = [
    '# ICONIC Academy Full Site Summary',
    '',
    '## Brand',
    BRAND_POSITIONING,
    '',
    '## Audience',
    'K-12 students, parents, and guardians looking for online academic support, test preparation, homework help, enrichment, and flexible learning options.',
    '',
    '## Services',
    '- Online 1-on-1 tutoring',
    '- Online small-group classes',
    '- Core academics: Math, ELA, reading, writing, grammar, science, social studies, homework help, and study skills',
    '- Advanced academics: algebra, geometry, biology, chemistry, physics, STEM projects, AP support, and competition math',
    '- Test prep: state exams, SHSAT, SAT, ACT, ISEE, SSAT, Regents, spelling bee, debate tournaments, and academic competitions',
    '- Future-ready skills: coding, robotics, AI basics, web development, game design, financial literacy, entrepreneurship, public speaking, and critical thinking',
    '- Creative and extracurricular learning: chess, debate, creative writing, drawing, arts and crafts, music, piano, guitar, drama, photography, and digital media',
    '',
    '## Locations Served',
    'ICONIC Academy supports families across the United States and global online communities. Location pages are only for online tutoring availability, not physical centers.',
    ...LOCATION_LANDING_PAGES.map(
      (location) =>
        `- ${location.title}: ${absoluteUrl(location.path)} — ${location.description}`,
    ),
    '',
    '## U.S. Curriculum Support',
    'Tutors can connect support to school assignments, grade-level expectations, and state standards where applicable. ICONIC Academy does not claim perfect coverage of every curriculum.',
    ...US_CURRICULUM_STANDARDS.map((standard) => `- ${standard}`),
    '',
    '## Public Pages',
    ...PUBLIC_MARKETING_PAGES.map(
      (page) => `- ${page.title}: ${absoluteUrl(page.path)} — ${page.description}`,
    ),
    '',
    '## Program Pages',
    ...PROGRAM_LANDING_PAGES.map((program) =>
      [
        `- ${program.title}: ${absoluteUrl(program.path)}`,
        `  Summary: ${program.summary}`,
        `  Audience: ${program.audience}`,
        `  Related subjects: ${program.relatedSubjects.join(', ')}`,
      ].join('\n'),
    ),
    '',
    '## Pricing',
    'Published marketing copy mentions global tutor options starting from $12/hour. Families should contact ICONIC Academy for fit, schedule, tutor availability, and exact plan details.',
    '',
    '## Trust and Safety Notes',
    '- Do not invent ratings, reviews, tutor credentials, physical addresses, or guarantees.',
    '- Use "experienced tutors" or "certified teachers and experienced subject tutors available" unless a page provides verified credentials.',
    '- Private dashboard, auth, admin, message, API, and live-session URLs are not public marketing content.',
    '',
    '## Contact',
    `- Contact page: ${absoluteUrl('/contact')}`,
    '- Email: hello@iconicedu.com',
  ];

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
