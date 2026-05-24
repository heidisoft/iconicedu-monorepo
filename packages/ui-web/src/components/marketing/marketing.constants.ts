export const HERO_SUBJECTS = [
  { icon: '📐', label: 'Math' },
  { icon: '📚', label: 'ELA' },
  { icon: '♟️', label: 'Chess' },
  { icon: '🧪', label: 'Science' },
  { icon: '🔬', label: 'Biology' },
  { icon: '⚛️', label: 'Chemistry' },
  { icon: '🌌', label: 'Physics' },
  { icon: '🎤', label: 'Debate' },
  { icon: '🧠', label: 'Critical Thinking' },
  { icon: '💡', label: 'Creative Writing' },
  { icon: '💻', label: 'Coding' },
  { icon: '🤖', label: 'Robotics' },
  { icon: '📈', label: 'Entrepreneurship' },
  { icon: '💰', label: 'Financial Literacy' },
  { icon: '🏛️', label: 'Social Studies' },
  { icon: '📜', label: 'History' },
  { icon: '🎼', label: 'Music' },
  { icon: '🎹', label: 'Piano' },
  { icon: '🎸', label: 'Guitar' },
  { icon: '🖌️', label: 'Arts and Crafts' },
  { icon: '🖍️', label: 'Drawing' },
  { icon: '📷', label: 'Photography' },
  { icon: '🎬', label: 'Video Editing' },
  { icon: '🎭', label: 'Drama' },
  { icon: '🧘', label: 'Mindfulness' },
  { icon: '🧬', label: 'STEM' },
  { icon: '🎯', label: 'Test Prep' },
  { icon: '🏆', label: 'Competition Prep' },
] as const;

export const LEARNING_AREAS = [
  'Mathematics',
  'Science',
  'English',
  'Coding',
  'Reading',
  'Exam Prep',
  'Homework Help',
  'Study Skills',
] as const;

export const TRUST_STATS = [
  { value: '$12/h+', label: 'Affordable class sessions with global tutor options' },
  { value: '1:1 + groups', label: 'Flexible support for different family budgets' },
  { value: 'USA + global', label: 'Experienced tutors across curricula and standards' },
] as const;

export const MOBILE_APP_LINKS = [
  {
    label: 'Download on the App Store',
    shortLabel: 'App Store',
    href: 'https://apps.apple.com/us/app/iconic-academy/id6762158186',
  },
  {
    label: 'Get it on Google Play',
    shortLabel: 'Google Play',
    href: 'https://play.google.com/store/apps/details?id=com.heidisoft.iconicedu',
  },
] as const;

export const CORE_BENEFITS = [
  {
    title: 'Affordable learning options',
    description:
      'Choose from 1-on-1 tutoring, small-group classes, and subject-based support that fits your goals and budget.',
  },
  {
    title: 'Parent-first communication',
    description:
      'Stay close to class updates, messages, reminders, and progress visibility without chasing for answers.',
  },
  {
    title: 'Curriculum-aligned learning',
    description:
      'Lessons connect to full classroom curriculum, state standards where applicable, and stretch goals for students ready for more.',
  },
] as const;

export const MISSION_PILLARS = [
  {
    title: 'Affordable learning options',
    description:
      'Quality education should not be limited to families who can afford expensive tutoring. ICONIC Academy offers flexible options including 1-on-1 tutoring, small-group classes, and subject-based support.',
  },
  {
    title: 'Built for a wider audience',
    description:
      'We serve students from different backgrounds, grade levels, learning needs, and family budgets, whether they are catching up, staying on grade level, preparing for exams, or exploring enrichment topics.',
  },
  {
    title: 'Personalized support',
    description:
      'Students are not treated like numbers. Tutors focus on each child’s learning goals, confidence, pace, and progress.',
  },
  {
    title: 'Parent-first communication',
    description:
      'Parents should always understand what is happening in their child’s learning journey through updates, messages, reminders, and progress visibility.',
  },
  {
    title: 'Flexible online learning',
    description:
      'Students can learn from home with live online sessions that fit family schedules, making tutoring easier for busy parents and more comfortable for students.',
  },
  {
    title: 'USA and global tutor access',
    description:
      'ICONIC Academy connects families with experienced tutors from the USA and around the world, helping make curriculum-aware support more affordable and available.',
  },
] as const;

export const MAIN_MENU_PAGE_CONTENT = {
  subjects: {
    eyebrow: 'Subjects',
    title: 'Academic help and enrichment for every kind of learner',
    intro:
      'ICONIC Academy supports the full school curriculum, state standards where applicable, exam preparation, creative enrichment, and future-ready skills through flexible 1-on-1 and small-group learning.',
    sections: [
      {
        title: 'Full curriculum support',
        body: 'Math, ELA, reading, science, social studies, homework help, and study skills for students who need to catch up, stay confident, or strengthen foundations.',
      },
      {
        title: 'Standards and school goals',
        body: 'USA-based and global tutors can connect lessons to classroom expectations, state standards where applicable, assignments, and grade-level readiness.',
      },
      {
        title: 'Enrichment and advanced challenge',
        body: 'Coding, robotics, STEM, creative writing, debate, financial literacy, entrepreneurship, music, arts, competitions, and advanced subject readiness for curious learners.',
      },
    ],
    highlights: [
      'Core academics: math, ELA, reading, science, social studies, and homework support.',
      'Full-curriculum coverage connected to grade-level skills, assignments, and state standards where applicable.',
      'Enrichment: coding, robotics, creative writing, music, art, debate, chess, and financial literacy.',
      'Language-sensitive support for ELA with USA-based and native English-speaking tutors when regional fluency matters.',
      'Affordable global tutoring options for families who need consistent, curriculum-aware help without premium pricing.',
    ],
    bestFor: [
      'Students who need to catch up after learning gaps or school transitions.',
      'Learners who are on grade level but need confidence, structure, or accountability.',
      'Advanced students who need more challenge through STEM, competition prep, writing, debate, or creative subjects.',
      'Families who want one platform for academic support and enrichment.',
    ],
    closingTitle: 'Subject support should feel practical, not overwhelming',
    closingBody:
      'Families can begin with one subject and expand over time as goals change. ICONIC Academy keeps the path flexible so students can get help where they need it now, then grow into deeper enrichment when they are ready.',
  },
  howItWorks: {
    eyebrow: 'How it works',
    title: 'Simple online learning with support families can understand',
    intro:
      'Families tell us what their child needs, and ICONIC Academy helps match the right curriculum path, educator, schedule, and communication rhythm.',
    sections: [
      {
        title: 'Share your child’s goals',
        body: 'Start with the student’s grade level, curriculum, state or school expectations, learning needs, schedule, and budget so we can recommend a practical path.',
      },
      {
        title: 'Choose a learning format',
        body: 'Families can explore 1-on-1 tutoring, small-group classes, USA-based tutor options, global tutor options, or specialized programs depending on the learner’s needs.',
      },
      {
        title: 'Stay connected as learning happens',
        body: 'Parents can follow updates, reminders, messages, and progress visibility so they are not left guessing between sessions.',
      },
    ],
    highlights: [
      'Start with a family-friendly conversation about grade level, curriculum, goals, schedule, and budget.',
      'Match the learner with a tutor profile, subject focus, and session format that fits.',
      'Begin online sessions from home with reminders and communication built into the experience.',
      'Adjust the plan as the child progresses, needs change, or advanced learners need more challenge.',
    ],
    bestFor: [
      'Busy parents who want tutoring without complicated coordination.',
      'Families comparing 1-on-1 support, small-group learning, and subject-based help.',
      'Students who need a consistent rhythm and a teacher who understands their pace.',
      'Parents who want visibility between sessions instead of vague updates.',
    ],
    closingTitle: 'A calmer path from inquiry to learning',
    closingBody:
      'The goal is to remove friction for parents and help students start with confidence. ICONIC Academy keeps the process clear: understand the learner, recommend a fit, begin sessions, and keep families informed.',
  },
  forParents: {
    eyebrow: 'For parents',
    title: 'Built for parents who want clarity, care, and affordability',
    intro:
      'ICONIC Academy is designed to help families find dependable support without making tutoring feel complicated, intimidating, or out of reach.',
    sections: [
      {
        title: 'Clear communication',
        body: 'Parents should know what their child is learning, where they are improving, and what needs attention next.',
      },
      {
        title: 'Flexible choices',
        body: 'Affordable global tutoring, USA-based instruction, native-speaker support, small-group options, and specialized programs help families choose what fits.',
      },
      {
        title: 'Confidence for students',
        body: 'Tutors focus on each child’s pace, confidence, curriculum gaps, strengths, and need for challenge so support feels personal instead of generic.',
      },
    ],
    highlights: [
      'Class updates help parents understand what happened and what comes next.',
      'Messages and reminders make it easier to coordinate learning around real family schedules.',
      'Progress visibility helps families see effort, consistency, and improvement over time.',
      'Affordable options help parents choose USA-based or global tutor support without feeling locked into one expensive model.',
    ],
    bestFor: [
      'Parents who want a trustworthy partner in their child’s learning journey.',
      'Families balancing school, activities, work schedules, and different time zones.',
      'Guardians who need clear communication before committing to long-term tutoring.',
      'Students who learn better when parents and teachers stay aligned.',
    ],
    closingTitle: 'Parents deserve to feel informed',
    closingBody:
      'A child’s education should not feel like a black box. ICONIC Academy is built around parent-first communication so families can make decisions with clarity, not guesswork.',
  },
  about: {
    eyebrow: 'About ICONIC Academy',
    title: 'A mission-driven learning platform for more families',
    intro:
      'ICONIC Academy exists to make high-quality, curriculum-aware online learning more accessible, warm, and personal for students across regions and backgrounds.',
    sections: [
      {
        title: 'Our mission',
        body: 'We believe every child deserves caring academic support, not only families who can afford premium tutoring marketplaces.',
      },
      {
        title: 'Our approach',
        body: 'We combine experienced USA and global educator access, curriculum coverage, regional subject expertise, personalized learning, and parent-first communication.',
      },
      {
        title: 'Our promise',
        body: 'We aim to be trustworthy, affordable, modern, and human: professional enough for parents to trust, warm enough for students to feel safe.',
      },
    ],
    highlights: [
      'We believe quality education should be reachable for more families, not only those who can afford expensive tutoring.',
      'We connect students with caring educators across regions, subjects, languages, and specialty levels.',
      'We cover full curriculum goals, state standards where applicable, and enrichment pathways for students who need more challenge.',
      'We design for parents as much as students, because families need communication and confidence.',
      'We support both foundational learning and enrichment so students can catch up, keep up, and move ahead.',
    ],
    bestFor: [
      'Families looking for a warm, modern alternative to impersonal tutoring marketplaces.',
      'Students who need patient support, confidence building, and flexible online sessions.',
      'Parents who value affordability, trust, and clear communication.',
      'Regional communities that need specialized programs shaped around local learning needs.',
    ],
    closingTitle: 'Professional, but personal',
    closingBody:
      'ICONIC Academy is designed to feel dependable and organized without becoming cold or corporate. The mission is simple: make high-quality learning support easier to access, easier to understand, and easier to trust.',
  },
} as const;

export const FOOTER_LINK_GROUPS = [
  {
    title: 'Platform',
    links: [
      { label: 'Programs', href: '/subjects' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Become a Tutor', href: '/iconic-academy/login' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  },
] as const;

export const TRUST_INDICATORS = [
  { icon: '✓', text: 'Full Curriculum Coverage' },
  { icon: '✓', text: 'State Standards Support' },
  { icon: '✓', text: 'USA & Global Tutors' },
] as const;

export const TYPE_SPEED_MS = 80;
export const HOLD_MS = 1800;
