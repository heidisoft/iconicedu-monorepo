export const HERO_SUBJECTS = [
  { icon: '📐', label: 'Math' },
  { icon: '📚', label: 'ELA' },
  { icon: '🧪', label: 'Science' },
  { icon: '📖', label: 'Reading' },
  { icon: '✍️', label: 'Writing' },
  { icon: '🎯', label: 'Test Prep' },
  { icon: '💻', label: 'Coding' },
  { icon: '🎤', label: 'Debate' },
  { icon: '♟️', label: 'Chess' },
  { icon: '🎼', label: 'Music' },
  { icon: '🎨', label: 'Art' },
  { icon: '💰', label: 'Financial Literacy' },
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
  {
    value: '4.9/5',
    label: 'Parent satisfaction',
    description: 'Based on early family feedback',
  },
  {
    value: '100+',
    label: 'Learners and educators served',
    description: 'Across academic and enrichment programs',
  },
  {
    value: 'Flexible scheduling',
    label: 'Evening, weekend, and global time-zone options',
    description: '',
  },
  {
    value: 'Parent-visible progress',
    label: 'Session updates, reminders, and tutor communication in one place',
    description: '',
  },
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

export const MARKETING_CONTACT_DETAILS = {
  phone: {
    label: '+1 (929) 900-1264',
    href: 'tel:+19299001264',
  },
  whatsapp: {
    label: '+94 70 170 7926',
    href: 'https://wa.me/94701707926',
  },
  locations: ['New York, NY, USA', 'Colombo, Sri Lanka'],
} as const;

export const CORE_BENEFITS = [
  {
    title: 'Experienced tutors, not random matching',
    description:
      'We match students with tutors based on grade level, subject, curriculum, learning pace, and family goals.',
  },
  {
    title: 'Support for every U.S. state',
    description:
      'We help families across the USA by aligning tutoring to state standards, school expectations, assignments, and grade-level skills where applicable.',
  },
  {
    title: 'Academic + enrichment in one place',
    description:
      'Students can get help with Math, ELA, Science, Reading, Writing, Homework, Test Prep, Coding, Debate, Chess, Music, Art, Financial Literacy, Entrepreneurship, and more.',
  },
  {
    title: 'Affordable options for more families',
    description:
      'Choose from global tutor options, USA-based tutors, native English-speaking tutors, 1-on-1 lessons, or small-group classes.',
  },
  {
    title: 'Parents stay informed',
    description:
      'Families can follow class links, reminders, tutor messages, reschedules, and progress updates through the ICONIC app.',
  },
] as const;

export const SUCCESS_PATH_STEPS = [
  {
    title: 'Understand the learner',
    body: 'We start with grade level, school curriculum, strengths, gaps, schedule, and parent goals.',
  },
  {
    title: 'Match the right tutor',
    body: 'We recommend a tutor based on subject expertise, teaching style, curriculum familiarity, and learning needs.',
  },
  {
    title: 'Build strong foundations',
    body: 'Students work on the skills they need now: homework, missing concepts, reading, writing, math fluency, or test readiness.',
  },
  {
    title: 'Grow confidence and independence',
    body: 'Tutors help students explain their thinking, ask better questions, and become more confident learners.',
  },
  {
    title: 'Move ahead with enrichment',
    body: 'When students are ready, they can explore coding, debate, chess, creative writing, STEM, entrepreneurship, financial literacy, music, art, and competition prep.',
  },
] as const;

export const US_CURRICULUM_STANDARDS = [
  'New York State Next Generation Learning Standards',
  'Common Core-aligned standards',
  'Florida B.E.S.T. Standards',
  'Texas TEKS',
  'California Common Core State Standards',
  'New Jersey Student Learning Standards',
  'State test preparation and school-specific goals',
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
    title: 'Experienced, carefully selected tutors',
    description:
      'Certified teachers and experienced subject tutors are available across academic, enrichment, and advanced learning programs.',
  },
] as const;

export const PROGRAM_CATEGORIES = [
  {
    title: 'Core Academics',
    subjects: [
      'Math',
      'ELA',
      'Reading',
      'Writing',
      'Grammar',
      'Science',
      'Social Studies',
      'Homework Help',
      'Study Skills',
    ],
  },
  {
    title: 'Advanced Math & Science',
    subjects: [
      'Algebra',
      'Geometry',
      'Pre-Algebra',
      'Precalculus',
      'Biology',
      'Chemistry',
      'Physics',
      'Earth Science',
      'STEM Projects',
    ],
  },
  {
    title: 'Test Prep',
    subjects: [
      'State exams',
      'SHSAT',
      'SAT',
      'ACT',
      'ISEE',
      'SSAT',
      'Regents',
      'AP support',
      'Competition math',
      'Spelling Bee',
      'Debate tournaments',
    ],
  },
  {
    title: 'Future-Ready Skills',
    subjects: [
      'Coding',
      'Robotics',
      'AI basics',
      'Web development',
      'Game design',
      'Financial literacy',
      'Entrepreneurship',
      'Public speaking',
      'Critical thinking',
    ],
  },
  {
    title: 'Creative & Extracurricular',
    subjects: [
      'Chess',
      'Debate',
      'Creative writing',
      'Drawing',
      'Arts and crafts',
      'Music',
      'Piano',
      'Guitar',
      'Drama',
      'Photography',
      'Digital Media & Video Editing',
    ],
  },
] as const;

export const MAIN_MENU_PAGE_CONTENT = {
  subjects: {
    eyebrow: 'Programs',
    title: 'Academic help and enrichment for every kind of learner',
    intro:
      'From school support to enrichment, ICONIC Academy helps students catch up, keep up, and move ahead. Families can begin with one subject and expand into a full learning path as goals change.',
    sections: [
      {
        title: 'Full curriculum support',
        body: 'Math, ELA, reading, writing, science, social studies, homework help, and study skills for students who need to catch up, stay confident, or strengthen foundations.',
      },
      {
        title: 'Standards and school goals',
        body: 'USA-based and global tutors can connect lessons to classroom expectations, state standards where applicable, assignments, and grade-level readiness.',
      },
      {
        title: 'Enrichment and advanced challenge',
        body: 'Coding, robotics, AI basics, STEM projects, creative writing, debate, financial literacy, entrepreneurship, music, art, competitions, and advanced subject readiness for curious learners.',
      },
    ],
    categoryGroups: PROGRAM_CATEGORIES,
    highlights: [
      'Core academics: math, ELA, reading, writing, science, social studies, and homework support.',
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
    title: 'Tutoring that keeps parents informed — not guessing',
    intro:
      'ICONIC Academy helps parents understand what their child is learning, how tutoring connects to school, and what support makes sense for the family budget and schedule.',
    sections: [
      {
        title: 'Is my child actually improving?',
        body: 'Get session updates, tutor notes, and next-step guidance.',
      },
      {
        title: 'Is this aligned with school?',
        body: 'Tutors can connect lessons to homework, grade-level skills, state standards, and upcoming tests.',
      },
      {
        title: 'Can I afford consistent support?',
        body: 'Choose global tutors, USA-based tutors, small groups, or 1-on-1 programs based on your budget.',
      },
      {
        title: 'Can we fit this into our schedule?',
        body: 'Flexible scheduling helps families balance school, work, activities, and time zones.',
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
      { label: 'Online Tutoring', href: '/programs/online-tutoring' },
      { label: 'U.S. Curriculum Support', href: '/programs/us-curriculum-support' },
      { label: 'Tutoring Across the USA', href: '/locations/usa' },
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
  { icon: '✓', text: '1-on-1 and small-group options' },
  { icon: '✓', text: 'USA-based and global tutors' },
  { icon: '✓', text: 'Flexible scheduling' },
  { icon: '✓', text: 'Parent updates after sessions' },
] as const;

export const MARKETING_FAQS = [
  {
    question: 'Does ICONIC Academy support students across the USA?',
    answer:
      'Yes. ICONIC Academy supports K-12 students across the United States with online tutoring that can connect to school assignments, grade-level skills, and state standards where applicable.',
  },
  {
    question: 'What subjects and programs are available?',
    answer:
      'Families can find support for math, ELA, reading, writing, science, social studies, homework help, test prep, coding, debate, chess, music, art, financial literacy, entrepreneurship, and more.',
  },
  {
    question: 'Can tutoring match my child’s school curriculum?',
    answer:
      'Tutors can align support to homework, grade-level expectations, school goals, and state standards where applicable. We keep the claim practical: support is curriculum-aware, not a promise that every curriculum is covered perfectly.',
  },
  {
    question: 'Are affordable tutoring options available?',
    answer:
      'Yes. Families can explore affordable global tutor options, USA-based tutors, native English-speaking tutors, 1-on-1 lessons, small-group classes, and custom learning plans.',
  },
  {
    question: 'How do parents stay informed?',
    answer:
      'Parents can follow upcoming sessions, reminders, class links, tutor messages, reschedule updates, and progress notes through ICONIC Academy communication tools and mobile apps.',
  },
] as const;

export const TYPE_SPEED_MS = 80;
export const HOLD_MS = 1800;
