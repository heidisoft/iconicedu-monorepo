import type { Metadata } from 'next';
import {
  MARKETING_FAQS,
  PROGRAM_CATEGORIES,
  US_CURRICULUM_STANDARDS,
} from '@iconicedu/ui-web';

export { US_CURRICULUM_STANDARDS } from '@iconicedu/ui-web';

export const SITE_NAME = 'ICONIC Academy';
export const BRAND_NAME = 'ICONIC Academy';
export const DEFAULT_SITE_URL = 'https://www.iconicedu.com';
export const CONTACT_EMAIL = 'hello@iconicedu.com';

export const BRAND_POSITIONING =
  'ICONIC Academy is an online learning platform helping K-12 students build confidence and long-term academic success through experienced tutors, personalized learning paths, parent communication, flexible scheduling, affordable options, core academic subjects, test prep, and extracurricular learning.';

const DEFAULT_DESCRIPTION =
  'ICONIC Academy provides online K-12 tutoring, test prep, homework help, and enrichment programs with experienced tutors, parent communication, flexible scheduling, and affordable options.';

const DEFAULT_KEYWORDS = [
  'online tutoring',
  'K-12 tutoring',
  'math tutoring',
  'ELA tutoring',
  'science tutoring',
  'test prep',
  'homework help',
  'reading tutor',
  'writing tutor',
  'coding tutoring',
  'US curriculum tutoring',
  'affordable tutoring',
  'experienced tutors',
  'ICONIC Academy',
];

export type PublicPageSeo = {
  path: string;
  title: string;
  description: string;
  priority: number;
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
};

export type ProgramLandingPage = PublicPageSeo & {
  slug: string;
  h1: string;
  summary: string;
  audience: string;
  support: readonly string[];
  outcomes: readonly string[];
  relatedSubjects: readonly string[];
};

export type LocationLandingPage = PublicPageSeo & {
  slug: string;
  h1: string;
  summary: string;
  standards: readonly string[];
  support: readonly string[];
};

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.WEB_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (!configuredUrl) {
    return DEFAULT_SITE_URL;
  }

  const withProtocol = configuredUrl.startsWith('http')
    ? configuredUrl
    : `https://${configuredUrl}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function absoluteUrl(path = '/') {
  return new URL(path, getSiteUrl()).toString();
}

export function createMarketingMetadata(page: PublicPageSeo): Metadata {
  const title = page.title.includes(BRAND_NAME)
    ? page.title
    : `${page.title} | ${BRAND_NAME}`;

  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description: page.description,
    keywords: DEFAULT_KEYWORDS,
    alternates: { canonical: page.path },
    openGraph: {
      type: 'website',
      url: page.path,
      siteName: SITE_NAME,
      title,
      description: page.description,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: page.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export const PUBLIC_MARKETING_PAGES: PublicPageSeo[] = [
  {
    path: '/',
    title: 'Online K-12 Tutoring, Test Prep, and Enrichment',
    description: DEFAULT_DESCRIPTION,
    priority: 1,
    changeFrequency: 'weekly',
  },
  {
    path: '/subjects',
    title: 'K-12 Tutoring Programs and Enrichment',
    description:
      'Explore ICONIC Academy programs for math, ELA, reading, writing, science, homework help, test prep, coding, debate, chess, music, art, and future-ready skills.',
    priority: 0.9,
    changeFrequency: 'weekly',
  },
  {
    path: '/how-it-works',
    title: 'How Online Tutoring Works',
    description:
      'See how ICONIC Academy builds personalized learning paths with experienced tutors, curriculum-aware support, flexible scheduling, and parent communication.',
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/for-parents',
    title: 'Online Tutoring for Parents Who Want Clear Updates',
    description:
      'Learn how ICONIC Academy keeps parents informed with tutor notes, session reminders, school-aligned support, progress visibility, and flexible tutor options.',
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/pricing',
    title: 'Affordable Online Tutoring Options',
    description:
      'Compare flexible ICONIC Academy tutoring options including global tutor support from $12/hour, USA curriculum support, advanced enrichment, and custom learning plans.',
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/about',
    title: 'About ICONIC Academy',
    description:
      'Learn about ICONIC Academy, an online learning platform focused on experienced tutors, affordable options, personalized learning, and parent-first communication.',
    priority: 0.5,
    changeFrequency: 'monthly',
  },
  {
    path: '/contact',
    title: 'Contact ICONIC Academy',
    description:
      'Contact ICONIC Academy to ask about online tutoring, curriculum-aware support, USA or global tutors, test prep, enrichment programs, pricing, or family support.',
    priority: 0.7,
    changeFrequency: 'monthly',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    description:
      'Read how ICONIC Academy handles family, learner, scheduling, communication, and support information across the learning platform.',
    priority: 0.2,
    changeFrequency: 'yearly',
  },
  {
    path: '/terms',
    title: 'Terms of Service',
    description:
      'Review ICONIC Academy terms for tutoring sessions, online learning programs, platform access, scheduling, and family communications.',
    priority: 0.2,
    changeFrequency: 'yearly',
  },
  {
    path: '/cookies',
    title: 'Cookie Policy',
    description:
      'Learn how ICONIC Academy uses cookies and similar technologies for site functionality, analytics, preferences, and platform reliability.',
    priority: 0.2,
    changeFrequency: 'yearly',
  },
];

export const PROGRAM_LANDING_PAGES: ProgramLandingPage[] = [
  {
    slug: 'online-tutoring',
    path: '/programs/online-tutoring',
    title: 'Online K-12 Tutoring',
    description:
      'Online K-12 tutoring with experienced tutors, personalized learning paths, flexible scheduling, parent updates, and affordable 1-on-1 or small-group options.',
    priority: 0.9,
    changeFrequency: 'monthly',
    h1: 'Online K-12 tutoring for school success and confidence',
    summary:
      'ICONIC Academy supports students who need help catching up, staying on track, or moving ahead through live online tutoring matched to the learner, schedule, budget, and school goals.',
    audience:
      'K-12 students and families looking for flexible academic support from home.',
    support: [
      '1-on-1 and small-group tutoring options',
      'Experienced USA-based and global tutors',
      'Homework, grade-level skills, state standards where applicable, and enrichment',
      'Parent communication, reminders, and session updates',
    ],
    outcomes: [
      'Stronger foundations',
      'Improved confidence',
      'Clearer parent visibility',
      'A learning path that can grow over time',
    ],
    relatedSubjects: ['Math', 'ELA', 'Science', 'Reading', 'Writing', 'Homework Help'],
  },
  {
    slug: 'math-tutoring',
    path: '/programs/math-tutoring',
    title: 'Online Math Tutoring',
    description:
      'Online math tutoring for K-12 students covering foundations, homework help, algebra, geometry, advanced math, test prep, and competition math support.',
    priority: 0.85,
    changeFrequency: 'monthly',
    h1: 'Online math tutoring for foundations, homework, and advanced learners',
    summary:
      'Students can work on math confidence, missing concepts, homework, grade-level skills, and advanced challenge with tutors matched to their pace.',
    audience:
      'Elementary, middle, and high school students who need math support or enrichment.',
    support: [
      'Math fluency, problem solving, homework help, and test readiness',
      'Pre-Algebra, Algebra, Geometry, Precalculus, and advanced topics',
      'Curriculum-aware support connected to school expectations where applicable',
    ],
    outcomes: [
      'Better accuracy',
      'More confidence explaining work',
      'Stronger study habits',
    ],
    relatedSubjects: [
      'Pre-Algebra',
      'Algebra',
      'Geometry',
      'Precalculus',
      'Competition Math',
    ],
  },
  {
    slug: 'ela-reading-writing-tutoring',
    path: '/programs/ela-reading-writing-tutoring',
    title: 'ELA, Reading, and Writing Tutoring',
    description:
      'Online ELA, reading, and writing tutoring for comprehension, grammar, vocabulary, essays, homework, state standards, and school assignments.',
    priority: 0.85,
    changeFrequency: 'monthly',
    h1: 'ELA, reading, and writing support that connects to school goals',
    summary:
      'ICONIC Academy helps learners strengthen comprehension, writing structure, grammar, vocabulary, and confidence with school-aligned support.',
    audience:
      'Students who need reading comprehension, writing, grammar, essay, or ELA homework support.',
    support: [
      'Reading comprehension and book discussion',
      'Essay writing, grammar, vocabulary, and written responses',
      'USA-based and native English-speaking tutor options when language fluency matters',
    ],
    outcomes: [
      'Clearer writing',
      'Stronger comprehension',
      'More independent reading habits',
    ],
    relatedSubjects: ['ELA', 'Reading', 'Writing', 'Grammar', 'Essay Writing'],
  },
  {
    slug: 'science-tutoring',
    path: '/programs/science-tutoring',
    title: 'Online Science Tutoring',
    description:
      'Online science tutoring for K-12 biology, chemistry, physics, earth science, STEM projects, homework help, and test preparation.',
    priority: 0.75,
    changeFrequency: 'monthly',
    h1: 'Online science tutoring for curiosity, homework, and readiness',
    summary:
      'Students can get science homework help, build conceptual understanding, and explore STEM topics with tutors who adapt to grade level and goals.',
    audience: 'K-12 students who need science support, test prep, or STEM enrichment.',
    support: [
      'Biology, chemistry, physics, earth science, and general science',
      'Homework, labs, vocabulary, diagrams, and test review',
      'STEM projects and experiments for enrichment',
    ],
    outcomes: [
      'Clearer concepts',
      'Better preparation',
      'More confidence in science class',
    ],
    relatedSubjects: [
      'Biology',
      'Chemistry',
      'Physics',
      'Earth Science',
      'STEM Projects',
    ],
  },
  {
    slug: 'coding-tutoring',
    path: '/programs/coding-tutoring',
    title: 'Coding, AI, and Game Design Tutoring',
    description:
      'Online coding tutoring and enrichment for kids and teens, including programming basics, AI concepts, web development, robotics, and game design.',
    priority: 0.75,
    changeFrequency: 'monthly',
    h1: 'Coding, AI, robotics, and game design for kids and teens',
    summary:
      'ICONIC Academy helps students explore future-ready technology skills through project-based online tutoring and enrichment programs.',
    audience:
      'Students who want to learn coding, robotics, AI basics, web development, or game design.',
    support: [
      'Beginner-friendly coding concepts and projects',
      'Robotics, AI basics, web development, and game design',
      'Creative projects that build confidence and problem-solving',
    ],
    outcomes: [
      'Technology confidence',
      'Project-building experience',
      'Stronger problem solving',
    ],
    relatedSubjects: [
      'Coding',
      'Robotics',
      'AI Basics',
      'Web Development',
      'Game Design',
    ],
  },
  {
    slug: 'test-prep',
    path: '/programs/test-prep',
    title: 'Online Test Prep and State Exam Support',
    description:
      'Online test prep for state exams, SHSAT, SAT, ACT, ISEE, SSAT, Regents, AP support, spelling bee, debate, and academic competitions.',
    priority: 0.8,
    changeFrequency: 'monthly',
    h1: 'Online test prep and academic competition support',
    summary:
      'Students can prepare for school exams, state tests, admissions exams, AP support, and competitions with targeted tutoring and practice.',
    audience:
      'Students preparing for exams, admissions tests, academic competitions, or advanced coursework.',
    support: [
      'State exams, SHSAT, SAT, ACT, ISEE, SSAT, Regents, and AP support',
      'Competition math, spelling bee, debate tournaments, and academic competitions',
      'Study planning, practice, review, and confidence building',
    ],
    outcomes: [
      'More focused preparation',
      'Better test habits',
      'Reduced last-minute stress',
    ],
    relatedSubjects: ['State Exams', 'SHSAT', 'SAT', 'ACT', 'Regents', 'AP Support'],
  },
  {
    slug: 'homework-help',
    path: '/programs/homework-help',
    title: 'Online Homework Help',
    description:
      'Online homework help for K-12 students in math, ELA, science, reading, writing, social studies, study skills, and school assignments.',
    priority: 0.75,
    changeFrequency: 'monthly',
    h1: 'Online homework help that builds understanding, not shortcuts',
    summary:
      'ICONIC Academy tutors help students work through assignments while strengthening the underlying skills needed for long-term success.',
    audience:
      'Students who need consistent help with school assignments and study routines.',
    support: [
      'Homework help across math, ELA, science, reading, writing, and social studies',
      'Study skills, organization, and executive function support',
      'Tutor notes and next-step guidance for parents',
    ],
    outcomes: ['Less homework friction', 'Better routines', 'More independent learning'],
    relatedSubjects: [
      'Homework Help',
      'Study Skills',
      'Executive Function',
      'Core Academics',
    ],
  },
  {
    slug: 'extracurricular-classes',
    path: '/programs/extracurricular-classes',
    title: 'Online Extracurricular Classes',
    description:
      'Online extracurricular and enrichment programs including chess, debate, creative writing, music, art, public speaking, financial literacy, and entrepreneurship.',
    priority: 0.7,
    changeFrequency: 'monthly',
    h1: 'Online extracurricular classes and enrichment programs',
    summary:
      'Students can explore interests beyond the school day while building confidence, communication, creativity, and future-ready skills.',
    audience:
      'Curious learners who want enrichment, advanced challenge, or creative exploration.',
    support: [
      'Chess, debate, creative writing, music, art, drama, and public speaking',
      'Financial literacy and entrepreneurship for kids and teens',
      'Small-group and specialized tutor options where available',
    ],
    outcomes: [
      'Broader interests',
      'Creative confidence',
      'Stronger communication skills',
    ],
    relatedSubjects: [
      'Chess',
      'Debate',
      'Creative Writing',
      'Music',
      'Art',
      'Financial Literacy',
    ],
  },
  {
    slug: 'us-curriculum-support',
    path: '/programs/us-curriculum-support',
    title: 'U.S. Curriculum and State Standards Support',
    description:
      'Curriculum-aware online tutoring for students across the USA, with support connected to homework, grade-level skills, school goals, and state standards where applicable.',
    priority: 0.85,
    changeFrequency: 'monthly',
    h1: 'U.S. curriculum support for students across every state',
    summary:
      'ICONIC Academy supports families across the United States with tutoring that can connect to classroom expectations, school assignments, and state standards where applicable.',
    audience:
      'Families in U.S. schools who want tutoring connected to school goals and grade-level expectations.',
    support: [...US_CURRICULUM_STANDARDS, 'School-specific goals and assignment support'],
    outcomes: [
      'Better school alignment',
      'Clearer parent understanding',
      'More targeted tutoring',
    ],
    relatedSubjects: ['State Standards', 'Homework Help', 'Test Prep', 'Core Academics'],
  },
];

export const LOCATION_LANDING_PAGES: LocationLandingPage[] = [
  {
    slug: 'usa',
    path: '/locations/usa',
    title: 'Online Tutoring Across the USA',
    description:
      'Online K-12 tutoring across the USA with curriculum-aware support, experienced tutors, affordable options, parent updates, and flexible scheduling.',
    priority: 0.85,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for families across the USA',
    summary:
      'ICONIC Academy supports K-12 students across the United States with live online tutoring, homework help, test prep, and enrichment programs.',
    standards: US_CURRICULUM_STANDARDS,
    support: [
      'USA-based and global tutor options',
      'State standards where applicable',
      'Flexible scheduling for evening, weekend, and time-zone needs',
    ],
  },
  {
    slug: 'new-york',
    path: '/locations/new-york',
    title: 'Online Tutoring in New York',
    description:
      'Online tutoring for New York students with support for school assignments, grade-level skills, New York State standards where applicable, Regents, SHSAT, and enrichment.',
    priority: 0.65,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in New York',
    summary:
      'Families in New York can use ICONIC Academy for K-12 academic support, test prep, homework help, and enrichment from home.',
    standards: [
      'New York State Next Generation Learning Standards',
      'Regents support',
      'SHSAT prep',
    ],
    support: [
      'Math, ELA, science, reading, and writing',
      'State test preparation',
      'Enrichment and advanced challenge',
    ],
  },
  {
    slug: 'new-jersey',
    path: '/locations/new-jersey',
    title: 'Online Tutoring in New Jersey',
    description:
      'Online tutoring for New Jersey students with curriculum-aware homework help, test prep, enrichment, and support connected to New Jersey Student Learning Standards where applicable.',
    priority: 0.65,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in New Jersey',
    summary:
      'ICONIC Academy helps New Jersey families find flexible K-12 tutoring, homework support, test prep, and enrichment programs online.',
    standards: [
      'New Jersey Student Learning Standards',
      'State test preparation',
      'School-specific goals',
    ],
    support: [
      'Core academic tutoring',
      'Reading, writing, and math foundations',
      'Advanced and enrichment programs',
    ],
  },
  {
    slug: 'california',
    path: '/locations/california',
    title: 'Online Tutoring in California',
    description:
      'Online tutoring for California students with flexible scheduling, experienced tutors, enrichment, and support connected to California Common Core standards where applicable.',
    priority: 0.65,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in California',
    summary:
      'ICONIC Academy supports California K-12 learners with online tutoring, school-aligned help, test prep, and enrichment programs.',
    standards: [
      'California Common Core State Standards',
      'School assignments',
      'Grade-level readiness',
    ],
    support: [
      'Math, ELA, science, reading, and writing',
      'Flexible online sessions',
      'Coding, debate, chess, art, and music enrichment',
    ],
  },
  {
    slug: 'texas',
    path: '/locations/texas',
    title: 'Online Tutoring in Texas',
    description:
      'Online tutoring for Texas students with homework help, test prep, enrichment, and curriculum-aware support connected to Texas TEKS where applicable.',
    priority: 0.65,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Texas',
    summary:
      'Families in Texas can use ICONIC Academy for online academic support, test prep, homework help, and enrichment programs.',
    standards: ['Texas TEKS', 'State test preparation', 'School-specific goals'],
    support: [
      'Core academic tutoring',
      'Test prep and study skills',
      'Future-ready enrichment programs',
    ],
  },
  {
    slug: 'florida',
    path: '/locations/florida',
    title: 'Online Tutoring in Florida',
    description:
      'Online tutoring for Florida students with experienced tutors, homework help, test prep, enrichment, and support connected to Florida B.E.S.T. Standards where applicable.',
    priority: 0.65,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Florida',
    summary:
      'ICONIC Academy helps Florida families access online tutoring, curriculum-aware support, flexible scheduling, and enrichment programs.',
    standards: [
      'Florida B.E.S.T. Standards',
      'State test preparation',
      'Grade-level skills',
    ],
    support: [
      'Math, ELA, science, reading, and writing',
      'Homework help and test prep',
      'Coding, robotics, debate, and creative enrichment',
    ],
  },
];

export function findProgramLandingPage(slug: string) {
  return PROGRAM_LANDING_PAGES.find((page) => page.slug === slug) ?? null;
}

export function findLocationLandingPage(slug: string) {
  return LOCATION_LANDING_PAGES.find((page) => page.slug === slug) ?? null;
}

export function allPublicSeoPages() {
  return [
    ...PUBLIC_MARKETING_PAGES,
    ...PROGRAM_LANDING_PAGES,
    ...LOCATION_LANDING_PAGES,
    {
      path: '/regions/global-online',
      title: 'Global Online Programs',
      description:
        'Explore ICONIC Academy online-first tutoring and enrichment programs for families across time zones and global communities.',
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    },
  ];
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'EducationalOrganization'],
    '@id': absoluteUrl('/#organization'),
    name: BRAND_NAME,
    url: absoluteUrl('/'),
    email: CONTACT_EMAIL,
    description: BRAND_POSITIONING,
    areaServed: [
      { '@type': 'Country', name: 'United States' },
      { '@type': 'Place', name: 'Global online communities' },
    ],
    sameAs: [
      'https://apps.apple.com/us/app/iconic-academy/id6762158186',
      'https://play.google.com/store/apps/details?id=com.heidisoft.iconicedu',
    ],
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: BRAND_NAME,
    url: absoluteUrl('/'),
    publisher: { '@id': absoluteUrl('/#organization') },
    inLanguage: 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: absoluteUrl('/subjects?query={search_term_string}'),
      'query-input': 'required name=search_term_string',
    },
  };
}

export function webPageJsonLd(page: PublicPageSeo) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': absoluteUrl(`${page.path}#webpage`),
    url: absoluteUrl(page.path),
    name: page.title,
    description: page.description,
    isPartOf: { '@id': absoluteUrl('/#website') },
    about: { '@id': absoluteUrl('/#organization') },
    inLanguage: 'en-US',
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function serviceJsonLd(page: ProgramLandingPage) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': absoluteUrl(`${page.path}#service`),
    name: page.title,
    description: page.description,
    provider: { '@id': absoluteUrl('/#organization') },
    serviceType: 'Online tutoring and enrichment',
    areaServed: ['United States', 'Global online communities'],
    audience: {
      '@type': 'EducationalAudience',
      educationalRole: 'student',
      audienceType: page.audience,
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Tutoring and enrichment options',
      itemListElement: PROGRAM_CATEGORIES.map((category) => ({
        '@type': 'OfferCatalog',
        name: category.title,
        itemListElement: category.subjects.map((subject) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Course',
            name: `${subject} online tutoring`,
          },
        })),
      })),
    },
  };
}

export function courseJsonLd(page: ProgramLandingPage) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': absoluteUrl(`${page.path}#course`),
    name: page.title,
    description: page.description,
    provider: {
      '@type': 'EducationalOrganization',
      name: BRAND_NAME,
      sameAs: absoluteUrl('/'),
    },
    educationalLevel: 'K-12',
    teaches: page.relatedSubjects,
    courseMode: 'online',
  };
}

export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: MARKETING_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
