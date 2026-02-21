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
  { value: '4.9/5', label: 'Trusted by parents who see real results' },
  { value: '100+', label: 'Students and educators from around the world.' },
  { value: '24/7', label: 'Flexible scheduling options' },
] as const;

export const CORE_BENEFITS = [
  {
    title: 'Personalized 1-1 support',
    description:
      'Match your child with tutors that fit their level, pace, and learning goals.',
  },
  {
    title: 'Progress you can actually track',
    description:
      'Follow milestones, assignments, and outcomes with a parent-friendly experience.',
  },
  {
    title: 'Built for modern education',
    description:
      'Live sessions, structured learning spaces, and messaging in one secure platform.',
  },
] as const;

export const FOOTER_LINK_GROUPS = [
  {
    title: 'Platform',
    links: [
      { label: 'Programs', href: '#subjects' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Become a Tutor', href: '/login/tutor' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#about' },
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
  { icon: '✓', text: 'Aligned with School Curriculum' },
  { icon: '✓', text: 'Personalized 1-on-1 Instruction' },
  { icon: '✓', text: 'Certified & Experienced Teachers' },
] as const;

export const TYPE_SPEED_MS = 80;
export const HOLD_MS = 1800;
