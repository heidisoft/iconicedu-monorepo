'use client';

import { useEffect, useMemo, useState } from 'react';
import { HERO_SUBJECTS, HOLD_MS, TYPE_SPEED_MS } from './marketing.constants';

export function MarketingHeroHeadline() {
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
