export type MarketingInfoPageContent = {
  slug: 'privacy' | 'terms' | 'cookies';
  title: string;
  eyebrow: string;
  intro: string;
  updatedLabel: string;
  sections: {
    title: string;
    body: string;
  }[];
};

export type MarketingRegionContent = {
  slug: string;
  regionName: string;
  headline: string;
  description: string;
  programs: {
    title: string;
    description: string;
  }[];
  outcomes: string[];
  ctaLabel: string;
};

export const MARKETING_INFO_PAGES = {
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    eyebrow: 'Legal',
    intro:
      'This overview explains how ICONIC Academy handles personal information across our learning platform, marketing website, and family inquiry experiences.',
    updatedLabel: 'Last updated: May 2026',
    sections: [
      {
        title: 'Information we collect',
        body: 'We collect account, learner, guardian, scheduling, communication, and support information needed to provide tutoring services and operate the platform.',
      },
      {
        title: 'How we use information',
        body: 'We use information to deliver programs, personalize learning support, coordinate educators, improve platform reliability, and respond to family or educator requests.',
      },
      {
        title: 'Sharing and safeguards',
        body: 'We limit access to authorized team members, educators, and trusted service providers who help us operate ICONIC Academy under appropriate safeguards.',
      },
      {
        title: 'Your choices',
        body: 'Families may contact us to request help with account information, communication preferences, or questions about how data is handled.',
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    eyebrow: 'Legal',
    intro:
      'These terms outline the expected use of ICONIC Academy services, including tutoring sessions, platform access, and communications with educators.',
    updatedLabel: 'Last updated: May 2026',
    sections: [
      {
        title: 'Using ICONIC Academy',
        body: 'Students, families, and educators are expected to use ICONIC Academy respectfully, accurately, and only for lawful educational purposes.',
      },
      {
        title: 'Programs and scheduling',
        body: 'Program availability, educator matching, session timing, and learning plans may vary by student needs, region, and operational capacity.',
      },
      {
        title: 'Accounts and safety',
        body: 'Account holders are responsible for maintaining secure access and for notifying ICONIC Academy if they believe an account has been misused.',
      },
      {
        title: 'Service changes',
        body: 'We may update programs, platform features, and policies as ICONIC Academy grows, while continuing to prioritize learner safety and service quality.',
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    eyebrow: 'Legal',
    intro:
      'This policy explains how cookies and similar technologies support site functionality, analytics, and a smoother ICONIC Academy experience.',
    updatedLabel: 'Last updated: May 2026',
    sections: [
      {
        title: 'Essential cookies',
        body: 'Some cookies are needed for core website and platform behavior, including authentication, session continuity, preferences, and security.',
      },
      {
        title: 'Analytics and performance',
        body: 'We may use analytics tools to understand page performance, improve content, and identify issues families encounter while exploring programs.',
      },
      {
        title: 'Managing preferences',
        body: 'Browser settings can often block or remove cookies, though disabling some cookies may affect sign-in, preferences, or platform functionality.',
      },
    ],
  },
} satisfies Record<MarketingInfoPageContent['slug'], MarketingInfoPageContent>;

export const MARKETING_REGIONS: MarketingRegionContent[] = [
  {
    slug: 'global-online',
    regionName: 'Global Online',
    headline: 'Specialized online programs for families anywhere',
    description:
      'A starter regional microsite for online-first programs, built so future regional teams can add local subjects, schedules, and academic priorities without rebuilding the page.',
    programs: [
      {
        title: 'K-12 academic support',
        description:
          'Personalized math, English, science, and study-skills support aligned to each learner.',
      },
      {
        title: 'STEM and coding pathways',
        description:
          'Structured enrichment in coding, robotics, scientific thinking, and project-based learning.',
      },
      {
        title: 'Competition and test preparation',
        description:
          'Focused preparation for exams, debate, chess, writing, and academic competitions.',
      },
    ],
    outcomes: [
      'Flexible online scheduling across time zones',
      'Educator matching based on learner needs',
      'Progress visibility for parents and guardians',
      'Reusable template for future regional program pages',
    ],
    ctaLabel: 'Ask about regional programs',
  },
];

export function findMarketingRegion(slug: string) {
  return MARKETING_REGIONS.find((region) => region.slug === slug) ?? null;
}
