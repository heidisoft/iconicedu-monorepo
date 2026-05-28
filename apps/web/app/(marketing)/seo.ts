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
  keywords?: readonly string[];
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
  exams: readonly string[];
  support: readonly string[];
  audience: string;
  relatedLocations?: readonly {
    label: string;
    href: string;
  }[];
};

type UsStateLocationConfig = {
  name: string;
  slug: string;
  standardsLabel: string;
  assessmentLabel: string;
  departmentLabel: string;
  cityKeyword?: string;
  parentSearchFocus?: readonly string[];
};

const PUBLIC_PRIVATE_SCHOOL_SUPPORT =
  'Public, charter, private, and homeschool support connected to the learner’s school goals where applicable';

const US_STATE_RELATED_LOCATIONS = [
  { label: 'USA tutoring', href: '/locations/usa' },
  { label: 'U.S. curriculum support', href: '/programs/us-curriculum-support' },
  { label: 'Online tutoring', href: '/programs/online-tutoring' },
] as const;

function createUsStateLocationPage(config: UsStateLocationConfig): LocationLandingPage {
  const localKeyword = config.cityKeyword ? [`${config.cityKeyword} online tutor`] : [];
  const parentSearchFocus = config.parentSearchFocus ?? [
    `${config.assessmentLabel} practice`,
    'Gifted, magnet, honors, and accelerated program readiness where available',
    'Private school entrance, ISEE/SSAT, SAT/ACT, and AP support where applicable',
  ];

  return {
    slug: config.slug,
    path: `/locations/${config.slug}`,
    title: `Online Tutoring in ${config.name}`,
    description: `Online tutoring for ${config.name} students with ${config.departmentLabel} and ${config.standardsLabel} awareness, public and private school homework support, state assessment readiness, test prep, and enrichment.`,
    priority: 0.58,
    changeFrequency: 'monthly',
    h1: `Online tutoring for students in ${config.name}`,
    summary: `ICONIC Academy helps ${config.name} families find flexible online tutoring for public school, private school, charter school, homeschool, and enrichment goals from home.`,
    keywords: [
      `online tutoring ${config.name}`,
      `${config.name} tutor`,
      `${config.name} DOE tutoring`,
      `${config.standardsLabel} tutoring`,
      `${config.assessmentLabel} tutoring`,
      ...parentSearchFocus.map((focus) => `${config.name} ${focus} tutoring`),
      ...localKeyword,
    ],
    standards: [
      config.departmentLabel,
      config.standardsLabel,
      PUBLIC_PRIVATE_SCHOOL_SUPPORT,
    ],
    exams: [
      config.assessmentLabel,
      ...parentSearchFocus,
      'SAT and ACT support',
      'AP support',
      'ISEE and SSAT support for private school goals where applicable',
    ],
    support: [
      'Math, English language arts, reading, writing, science, and study skills',
      'Homework help for public, private, charter, and homeschool students',
      'State assessment readiness, classroom test review, and enrichment',
      ...parentSearchFocus,
    ],
    audience: `${config.name} families looking for curriculum-aware online tutoring that can connect to state education standards, local district expectations, private school assignments, and learner-specific goals where applicable.`,
    relatedLocations: US_STATE_RELATED_LOCATIONS,
  };
}

const ADDITIONAL_US_STATE_LOCATION_PAGES: LocationLandingPage[] = [
  {
    name: 'Alabama',
    slug: 'alabama',
    departmentLabel: 'Alabama State Department of Education guidance',
    standardsLabel: 'Alabama Course of Study standards',
    assessmentLabel: 'Alabama Comprehensive Assessment Program readiness',
    cityKeyword: 'Birmingham',
  },
  {
    name: 'Alaska',
    slug: 'alaska',
    departmentLabel: 'Alaska Department of Education and Early Development guidance',
    standardsLabel: 'Alaska standards-aligned learning goals',
    assessmentLabel: 'Alaska System of Academic Readiness practice',
    cityKeyword: 'Anchorage',
  },
  {
    name: 'Arizona',
    slug: 'arizona',
    departmentLabel: 'Arizona Department of Education guidance',
    standardsLabel: 'Arizona Academic Standards',
    assessmentLabel: 'Arizona statewide assessment readiness',
    cityKeyword: 'Phoenix',
  },
  {
    name: 'Arkansas',
    slug: 'arkansas',
    departmentLabel: 'Arkansas Department of Education guidance',
    standardsLabel: 'Arkansas Academic Standards',
    assessmentLabel: 'Arkansas state assessment readiness',
    cityKeyword: 'Little Rock',
  },
  {
    name: 'Colorado',
    slug: 'colorado',
    departmentLabel: 'Colorado Department of Education guidance',
    standardsLabel: 'Colorado Academic Standards',
    assessmentLabel: 'CMAS and PSAT/SAT readiness where applicable',
    cityKeyword: 'Denver',
  },
  {
    name: 'Connecticut',
    slug: 'connecticut',
    departmentLabel: 'Connecticut State Department of Education guidance',
    standardsLabel: 'Connecticut Core Standards and state frameworks',
    assessmentLabel: 'Connecticut state assessment readiness',
    cityKeyword: 'Hartford',
  },
  {
    name: 'Delaware',
    slug: 'delaware',
    departmentLabel: 'Delaware Department of Education guidance',
    standardsLabel: 'Delaware state standards',
    assessmentLabel: 'Delaware System of Student Assessments readiness',
    cityKeyword: 'Wilmington',
  },
  {
    name: 'Georgia',
    slug: 'georgia',
    departmentLabel: 'Georgia Department of Education guidance',
    standardsLabel: 'Georgia Standards of Excellence',
    assessmentLabel: 'Georgia Milestones readiness',
    cityKeyword: 'Atlanta',
  },
  {
    name: 'Hawaii',
    slug: 'hawaii',
    departmentLabel: 'Hawaii State Department of Education guidance',
    standardsLabel: 'Hawaii Core Standards and state learning expectations',
    assessmentLabel: 'Smarter Balanced assessment readiness',
    cityKeyword: 'Honolulu',
  },
  {
    name: 'Idaho',
    slug: 'idaho',
    departmentLabel: 'Idaho State Department of Education guidance',
    standardsLabel: 'Idaho Content Standards',
    assessmentLabel: 'Idaho Standards Achievement Test readiness',
    cityKeyword: 'Boise',
  },
  {
    name: 'Illinois',
    slug: 'illinois',
    departmentLabel: 'Illinois State Board of Education guidance',
    standardsLabel: 'Illinois Learning Standards',
    assessmentLabel:
      'Illinois Assessment of Readiness and SAT readiness where applicable',
    cityKeyword: 'Chicago',
  },
  {
    name: 'Indiana',
    slug: 'indiana',
    departmentLabel: 'Indiana Department of Education guidance',
    standardsLabel: 'Indiana Academic Standards',
    assessmentLabel: 'ILEARN and SAT readiness where applicable',
    cityKeyword: 'Indianapolis',
  },
  {
    name: 'Iowa',
    slug: 'iowa',
    departmentLabel: 'Iowa Department of Education guidance',
    standardsLabel: 'Iowa Core standards',
    assessmentLabel: 'Iowa Statewide Assessment of Student Progress readiness',
    cityKeyword: 'Des Moines',
  },
  {
    name: 'Kansas',
    slug: 'kansas',
    departmentLabel: 'Kansas State Department of Education guidance',
    standardsLabel: 'Kansas College and Career Ready Standards',
    assessmentLabel: 'Kansas Assessment Program readiness',
    cityKeyword: 'Wichita',
  },
  {
    name: 'Kentucky',
    slug: 'kentucky',
    departmentLabel: 'Kentucky Department of Education guidance',
    standardsLabel: 'Kentucky Academic Standards',
    assessmentLabel: 'Kentucky Summative Assessment readiness',
    cityKeyword: 'Louisville',
  },
  {
    name: 'Louisiana',
    slug: 'louisiana',
    departmentLabel: 'Louisiana Department of Education guidance',
    standardsLabel: 'Louisiana Student Standards',
    assessmentLabel: 'LEAP readiness',
    cityKeyword: 'New Orleans',
  },
  {
    name: 'Maine',
    slug: 'maine',
    departmentLabel: 'Maine Department of Education guidance',
    standardsLabel: 'Maine Learning Results',
    assessmentLabel: 'Maine state assessment readiness',
    cityKeyword: 'Portland Maine',
  },
  {
    name: 'Maryland',
    slug: 'maryland',
    departmentLabel: 'Maryland State Department of Education guidance',
    standardsLabel: 'Maryland College and Career Ready Standards',
    assessmentLabel: 'MCAP readiness',
    cityKeyword: 'Baltimore',
  },
  {
    name: 'Massachusetts',
    slug: 'massachusetts',
    departmentLabel:
      'Massachusetts Department of Elementary and Secondary Education guidance',
    standardsLabel: 'Massachusetts Curriculum Frameworks',
    assessmentLabel: 'MCAS readiness',
    cityKeyword: 'Boston',
  },
  {
    name: 'Michigan',
    slug: 'michigan',
    departmentLabel: 'Michigan Department of Education guidance',
    standardsLabel: 'Michigan Academic Standards',
    assessmentLabel: 'M-STEP, PSAT, and SAT readiness where applicable',
    cityKeyword: 'Detroit',
  },
  {
    name: 'Minnesota',
    slug: 'minnesota',
    departmentLabel: 'Minnesota Department of Education guidance',
    standardsLabel: 'Minnesota Academic Standards',
    assessmentLabel: 'Minnesota Comprehensive Assessments readiness',
    cityKeyword: 'Minneapolis',
  },
  {
    name: 'Mississippi',
    slug: 'mississippi',
    departmentLabel: 'Mississippi Department of Education guidance',
    standardsLabel: 'Mississippi College- and Career-Readiness Standards',
    assessmentLabel: 'Mississippi Academic Assessment Program readiness',
    cityKeyword: 'Jackson',
  },
  {
    name: 'Missouri',
    slug: 'missouri',
    departmentLabel: 'Missouri Department of Elementary and Secondary Education guidance',
    standardsLabel: 'Missouri Learning Standards',
    assessmentLabel: 'Missouri Assessment Program readiness',
    cityKeyword: 'St. Louis',
  },
  {
    name: 'Montana',
    slug: 'montana',
    departmentLabel: 'Montana Office of Public Instruction guidance',
    standardsLabel: 'Montana Content Standards',
    assessmentLabel: 'Montana state assessment readiness',
    cityKeyword: 'Billings',
  },
  {
    name: 'Nebraska',
    slug: 'nebraska',
    departmentLabel: 'Nebraska Department of Education guidance',
    standardsLabel: 'Nebraska College and Career Ready Standards',
    assessmentLabel: 'NSCAS readiness',
    cityKeyword: 'Omaha',
  },
  {
    name: 'Nevada',
    slug: 'nevada',
    departmentLabel: 'Nevada Department of Education guidance',
    standardsLabel: 'Nevada Academic Content Standards',
    assessmentLabel: 'Smarter Balanced and end-of-course readiness where applicable',
    cityKeyword: 'Las Vegas',
  },
  {
    name: 'New Hampshire',
    slug: 'new-hampshire',
    departmentLabel: 'New Hampshire Department of Education guidance',
    standardsLabel: 'New Hampshire College and Career Ready Standards',
    assessmentLabel: 'SAS and PSAT/SAT readiness where applicable',
    cityKeyword: 'Manchester',
  },
  {
    name: 'New Mexico',
    slug: 'new-mexico',
    departmentLabel: 'New Mexico Public Education Department guidance',
    standardsLabel: 'New Mexico state standards',
    assessmentLabel: 'New Mexico Measures of Student Success and Achievement readiness',
    cityKeyword: 'Albuquerque',
  },
  {
    name: 'North Carolina',
    slug: 'north-carolina',
    departmentLabel: 'North Carolina Department of Public Instruction guidance',
    standardsLabel: 'North Carolina Standard Course of Study',
    assessmentLabel: 'End-of-grade and end-of-course test readiness',
    cityKeyword: 'Charlotte',
  },
  {
    name: 'North Dakota',
    slug: 'north-dakota',
    departmentLabel: 'North Dakota Department of Public Instruction guidance',
    standardsLabel: 'North Dakota Content Standards',
    assessmentLabel: 'North Dakota state assessment readiness',
    cityKeyword: 'Fargo',
  },
  {
    name: 'Ohio',
    slug: 'ohio',
    departmentLabel: 'Ohio Department of Education and Workforce guidance',
    standardsLabel: 'Ohio Learning Standards',
    assessmentLabel: 'Ohio State Tests readiness',
    cityKeyword: 'Columbus',
  },
  {
    name: 'Oklahoma',
    slug: 'oklahoma',
    departmentLabel: 'Oklahoma State Department of Education guidance',
    standardsLabel: 'Oklahoma Academic Standards',
    assessmentLabel: 'Oklahoma School Testing Program readiness',
    cityKeyword: 'Oklahoma City',
  },
  {
    name: 'Oregon',
    slug: 'oregon',
    departmentLabel: 'Oregon Department of Education guidance',
    standardsLabel: 'Oregon state standards',
    assessmentLabel: 'Oregon Statewide Assessment System readiness',
    cityKeyword: 'Portland Oregon',
  },
  {
    name: 'Pennsylvania',
    slug: 'pennsylvania',
    departmentLabel: 'Pennsylvania Department of Education guidance',
    standardsLabel: 'Pennsylvania Academic Standards',
    assessmentLabel: 'PSSA and Keystone Exam readiness',
    cityKeyword: 'Philadelphia',
  },
  {
    name: 'Rhode Island',
    slug: 'rhode-island',
    departmentLabel: 'Rhode Island Department of Education guidance',
    standardsLabel: 'Rhode Island state standards',
    assessmentLabel: 'RICAS and PSAT/SAT readiness where applicable',
    cityKeyword: 'Providence',
  },
  {
    name: 'South Carolina',
    slug: 'south-carolina',
    departmentLabel: 'South Carolina Department of Education guidance',
    standardsLabel: 'South Carolina College- and Career-Ready Standards',
    assessmentLabel: 'SC READY and end-of-course readiness',
    cityKeyword: 'Charleston',
  },
  {
    name: 'South Dakota',
    slug: 'south-dakota',
    departmentLabel: 'South Dakota Department of Education guidance',
    standardsLabel: 'South Dakota Content Standards',
    assessmentLabel: 'South Dakota state assessment readiness',
    cityKeyword: 'Sioux Falls',
  },
  {
    name: 'Tennessee',
    slug: 'tennessee',
    departmentLabel: 'Tennessee Department of Education guidance',
    standardsLabel: 'Tennessee Academic Standards',
    assessmentLabel: 'TCAP and end-of-course readiness',
    cityKeyword: 'Nashville',
  },
  {
    name: 'Utah',
    slug: 'utah',
    departmentLabel: 'Utah State Board of Education guidance',
    standardsLabel: 'Utah Core Standards',
    assessmentLabel: 'Utah state assessment readiness',
    cityKeyword: 'Salt Lake City',
  },
  {
    name: 'Vermont',
    slug: 'vermont',
    departmentLabel: 'Vermont Agency of Education guidance',
    standardsLabel: 'Vermont state standards',
    assessmentLabel: 'Vermont state assessment readiness',
    cityKeyword: 'Burlington',
  },
  {
    name: 'Virginia',
    slug: 'virginia',
    departmentLabel: 'Virginia Department of Education guidance',
    standardsLabel: 'Virginia Standards of Learning',
    assessmentLabel: 'SOL test readiness',
    cityKeyword: 'Northern Virginia',
  },
  {
    name: 'Washington',
    slug: 'washington',
    departmentLabel: 'Washington Office of Superintendent of Public Instruction guidance',
    standardsLabel: 'Washington State Learning Standards',
    assessmentLabel: 'Smarter Balanced and WCAS readiness where applicable',
    cityKeyword: 'Seattle',
  },
  {
    name: 'West Virginia',
    slug: 'west-virginia',
    departmentLabel: 'West Virginia Department of Education guidance',
    standardsLabel: 'West Virginia College- and Career-Readiness Standards',
    assessmentLabel: 'West Virginia General Summative Assessment readiness',
    cityKeyword: 'Charleston WV',
  },
  {
    name: 'Wisconsin',
    slug: 'wisconsin',
    departmentLabel: 'Wisconsin Department of Public Instruction guidance',
    standardsLabel: 'Wisconsin Academic Standards',
    assessmentLabel: 'Forward Exam and ACT readiness where applicable',
    cityKeyword: 'Milwaukee',
  },
  {
    name: 'Wyoming',
    slug: 'wyoming',
    departmentLabel: 'Wyoming Department of Education guidance',
    standardsLabel: 'Wyoming Content and Performance Standards',
    assessmentLabel: 'WY-TOPP readiness',
    cityKeyword: 'Cheyenne',
  },
].map(createUsStateLocationPage);

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
  const keywords = [...new Set([...DEFAULT_KEYWORDS, ...(page.keywords ?? [])])];

  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description: page.description,
    keywords,
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
    path: '/programs',
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
    title: 'U.S. Curriculum, DOE, and State Standards Support',
    description:
      'Curriculum-aware online tutoring for U.S. students with support connected to state DOE standards, public and private school assignments, state exams, homework, and grade-level skills.',
    priority: 0.85,
    changeFrequency: 'monthly',
    h1: 'U.S. curriculum, DOE, and school-aligned tutoring support',
    summary:
      'ICONIC Academy supports families across the United States with tutoring that can connect to state standards, local DOE expectations, public school assignments, private school goals, charter programs, homeschool plans, and test preparation where applicable.',
    audience:
      'Families in public, private, charter, and homeschool settings who want tutoring connected to school goals and grade-level expectations.',
    support: [
      ...US_CURRICULUM_STANDARDS,
      'State DOE and district expectations where applicable',
      'Public, private, charter, and homeschool assignment support',
      'School-specific goals and assignment support',
    ],
    outcomes: [
      'Better school alignment',
      'Clearer parent understanding',
      'More targeted tutoring',
    ],
    relatedSubjects: [
      'State Standards',
      'DOE Expectations',
      'Public School Support',
      'Private School Support',
      'Homework Help',
      'Test Prep',
      'Core Academics',
    ],
  },
  {
    slug: 'australia-curriculum-naplan-atar-support',
    path: '/programs/australia-curriculum-naplan-atar-support',
    title: 'Australian Curriculum, NAPLAN, and ATAR Support',
    description:
      'Online tutoring for Australian students with Australian Curriculum support, NAPLAN practice, ATAR pathway awareness, HSC, VCE, QCE, WACE, SACE, homework help, and enrichment.',
    keywords: [
      'Australian Curriculum tutoring',
      'NAPLAN tutoring',
      'ATAR tutoring',
      'HSC tutoring',
      'VCE tutoring',
      'QCE tutoring',
      'WACE tutoring',
      'SACE tutoring',
    ],
    priority: 0.78,
    changeFrequency: 'monthly',
    h1: 'Australian Curriculum, NAPLAN, and senior pathway tutoring',
    summary:
      'ICONIC Academy helps Australian families connect online tutoring to classroom goals, NAPLAN readiness, state syllabus expectations, senior secondary pathways, and confident study habits.',
    audience:
      'Australian families looking for Maths, English, science, homework, NAPLAN, HSC, VCE, QCE, WACE, SACE, or ATAR-aware support.',
    support: [
      'Australian Curriculum and state syllabus awareness where applicable',
      'NAPLAN practice for reading, writing, language conventions, and numeracy',
      'Senior pathway support for HSC, VCE, QCE, WACE, SACE, and ATAR goals',
      'Parent-visible homework help, study planning, and enrichment',
    ],
    outcomes: [
      'Stronger school foundations',
      'More confident assessment preparation',
      'Clearer parent understanding of next steps',
    ],
    relatedSubjects: ['Australian Curriculum', 'NAPLAN', 'ATAR', 'HSC', 'VCE', 'QCE'],
  },
  {
    slug: 'uk-curriculum-gcse-a-level-support',
    path: '/programs/uk-curriculum-gcse-a-level-support',
    title: 'UK Curriculum, GCSE, and A Level Support',
    description:
      'Online tutoring for UK students with National Curriculum, Key Stage, SATs, 11 plus, GCSE, IGCSE, and A Level support across Maths, English, science, and writing.',
    keywords: [
      'UK curriculum tutoring',
      'GCSE tutoring',
      'IGCSE tutoring',
      'A Level tutoring',
      '11 plus tutoring',
      'Key Stage tutoring',
    ],
    priority: 0.78,
    changeFrequency: 'monthly',
    h1: 'UK curriculum tutoring for Key Stages, GCSEs, and A Levels',
    summary:
      'ICONIC Academy supports UK families with online tutoring shaped around school goals, Key Stage progress, admissions preparation, GCSE and IGCSE study, A Level readiness, and parent communication.',
    audience:
      'UK families looking for Maths, English, science, SATs, 11+, GCSE, IGCSE, A Level, homework, or exam-board-aware support.',
    support: [
      'National Curriculum and Key Stage awareness where applicable',
      'SATs, 11+, GCSE, IGCSE, and A Level practice',
      'Maths, English, science, reading, writing, and study-skills tutoring',
      'Native English-speaking tutor options where language fluency matters',
    ],
    outcomes: [
      'Clearer exam preparation',
      'More confident homework routines',
      'Better alignment between tutoring and school expectations',
    ],
    relatedSubjects: [
      'National Curriculum',
      'Key Stages',
      'SATs',
      '11+',
      'GCSE',
      'A Levels',
    ],
  },
  {
    slug: 'new-zealand-ncea-curriculum-support',
    path: '/programs/new-zealand-ncea-curriculum-support',
    title: 'New Zealand Curriculum and NCEA Support',
    description:
      'Online tutoring for New Zealand students with New Zealand Curriculum support, NCEA Levels 1-3, NZ Scholarship, homework help, study skills, and enrichment.',
    keywords: [
      'New Zealand Curriculum tutoring',
      'NCEA tutoring',
      'NCEA Level 1 tutoring',
      'NCEA Level 2 tutoring',
      'NCEA Level 3 tutoring',
      'NZ Scholarship tutoring',
    ],
    priority: 0.7,
    changeFrequency: 'monthly',
    h1: 'New Zealand Curriculum and NCEA tutoring support',
    summary:
      'ICONIC Academy helps New Zealand families connect online tutoring to school assignments, New Zealand Curriculum goals, NCEA preparation, senior subject confidence, and enrichment.',
    audience:
      'New Zealand families looking for Maths, English, science, NCEA Levels 1-3, NZ Scholarship, homework, or study planning support.',
    support: [
      'New Zealand Curriculum awareness where applicable',
      'NCEA Levels 1-3 and NZ Scholarship preparation',
      'Maths, English, science, writing, homework, and study skills',
      'Flexible online sessions across New Zealand time zones',
    ],
    outcomes: [
      'More organized study habits',
      'Stronger subject confidence',
      'Clearer parent visibility around progress',
    ],
    relatedSubjects: [
      'New Zealand Curriculum',
      'NCEA Level 1',
      'NCEA Level 2',
      'NCEA Level 3',
      'NZ Scholarship',
    ],
  },
  {
    slug: 'italy-school-invalsi-maturita-support',
    path: '/programs/italy-school-invalsi-maturita-support',
    title: 'Italy School, INVALSI, and Maturita Support',
    description:
      'Online tutoring for students in Italy with primary and secondary school support, INVALSI readiness, Esame di Stato or maturita preparation, English, maths, science, and writing tutoring.',
    keywords: [
      'Italy online tutoring',
      'INVALSI tutoring',
      'maturita tutoring',
      'Esame di Stato tutoring',
      'English tutor Italy',
      'maths tutor Italy',
    ],
    priority: 0.66,
    changeFrequency: 'monthly',
    h1: 'Online school support for students in Italy',
    summary:
      'ICONIC Academy supports families in Italy with tutoring for school confidence, English language development, maths, science, INVALSI practice, Esame di Stato or maturita readiness, and international curriculum goals where applicable.',
    audience:
      'Families in Italy looking for English, maths, science, homework, INVALSI, maturita, or international school support.',
    support: [
      'Primary and secondary school assignment support',
      'INVALSI and Esame di Stato / maturita readiness',
      'English language development, reading, writing, maths, and science',
      'International curriculum support where applicable',
    ],
    outcomes: [
      'Stronger academic English and subject confidence',
      'Better routines for homework and revision',
      'More focused exam preparation',
    ],
    relatedSubjects: [
      'INVALSI',
      'Esame di Stato',
      'Maturita',
      'English',
      'Maths',
      'Science',
    ],
  },
  {
    slug: 'uae-curriculum-emsat-igcse-support',
    path: '/programs/uae-curriculum-emsat-igcse-support',
    title: 'UAE Curriculum, EmSAT, IGCSE, and International School Support',
    description:
      'Online tutoring for UAE students with MoE, British, IB, American, and CBSE pathway support plus EmSAT, IGCSE, A Level, SAT, IELTS, TOEFL, and homework help.',
    keywords: [
      'UAE online tutoring',
      'Dubai online tutor',
      'EmSAT tutoring',
      'IGCSE tutor UAE',
      'A Level tutor UAE',
      'CBSE tutor UAE',
    ],
    priority: 0.72,
    changeFrequency: 'monthly',
    h1: 'UAE curriculum and international school tutoring support',
    summary:
      'ICONIC Academy helps UAE families navigate national and international school pathways with online tutoring for homework, exams, English fluency, STEM, and study planning.',
    audience:
      'UAE families comparing support for MoE, British, IB, American, CBSE, EmSAT, IGCSE, A Level, SAT, IELTS, or TOEFL goals.',
    support: [
      'UAE MoE curriculum support where applicable',
      'British, IB, American, and CBSE pathway support',
      'EmSAT, IGCSE, A Level, SAT, IELTS, TOEFL, and IB assessment preparation',
      'Maths, English, science, writing, homework help, and enrichment',
    ],
    outcomes: [
      'Clearer pathway planning',
      'Better exam-readiness routines',
      'More confident school and English-language support',
    ],
    relatedSubjects: ['MoE Curriculum', 'EmSAT', 'IGCSE', 'A Level', 'IB', 'CBSE'],
  },
  {
    slug: 'canada-provincial-curriculum-eqao-osslt-support',
    path: '/programs/canada-provincial-curriculum-eqao-osslt-support',
    title: 'Canada Provincial Curriculum, EQAO, and OSSLT Support',
    description:
      'Online tutoring for Canadian students with provincial curriculum support, EQAO, OSSLT, BC literacy and numeracy assessments, Alberta PATs, diploma exams, homework help, and enrichment.',
    keywords: [
      'Canada curriculum tutoring',
      'EQAO tutoring',
      'OSSLT tutoring',
      'BC literacy assessment tutoring',
      'Alberta PAT tutoring',
      'Canadian online tutor',
    ],
    priority: 0.76,
    changeFrequency: 'monthly',
    h1: 'Canadian provincial curriculum and assessment tutoring support',
    summary:
      'ICONIC Academy supports Canadian families with online tutoring connected to provincial expectations, classroom assignments, assessment readiness, and flexible parent communication.',
    audience:
      'Canadian families looking for provincial curriculum, EQAO, OSSLT, BC literacy/numeracy, Alberta PATs, diploma exam, homework, or enrichment support.',
    support: [
      'Provincial curriculum expectations where applicable',
      'EQAO, OSSLT, BC literacy and numeracy assessments, Alberta PATs, and diploma exam practice',
      'Math, English, science, reading, writing, and study skills',
      'English and French-language school support where available',
    ],
    outcomes: [
      'Better provincial assessment readiness',
      'Stronger foundations across core subjects',
      'Clearer support for parents across school systems',
    ],
    relatedSubjects: [
      'Provincial Curriculum',
      'EQAO',
      'OSSLT',
      'BC Assessments',
      'Alberta PATs',
    ],
  },
  {
    slug: 'japan-school-english-eiken-support',
    path: '/programs/japan-school-english-eiken-support',
    title: 'Japan School, English, and EIKEN Support',
    description:
      'Online tutoring for students in Japan with Japanese school support, English tutoring, EIKEN preparation, school entrance readiness, international curriculum support, and enrichment.',
    keywords: [
      'Japan online tutoring',
      'EIKEN tutoring',
      'English tutor Japan',
      'Japan entrance exam tutoring',
      'international school tutor Japan',
    ],
    priority: 0.66,
    changeFrequency: 'monthly',
    h1: 'Online English, school, and EIKEN support for students in Japan',
    summary:
      'ICONIC Academy helps families in Japan with online English development, school-subject support, EIKEN preparation, entrance readiness, and international curriculum goals where applicable.',
    audience:
      'Families in Japan looking for English, reading, writing, maths, science, EIKEN, entrance exam readiness, or international school support.',
    support: [
      'Japanese school assignment support where applicable',
      'EIKEN and school entrance readiness',
      'English language development, reading, writing, maths, and science',
      'International curriculum support for globally mobile families',
    ],
    outcomes: [
      'More confident English communication',
      'Stronger school-subject foundations',
      'Better preparation habits for exams and interviews',
    ],
    relatedSubjects: [
      'EIKEN',
      'English',
      'Entrance Exams',
      'Maths',
      'Science',
      'International Curriculum',
    ],
  },
  {
    slug: 'qatar-curriculum-igcse-a-level-support',
    path: '/programs/qatar-curriculum-igcse-a-level-support',
    title: 'Qatar Curriculum, IGCSE, A Level, and International School Support',
    description:
      'Online tutoring for Qatar students with national and international curriculum support including British, IB, American, CBSE, IGCSE, A Level, SAT, IELTS, TOEFL, and homework help.',
    keywords: [
      'Qatar online tutoring',
      'Doha online tutor',
      'IGCSE tutor Qatar',
      'A Level tutor Qatar',
      'CBSE tutor Qatar',
      'IB tutor Qatar',
    ],
    priority: 0.68,
    changeFrequency: 'monthly',
    h1: 'Qatar curriculum and international school tutoring support',
    summary:
      'ICONIC Academy supports Qatar families with online tutoring for national curriculum goals, international school pathways, homework, exam preparation, English fluency, and enrichment.',
    audience:
      'Qatar families looking for support with national curriculum, British, IB, American, CBSE, IGCSE, A Level, SAT, IELTS, TOEFL, or school assignments.',
    support: [
      'Qatar national curriculum support where applicable',
      'British, IB, American, and CBSE pathway support',
      'IGCSE, A Level, SAT, IELTS, TOEFL, and IB assessment preparation',
      'Maths, English, science, writing, homework help, and study planning',
    ],
    outcomes: [
      'Stronger international school readiness',
      'More focused exam preparation',
      'Clearer parent visibility across subjects and pathways',
    ],
    relatedSubjects: ['Qatar Curriculum', 'IGCSE', 'A Level', 'IB', 'CBSE', 'SAT'],
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
    keywords: [
      'online tutoring USA',
      'US curriculum tutoring',
      'state standards tutoring',
      'K-12 tutor United States',
    ],
    standards: US_CURRICULUM_STANDARDS,
    exams: ['State exams', 'SAT', 'ACT', 'AP support', 'ISEE', 'SSAT'],
    support: [
      'USA-based and global tutor options',
      'State standards where applicable',
      PUBLIC_PRIVATE_SCHOOL_SUPPORT,
      'Flexible scheduling for evening, weekend, and time-zone needs',
    ],
    audience:
      'Families in U.S. schools who want online tutoring connected to homework, grade-level expectations, state standards, and test preparation where applicable.',
    relatedLocations: [
      { label: 'New York', href: '/locations/new-york' },
      { label: 'New York City', href: '/locations/new-york-city' },
      { label: 'California', href: '/locations/california' },
      { label: 'Texas', href: '/locations/texas' },
      { label: 'Florida', href: '/locations/florida' },
      { label: 'Massachusetts', href: '/locations/massachusetts' },
      { label: 'Georgia', href: '/locations/georgia' },
      { label: 'Washington', href: '/locations/washington' },
      { label: 'U.S. curriculum support', href: '/programs/us-curriculum-support' },
    ],
  },
  {
    slug: 'new-york',
    path: '/locations/new-york',
    title: 'Online Tutoring in New York',
    description:
      'Online tutoring for New York State students with support for school assignments, grade-level skills, New York State standards, Regents, state tests, and enrichment.',
    priority: 0.65,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students across New York State',
    summary:
      'Families across New York State can use ICONIC Academy for K-12 academic support, Regents readiness, homework help, and enrichment from home.',
    keywords: [
      'online tutoring New York',
      'New York Regents tutoring',
      'New York State standards tutoring',
      'NY state test prep',
    ],
    standards: [
      'New York State Next Generation Learning Standards',
      'New York State learning standards where applicable',
      'School-specific goals and assignments',
      PUBLIC_PRIVATE_SCHOOL_SUPPORT,
    ],
    exams: ['Regents support', 'New York state test preparation', 'SAT and ACT support'],
    support: [
      'Math, ELA, science, reading, and writing',
      'State test preparation',
      'Public, private, charter, and homeschool assignment support where applicable',
      'Enrichment and advanced challenge',
    ],
    audience:
      'New York families looking for curriculum-aware online tutoring beyond one city-specific admissions path.',
    relatedLocations: [
      { label: 'New York City SHSAT prep', href: '/locations/new-york-city' },
      { label: 'USA tutoring', href: '/locations/usa' },
      { label: 'New Jersey', href: '/locations/new-jersey' },
    ],
  },
  {
    slug: 'new-york-city',
    path: '/locations/new-york-city',
    title: 'Online Tutoring in New York City',
    description:
      'Online tutoring for NYC students with SHSAT prep, specialized high school readiness, middle school math and ELA, Regents support where relevant, and enrichment.',
    priority: 0.7,
    changeFrequency: 'monthly',
    h1: 'Online tutoring and SHSAT prep for New York City students',
    summary:
      'ICONIC Academy helps NYC families prepare for specialized high school admissions, strengthen middle school math and ELA, and stay on track with school assignments.',
    keywords: [
      'SHSAT prep online',
      'NYC tutoring',
      'Mark Twain I.S. 239 tutoring',
      'Mark Twain talent test prep',
      'NYC gifted and talented tutoring',
      'specialized high school admissions tutoring',
      'New York City math tutor',
      'NYC ELA tutor',
    ],
    standards: [
      'New York State Next Generation Learning Standards',
      'NYC school assignments and grade-level expectations',
      'Middle school math and ELA foundations',
      PUBLIC_PRIVATE_SCHOOL_SUPPORT,
    ],
    exams: [
      'SHSAT prep',
      'Mark Twain I.S. 239 talent test and audition readiness',
      'NYC gifted and talented middle school readiness',
      'Specialized high school readiness',
      'Regents support where relevant',
      'New York state test preparation',
    ],
    support: [
      'Targeted SHSAT math and verbal practice',
      'Mark Twain I.S. 239 talent areas, audition routines, and portfolio-style preparation where applicable',
      'NYC gifted, honors, screened, and accelerated program readiness',
      'Middle school math, reading, writing, and study habits',
      'Public, charter, private, and independent school assignment support',
      'High school readiness and advanced enrichment',
    ],
    audience:
      'NYC families comparing online support for SHSAT preparation, specialized high school goals, and school-aligned academic help.',
    relatedLocations: [
      { label: 'New York State', href: '/locations/new-york' },
      { label: 'New Jersey', href: '/locations/new-jersey' },
      { label: 'Test prep', href: '/programs/test-prep' },
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
    keywords: [
      'online tutoring New Jersey',
      'New Jersey Student Learning Standards tutoring',
      'New Jersey test prep',
    ],
    standards: [
      'New Jersey Student Learning Standards',
      'School-specific goals',
      PUBLIC_PRIVATE_SCHOOL_SUPPORT,
    ],
    exams: ['State test preparation', 'SAT and ACT support', 'ISEE and SSAT support'],
    support: [
      'Core academic tutoring',
      'Reading, writing, and math foundations',
      'Public, private, charter, and homeschool assignment support where applicable',
      'Advanced and enrichment programs',
    ],
    audience:
      'New Jersey families who want flexible online tutoring connected to school expectations and grade-level skills where applicable.',
    relatedLocations: [
      { label: 'New York City', href: '/locations/new-york-city' },
      { label: 'New York', href: '/locations/new-york' },
      { label: 'USA tutoring', href: '/locations/usa' },
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
    keywords: [
      'online tutoring California',
      'California Common Core tutoring',
      'California math tutor',
      'California ELA tutor',
    ],
    standards: [
      'California Common Core State Standards',
      'School assignments',
      'Grade-level readiness',
      PUBLIC_PRIVATE_SCHOOL_SUPPORT,
    ],
    exams: ['State test preparation', 'SAT and ACT support', 'AP support'],
    support: [
      'Math, ELA, science, reading, and writing',
      'Flexible online sessions',
      'Public, private, charter, and homeschool assignment support where applicable',
      'Coding, debate, chess, art, and music enrichment',
    ],
    audience:
      'California families who want online academic support that can connect to school assignments, grade-level skills, and enrichment.',
    relatedLocations: [
      { label: 'USA tutoring', href: '/locations/usa' },
      { label: 'Texas', href: '/locations/texas' },
      { label: 'Online tutoring', href: '/programs/online-tutoring' },
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
    keywords: ['online tutoring Texas', 'Texas TEKS tutoring', 'STAAR tutoring'],
    standards: [
      'Texas TEKS',
      'School-specific goals',
      'Grade-level readiness',
      PUBLIC_PRIVATE_SCHOOL_SUPPORT,
    ],
    exams: [
      'State test preparation',
      'STAAR-aligned practice where applicable',
      'SAT and ACT support',
    ],
    support: [
      'Core academic tutoring',
      'Test prep and study skills',
      'Public, private, charter, and homeschool assignment support where applicable',
      'Future-ready enrichment programs',
    ],
    audience:
      'Texas families looking for online tutoring connected to TEKS, school assignments, and test readiness where applicable.',
    relatedLocations: [
      { label: 'USA tutoring', href: '/locations/usa' },
      { label: 'Florida', href: '/locations/florida' },
      { label: 'California', href: '/locations/california' },
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
    keywords: [
      'online tutoring Florida',
      'Florida B.E.S.T. Standards tutoring',
      'Florida test prep',
    ],
    standards: [
      'Florida B.E.S.T. Standards',
      'Grade-level skills',
      PUBLIC_PRIVATE_SCHOOL_SUPPORT,
    ],
    exams: ['State test preparation', 'SAT and ACT support', 'AP support'],
    support: [
      'Math, ELA, science, reading, and writing',
      'Homework help and test prep',
      'Public, private, charter, and homeschool assignment support where applicable',
      'Coding, robotics, debate, and creative enrichment',
    ],
    audience:
      'Florida families who want online tutoring that can connect to school work, B.E.S.T. Standards, and flexible scheduling.',
    relatedLocations: [
      { label: 'USA tutoring', href: '/locations/usa' },
      { label: 'Texas', href: '/locations/texas' },
      { label: 'Online tutoring', href: '/programs/online-tutoring' },
    ],
  },
  ...ADDITIONAL_US_STATE_LOCATION_PAGES,
  {
    slug: 'australia',
    path: '/locations/australia',
    title: 'Online Tutoring in Australia',
    description:
      'Online tutoring for Australian students with Australian Curriculum support, NAPLAN practice, ATAR pathway awareness, HSC, VCE, QCE, WACE, SACE, and enrichment.',
    priority: 0.75,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students across Australia',
    summary:
      'ICONIC Academy supports Australian families with live online tutoring for school confidence, homework, NAPLAN readiness, senior pathway preparation, and enrichment.',
    keywords: [
      'online tutoring Australia',
      'Australian Curriculum tutoring',
      'NAPLAN tutoring',
      'ATAR tutoring',
      'HSC VCE QCE WACE SACE tutoring',
    ],
    standards: [
      'Australian Curriculum',
      'State and territory syllabus expectations where applicable',
      'School-specific goals and assignments',
    ],
    exams: ['NAPLAN', 'ATAR pathway support', 'HSC', 'VCE', 'QCE', 'WACE', 'SACE'],
    support: [
      'Maths, English, science, reading, and writing',
      'Homework help, study skills, and exam practice',
      'Flexible scheduling across Australian time zones',
    ],
    audience:
      'Australian families who want online tutoring connected to classroom expectations, NAPLAN, and senior secondary pathways where applicable.',
    relatedLocations: [
      { label: 'New South Wales', href: '/locations/new-south-wales' },
      { label: 'Victoria', href: '/locations/victoria' },
      { label: 'Queensland', href: '/locations/queensland' },
      { label: 'Western Australia', href: '/locations/western-australia' },
      { label: 'South Australia', href: '/locations/south-australia' },
    ],
  },
  {
    slug: 'new-south-wales',
    path: '/locations/new-south-wales',
    title: 'Online Tutoring in New South Wales',
    description:
      'Online tutoring for NSW students with Australian Curriculum awareness, NSW syllabus support, NAPLAN practice, HSC readiness, homework help, and enrichment.',
    priority: 0.62,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in New South Wales',
    summary:
      'Families in NSW can use ICONIC Academy for curriculum-aware tutoring, homework support, HSC preparation, NAPLAN readiness, and enrichment from home.',
    keywords: [
      'online tutoring NSW',
      'HSC tutoring',
      'NAPLAN tutor NSW',
      'Sydney online tutor',
    ],
    standards: [
      'Australian Curriculum',
      'NSW syllabus support where applicable',
      'School-specific goals',
    ],
    exams: ['NAPLAN', 'HSC', 'ATAR pathway support'],
    support: [
      'Maths and English foundations',
      'Science and senior subject support',
      'Study planning and exam practice',
    ],
    audience:
      'NSW families looking for online tutoring connected to school assignments, NAPLAN, and HSC goals where applicable.',
    relatedLocations: [
      { label: 'Australia', href: '/locations/australia' },
      { label: 'Victoria', href: '/locations/victoria' },
      { label: 'Queensland', href: '/locations/queensland' },
    ],
  },
  {
    slug: 'victoria',
    path: '/locations/victoria',
    title: 'Online Tutoring in Victoria',
    description:
      'Online tutoring for Victorian students with Australian Curriculum awareness, Victorian curriculum support, NAPLAN practice, VCE readiness, homework help, and enrichment.',
    priority: 0.62,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Victoria',
    summary:
      'ICONIC Academy helps Victorian families with online Maths, English, science, homework help, NAPLAN practice, VCE support, and enrichment.',
    keywords: [
      'online tutoring Victoria',
      'VCE tutoring',
      'NAPLAN tutor Victoria',
      'Melbourne online tutor',
    ],
    standards: [
      'Australian Curriculum',
      'Victorian curriculum support where applicable',
      'School-specific goals',
    ],
    exams: ['NAPLAN', 'VCE', 'ATAR pathway support'],
    support: [
      'Maths, English, and science tutoring',
      'Homework routines and study skills',
      'Senior subject readiness',
    ],
    audience:
      'Victorian families who want flexible online tutoring connected to school goals, NAPLAN, and VCE preparation where applicable.',
    relatedLocations: [
      { label: 'Australia', href: '/locations/australia' },
      { label: 'New South Wales', href: '/locations/new-south-wales' },
      { label: 'South Australia', href: '/locations/south-australia' },
    ],
  },
  {
    slug: 'queensland',
    path: '/locations/queensland',
    title: 'Online Tutoring in Queensland',
    description:
      'Online tutoring for Queensland students with Australian Curriculum awareness, QCAA/QCE pathway support, NAPLAN practice, homework help, and enrichment.',
    priority: 0.62,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Queensland',
    summary:
      'Queensland families can find online academic support for school assignments, NAPLAN practice, QCE readiness, study skills, and enrichment.',
    keywords: [
      'online tutoring Queensland',
      'QCE tutoring',
      'NAPLAN tutor Queensland',
      'Brisbane online tutor',
    ],
    standards: [
      'Australian Curriculum',
      'Queensland syllabus support where applicable',
      'School-specific goals',
    ],
    exams: ['NAPLAN', 'QCE', 'ATAR pathway support'],
    support: [
      'Core academic tutoring',
      'Study skills and exam practice',
      'STEM, coding, and enrichment',
    ],
    audience:
      'Queensland families looking for online tutoring connected to classroom learning, QCE pathways, and NAPLAN where applicable.',
    relatedLocations: [
      { label: 'Australia', href: '/locations/australia' },
      { label: 'New South Wales', href: '/locations/new-south-wales' },
      { label: 'Western Australia', href: '/locations/western-australia' },
    ],
  },
  {
    slug: 'western-australia',
    path: '/locations/western-australia',
    title: 'Online Tutoring in Western Australia',
    description:
      'Online tutoring for Western Australia students with Australian Curriculum awareness, WACE support, NAPLAN practice, homework help, and enrichment.',
    priority: 0.6,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Western Australia',
    summary:
      'ICONIC Academy supports WA students online with core subject tutoring, NAPLAN readiness, WACE pathway support, study skills, and enrichment.',
    keywords: [
      'online tutoring Western Australia',
      'WACE tutoring',
      'NAPLAN tutor WA',
      'Perth online tutor',
    ],
    standards: [
      'Australian Curriculum',
      'Western Australia curriculum support where applicable',
      'School-specific goals',
    ],
    exams: ['NAPLAN', 'WACE', 'ATAR pathway support'],
    support: [
      'Maths, English, science, and writing',
      'Homework help and study planning',
      'Flexible online scheduling for WA families',
    ],
    audience:
      'Western Australia families who want online tutoring connected to school goals, NAPLAN, WACE, and senior pathway readiness where applicable.',
    relatedLocations: [
      { label: 'Australia', href: '/locations/australia' },
      { label: 'Queensland', href: '/locations/queensland' },
      { label: 'South Australia', href: '/locations/south-australia' },
    ],
  },
  {
    slug: 'south-australia',
    path: '/locations/south-australia',
    title: 'Online Tutoring in South Australia',
    description:
      'Online tutoring for South Australia students with Australian Curriculum awareness, SACE support, NAPLAN practice, homework help, and enrichment.',
    priority: 0.6,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in South Australia',
    summary:
      'South Australian families can use ICONIC Academy for live online tutoring, NAPLAN practice, SACE pathway support, study skills, and enrichment.',
    keywords: [
      'online tutoring South Australia',
      'SACE tutoring',
      'NAPLAN tutor South Australia',
      'Adelaide online tutor',
    ],
    standards: [
      'Australian Curriculum',
      'South Australia curriculum support where applicable',
      'School-specific goals',
    ],
    exams: ['NAPLAN', 'SACE', 'ATAR pathway support'],
    support: [
      'Maths and English foundations',
      'Science, writing, and study support',
      'Senior pathway readiness',
    ],
    audience:
      'South Australian families who want online tutoring connected to school assignments, NAPLAN, and SACE goals where applicable.',
    relatedLocations: [
      { label: 'Australia', href: '/locations/australia' },
      { label: 'Victoria', href: '/locations/victoria' },
      { label: 'Western Australia', href: '/locations/western-australia' },
    ],
  },
  {
    slug: 'united-kingdom',
    path: '/locations/united-kingdom',
    title: 'Online Tutoring in the UK',
    description:
      'Online tutoring for UK students with National Curriculum awareness, Key Stages, SATs, 11 plus, GCSE, IGCSE, A Levels, homework help, and enrichment.',
    priority: 0.75,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students across the UK',
    summary:
      'ICONIC Academy supports UK families with online Maths, English, science, homework help, exam preparation, and enrichment shaped around each learner.',
    keywords: [
      'online tutoring UK',
      'GCSE tutor',
      'A Level tutor',
      '11 plus tutoring',
      'Key Stage tutoring',
    ],
    standards: [
      'National Curriculum',
      'Key Stages 1-5',
      'School-specific goals and exam-board expectations where applicable',
    ],
    exams: ['SATs', '11+', 'GCSE', 'IGCSE', 'A Levels'],
    support: [
      'Maths, English, science, reading, and writing',
      'Exam practice and study planning',
      'Native English-speaking tutor options where language fluency matters',
    ],
    audience:
      'UK families looking for curriculum-aware online tutoring for school confidence, Key Stage progress, admissions preparation, GCSEs, IGCSEs, or A Levels.',
    relatedLocations: [
      { label: 'Online tutoring', href: '/programs/online-tutoring' },
      { label: 'Test prep', href: '/programs/test-prep' },
      { label: 'New Zealand', href: '/locations/new-zealand' },
    ],
  },
  {
    slug: 'new-zealand',
    path: '/locations/new-zealand',
    title: 'Online Tutoring in New Zealand',
    description:
      'Online tutoring for New Zealand students with New Zealand Curriculum support, NCEA Levels 1-3, NZ Scholarship, homework help, study skills, and enrichment.',
    priority: 0.68,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in New Zealand',
    summary:
      'ICONIC Academy helps New Zealand families with flexible online tutoring for school assignments, NCEA readiness, confidence, and enrichment.',
    keywords: [
      'online tutoring New Zealand',
      'NCEA tutoring',
      'NZ Scholarship tutoring',
      'Auckland online tutor',
    ],
    standards: [
      'New Zealand Curriculum',
      'School-specific goals and assignments',
      'Senior secondary subject expectations where applicable',
    ],
    exams: ['NCEA Levels 1-3', 'NZ Scholarship', 'School assessments'],
    support: [
      'Maths, English, science, and writing',
      'NCEA study planning and practice',
      'Flexible online sessions across New Zealand time zones',
    ],
    audience:
      'New Zealand families who want online tutoring connected to school goals, NCEA preparation, and enrichment where applicable.',
    relatedLocations: [
      { label: 'Australia', href: '/locations/australia' },
      { label: 'United Kingdom', href: '/locations/united-kingdom' },
      { label: 'Online tutoring', href: '/programs/online-tutoring' },
    ],
  },
  {
    slug: 'italy',
    path: '/locations/italy',
    title: 'Online Tutoring in Italy',
    description:
      'Online tutoring for students in Italy with primary and secondary school support, INVALSI readiness, Esame di Stato or maturita preparation, English, maths, and science tutoring.',
    priority: 0.62,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Italy',
    summary:
      'ICONIC Academy supports families in Italy with online tutoring for school confidence, English language development, maths, science, INVALSI practice, and exam readiness.',
    keywords: [
      'online tutoring Italy',
      'INVALSI tutoring',
      'maturita tutoring',
      'English tutor Italy',
      'maths tutor Italy',
    ],
    standards: [
      'Italian primary and secondary school support',
      'School-specific goals and assignments',
      'International curriculum support where applicable',
    ],
    exams: ['INVALSI', 'Esame di Stato / maturita', 'School assessments'],
    support: [
      'English, maths, science, reading, and writing',
      'Homework routines and study skills',
      'Exam practice and confidence building',
    ],
    audience:
      'Families in Italy looking for online tutoring in English, maths, science, school assignments, and exam preparation where applicable.',
    relatedLocations: [
      { label: 'United Kingdom', href: '/locations/united-kingdom' },
      { label: 'UAE', href: '/locations/uae' },
      { label: 'Online tutoring', href: '/programs/online-tutoring' },
    ],
  },
  {
    slug: 'uae',
    path: '/locations/uae',
    title: 'Online Tutoring in the UAE',
    description:
      'Online tutoring for UAE students with MoE, British, IB, American, and CBSE curriculum-aware support plus IGCSE, A Level, SAT, IELTS, TOEFL, and EmSAT preparation where applicable.',
    priority: 0.7,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in the UAE',
    summary:
      'ICONIC Academy supports UAE families across international and national school pathways with flexible online tutoring, exam practice, homework help, and enrichment.',
    keywords: [
      'online tutoring UAE',
      'Dubai tutor online',
      'EmSAT tutoring',
      'IGCSE tutor UAE',
      'CBSE tutor UAE',
    ],
    standards: [
      'UAE MoE curriculum support where applicable',
      'British, IB, American, and CBSE pathways',
      'School-specific goals and assignments',
    ],
    exams: ['EmSAT', 'IGCSE', 'A Level', 'SAT', 'IELTS', 'TOEFL', 'IB assessments'],
    support: [
      'Maths, English, science, and writing',
      'International school homework support',
      'Exam practice and study planning',
    ],
    audience:
      'UAE families comparing online tutors for national, British, IB, American, CBSE, admissions, or English-language exam goals.',
    relatedLocations: [
      { label: 'Qatar', href: '/locations/qatar' },
      { label: 'United Kingdom', href: '/locations/united-kingdom' },
      { label: 'Online tutoring', href: '/programs/online-tutoring' },
    ],
  },
  {
    slug: 'canada',
    path: '/locations/canada',
    title: 'Online Tutoring in Canada',
    description:
      'Online tutoring for Canadian students with provincial curriculum support, EQAO, OSSLT, BC literacy and numeracy graduation assessments, Alberta PATs and diploma exams, homework help, and enrichment.',
    priority: 0.75,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students across Canada',
    summary:
      'ICONIC Academy supports Canadian families with online tutoring connected to provincial expectations, school assignments, test readiness, and enrichment where applicable.',
    keywords: [
      'online tutoring Canada',
      'Canadian curriculum tutoring',
      'EQAO tutoring',
      'OSSLT tutoring',
      'provincial exam tutoring Canada',
    ],
    standards: [
      'Provincial curriculum expectations',
      'School-specific goals and assignments',
      'English and French-language school support where applicable',
    ],
    exams: [
      'EQAO',
      'OSSLT',
      'BC literacy and numeracy graduation assessments',
      'Alberta PATs',
      'Alberta diploma exams',
    ],
    support: [
      'Math, English, science, reading, and writing',
      'Provincial assessment readiness',
      'Homework help and study skills',
    ],
    audience:
      'Canadian families who want online tutoring connected to provincial curriculum, school assignments, and assessment readiness where applicable.',
    relatedLocations: [
      { label: 'Ontario', href: '/locations/ontario' },
      { label: 'British Columbia', href: '/locations/british-columbia' },
      { label: 'Alberta', href: '/locations/alberta' },
    ],
  },
  {
    slug: 'ontario',
    path: '/locations/ontario',
    title: 'Online Tutoring in Ontario',
    description:
      'Online tutoring for Ontario students with Ontario Curriculum support, EQAO, OSSLT, math, English, science, French support where applicable, homework help, and enrichment.',
    priority: 0.65,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Ontario',
    summary:
      'Ontario families can use ICONIC Academy for curriculum-aware online tutoring, EQAO readiness, OSSLT support, homework help, and enrichment.',
    keywords: [
      'online tutoring Ontario',
      'Ontario Curriculum tutoring',
      'EQAO tutoring',
      'OSSLT tutoring',
      'Toronto online tutor',
    ],
    standards: [
      'Ontario Curriculum',
      'School-specific goals and assignments',
      'English and French-language support where applicable',
    ],
    exams: ['EQAO', 'OSSLT', 'School assessments'],
    support: [
      'Math, English, science, and writing',
      'Reading foundations and study skills',
      'Assessment practice and confidence building',
    ],
    audience:
      'Ontario families looking for online tutoring connected to Ontario Curriculum expectations, EQAO, OSSLT, and school goals where applicable.',
    relatedLocations: [
      { label: 'Canada', href: '/locations/canada' },
      { label: 'British Columbia', href: '/locations/british-columbia' },
      { label: 'Alberta', href: '/locations/alberta' },
    ],
  },
  {
    slug: 'british-columbia',
    path: '/locations/british-columbia',
    title: 'Online Tutoring in British Columbia',
    description:
      'Online tutoring for BC students with British Columbia curriculum support, literacy and numeracy graduation assessment readiness, homework help, study skills, and enrichment.',
    priority: 0.63,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in British Columbia',
    summary:
      'ICONIC Academy helps BC families with flexible online tutoring for school assignments, literacy, numeracy, science, study skills, and graduation assessment readiness.',
    keywords: [
      'online tutoring British Columbia',
      'BC curriculum tutoring',
      'BC literacy assessment tutor',
      'BC numeracy assessment tutor',
      'Vancouver online tutor',
    ],
    standards: [
      'British Columbia curriculum support',
      'School-specific goals and assignments',
      'Grade-level literacy and numeracy expectations',
    ],
    exams: [
      'BC literacy graduation assessment',
      'BC numeracy graduation assessment',
      'School assessments',
    ],
    support: [
      'Math, English, science, and writing',
      'Literacy and numeracy foundations',
      'Homework routines and study planning',
    ],
    audience:
      'British Columbia families who want online tutoring connected to classroom goals, literacy and numeracy skills, and graduation assessment readiness where applicable.',
    relatedLocations: [
      { label: 'Canada', href: '/locations/canada' },
      { label: 'Ontario', href: '/locations/ontario' },
      { label: 'Alberta', href: '/locations/alberta' },
    ],
  },
  {
    slug: 'alberta',
    path: '/locations/alberta',
    title: 'Online Tutoring in Alberta',
    description:
      'Online tutoring for Alberta students with Alberta curriculum support, Provincial Achievement Tests, diploma exams, homework help, study skills, and enrichment.',
    priority: 0.63,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Alberta',
    summary:
      'Alberta families can use ICONIC Academy for online academic support, PAT readiness, diploma exam preparation, homework help, and enrichment.',
    keywords: [
      'online tutoring Alberta',
      'Alberta curriculum tutoring',
      'Alberta PAT tutoring',
      'Alberta diploma exam tutor',
      'Calgary online tutor',
    ],
    standards: [
      'Alberta curriculum support',
      'School-specific goals and assignments',
      'Grade-level readiness',
    ],
    exams: [
      'Provincial Achievement Tests',
      'Alberta diploma exams',
      'School assessments',
    ],
    support: [
      'Math, English, science, and writing',
      'Exam practice and study planning',
      'Foundations, confidence, and enrichment',
    ],
    audience:
      'Alberta families looking for online tutoring connected to school expectations, PATs, diploma exams, and subject confidence where applicable.',
    relatedLocations: [
      { label: 'Canada', href: '/locations/canada' },
      { label: 'British Columbia', href: '/locations/british-columbia' },
      { label: 'Ontario', href: '/locations/ontario' },
    ],
  },
  {
    slug: 'japan',
    path: '/locations/japan',
    title: 'Online Tutoring in Japan',
    description:
      'Online tutoring for students in Japan with Japanese school support, English tutoring, EIKEN preparation, entrance exam readiness, international curriculum support, and enrichment.',
    priority: 0.62,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Japan',
    summary:
      'ICONIC Academy supports families in Japan with online English, maths, science, study skills, EIKEN preparation, school entrance readiness, and international curriculum support.',
    keywords: [
      'online tutoring Japan',
      'EIKEN tutoring',
      'English tutor Japan',
      'Japan entrance exam tutoring',
      'international school tutor Japan',
    ],
    standards: [
      'Japanese school support where applicable',
      'International curriculum support',
      'School-specific goals and assignments',
    ],
    exams: [
      'EIKEN',
      'School entrance exam readiness',
      'International school assessments',
    ],
    support: [
      'English language development, reading, and writing',
      'Maths, science, and homework help',
      'Study habits and confidence building',
    ],
    audience:
      'Families in Japan looking for online support in English, school subjects, entrance readiness, EIKEN, or international curriculum goals.',
    relatedLocations: [
      { label: 'Australia', href: '/locations/australia' },
      { label: 'UAE', href: '/locations/uae' },
      { label: 'Online tutoring', href: '/programs/online-tutoring' },
    ],
  },
  {
    slug: 'qatar',
    path: '/locations/qatar',
    title: 'Online Tutoring in Qatar',
    description:
      'Online tutoring for Qatar students with national and international curriculum-aware support including British, IB, American, CBSE, IGCSE, A Level, SAT, IELTS, and TOEFL preparation where applicable.',
    priority: 0.65,
    changeFrequency: 'monthly',
    h1: 'Online tutoring for students in Qatar',
    summary:
      'ICONIC Academy supports Qatar families with flexible online tutoring for international school pathways, national curriculum goals, homework help, exam practice, and enrichment.',
    keywords: [
      'online tutoring Qatar',
      'Doha online tutor',
      'IGCSE tutor Qatar',
      'A Level tutor Qatar',
      'CBSE tutor Qatar',
    ],
    standards: [
      'Qatar national curriculum support where applicable',
      'British, IB, American, and CBSE pathways',
      'School-specific goals and assignments',
    ],
    exams: ['IGCSE', 'A Level', 'SAT', 'IELTS', 'TOEFL', 'IB assessments'],
    support: [
      'Maths, English, science, and writing',
      'International school homework support',
      'Study planning and exam practice',
    ],
    audience:
      'Qatar families comparing online tutoring for national, British, IB, American, CBSE, admissions, or English-language exam goals.',
    relatedLocations: [
      { label: 'UAE', href: '/locations/uae' },
      { label: 'United Kingdom', href: '/locations/united-kingdom' },
      { label: 'Online tutoring', href: '/programs/online-tutoring' },
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
      { '@type': 'Country', name: 'Australia' },
      { '@type': 'Country', name: 'United Kingdom' },
      { '@type': 'Country', name: 'New Zealand' },
      { '@type': 'Country', name: 'Italy' },
      { '@type': 'Country', name: 'United Arab Emirates' },
      { '@type': 'Country', name: 'Canada' },
      { '@type': 'Country', name: 'Japan' },
      { '@type': 'Country', name: 'Qatar' },
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
      target: absoluteUrl('/programs?query={search_term_string}'),
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
    areaServed: [
      'United States',
      'Australia',
      'United Kingdom',
      'New Zealand',
      'Italy',
      'United Arab Emirates',
      'Canada',
      'Japan',
      'Qatar',
      'Global online communities',
    ],
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
