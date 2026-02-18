'use client';

import { useEffect, useMemo, useState } from 'react';

const HERO_SUBJECTS = [
  { icon: '📐', label: 'Math' },
  { icon: '🧪', label: 'Science' },
  { icon: '📖', label: 'Reading' },
  { icon: '💻', label: 'Coding' },
  { icon: '🌍', label: 'Social Studies' },
  { icon: '🧠', label: 'Critical Thinking' },
] as const;

const LEARNING_AREAS = [
  'Mathematics',
  'Science',
  'English',
  'Coding',
  'Reading',
  'Exam Prep',
  'Homework Help',
  'Study Skills',
] as const;

const TRUST_STATS = [
  { value: '4.9/5', label: 'Average parent rating' },
  { value: '36M+', label: 'Learning sessions completed' },
  { value: '24/7', label: 'Flexible scheduling options' },
] as const;

const CORE_BENEFITS = [
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

const FOOTER_LINK_GROUPS = [
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

const TRUST_INDICATORS = [
  { icon: '✓', text: 'Used by 500K+ families' },
  { icon: '✓', text: 'Trusted by educators' },
  { icon: '✓', text: 'No credit card needed' },
] as const;

const TYPE_SPEED_MS = 80;
const HOLD_MS = 1800;

function HeroHeadline() {
  const [currentSubject, setCurrentSubject] = useState(0);
  const [displayedText, setDisplayedText] = useState('');

  const fullText = useMemo(
    () => `${HERO_SUBJECTS[currentSubject].icon} ${HERO_SUBJECTS[currentSubject].label}`,
    [currentSubject],
  );

  useEffect(() => {
    let typeTimer: ReturnType<typeof setInterval> | undefined;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let charIndex = 0;

    setDisplayedText('');

    typeTimer = setInterval(() => {
      charIndex += 1;
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        if (typeTimer) {
          clearInterval(typeTimer);
        }
        holdTimer = setTimeout(() => {
          setCurrentSubject((prev) => (prev + 1) % HERO_SUBJECTS.length);
        }, HOLD_MS);
      }
    }, TYPE_SPEED_MS);

    return () => {
      if (typeTimer) {
        clearInterval(typeTimer);
      }
      if (holdTimer) {
        clearTimeout(holdTimer);
      }
    };
  }, [fullText]);

  return (
    <div className="text-center">
      <div className="mb-8">
        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
          <span className="block text-foreground">It&apos;s time to</span>
          <span className="mt-2 flex flex-wrap items-center justify-center gap-3 md:gap-4">
            <span className="text-foreground">unlock your</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 shadow-md">
              <span className="text-2xl">🎓</span>
              <span className="text-sm font-semibold text-primary">child&apos;s</span>
            </span>
          </span>
          <span className="mt-2 block">potential in</span>
        </h1>
      </div>

      <div className="mb-12 flex min-h-28 items-center justify-center">
        <h2 className="flex min-h-28 items-center text-4xl font-bold text-primary md:text-6xl">
          {displayedText}
          <span className="ml-1 animate-pulse">|</span>
        </h2>
      </div>
    </div>
  );
}

export function MarketingHomePage() {
  return (
    <div className="bg-background text-foreground">
      <section id="home" className="relative min-h-screen overflow-hidden bg-background px-4 pb-16 pt-0">
        <div className="mx-auto max-w-6xl pt-20">
          <div className="mb-12 text-center">
            <HeroHeadline />
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
              Personalized learning paths for K-12 students. Help your child gain
              confidence, master new skills, and build a lifelong love of learning at
              their own pace.
            </p>
            <div className="mx-auto max-w-3xl rounded-3xl border border-border/60 bg-background p-8 shadow-sm md:p-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Start your journey now
                </a>
                <a
                  href="/login/tutor"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-background px-8 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  Become a Tutor
                </a>
              </div>
              <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                {TRUST_INDICATORS.map((item) => (
                  <p key={item.text} className="flex items-center justify-center gap-2">
                    <span className="font-semibold text-primary">{item.icon}</span>
                    <span>{item.text}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="subjects" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 overflow-x-auto rounded-[2rem] bg-secondary/20 px-4 py-4 sm:px-6">
          {LEARNING_AREAS.map((area) => (
            <div
              key={area}
              className="shrink-0 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-semibold text-card-foreground"
            >
              {area}
            </div>
          ))}
          <span className="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xl">
            ›
          </span>
        </div>
      </section>

      <section id="for-parents" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {TRUST_STATS.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border/60 bg-card p-5">
              <p className="text-2xl font-bold text-primary">{item.value}</p>
              <p className="mt-1 text-sm text-card-foreground/80">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 md:pb-16 lg:px-8"
      >
        <div className="rounded-3xl border border-border/60 bg-card/60 p-6 sm:p-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight">
              One platform for students, parents, and educators
            </h2>
            <p className="mt-3 text-foreground/80">
              From first lesson to measurable outcomes, ICONIC Academy helps families
              stay aligned and students stay motivated.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {CORE_BENEFITS.map((benefit) => (
              <article
                key={benefit.title}
                className="rounded-2xl border border-border/60 bg-background p-5"
              >
                <h3 className="text-lg font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-sm text-foreground/75">{benefit.description}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-2xl bg-primary/15 p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Ready to begin?
            </p>
            <p className="mt-2 text-lg font-medium">
              Explore tutors, choose the right fit, and start learning with confidence.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Explore and sign up
              </a>
              <a
                href="/contact"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-6 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Talk to our team
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer id="about" className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-lg font-semibold">ICONIC Academy</p>
              <p className="mt-2 text-sm text-foreground/75">
                Communication-first education designed for measurable student growth.
              </p>
            </div>
            {FOOTER_LINK_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
                  {group.title}
                </p>
                <ul className="mt-3 space-y-2">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-foreground/80 transition hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-foreground/60">
            © {new Date().getFullYear()} ICONIC Academy. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
