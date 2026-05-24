'use client';

import { useEffect, useMemo, useState } from 'react';
import { HERO_SUBJECTS, HOLD_MS, TYPE_SPEED_MS } from './marketing.constants';

export function MarketingHeroSubjectTicker() {
  const [currentSubject, setCurrentSubject] = useState(0);
  const firstSubject = `${HERO_SUBJECTS[0].icon} ${HERO_SUBJECTS[0].label}`;
  const [displayedText, setDisplayedText] = useState(firstSubject);

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
    <span className="flex min-h-28 items-center text-4xl font-bold text-primary md:text-6xl">
      {displayedText}
      <span className="ml-1 animate-pulse" aria-hidden="true">
        |
      </span>
    </span>
  );
}
