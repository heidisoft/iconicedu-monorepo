import type { ReactNode } from 'react';

import { MarketingLowFrictionStartSection } from './marketing-low-friction-start-section';
import {
  MARKETING_CARD_CLASS,
  MARKETING_ACTION_CARD_CLASS,
  MARKETING_HERO_BAND_CLASS,
  MARKETING_INSET_CARD_CLASS,
  MARKETING_LEAD_CONTAINER_CLASS,
  MARKETING_SECTION_CLASS,
} from './marketing-layout';

type MarketingMainMenuPageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly {
    title: string;
    body: string;
  }[];
  categoryGroups?: readonly {
    title: string;
    subjects: readonly string[];
  }[];
  highlights?: readonly string[];
  bestFor?: readonly string[];
  closingTitle?: string;
  closingBody?: string;
};

type MarketingMainMenuPageProps = {
  content: MarketingMainMenuPageContent;
  loginHref?: string;
  beforeLowFrictionStart?: ReactNode;
};

export function MarketingMainMenuPage({
  content,
  loginHref = '/iconic-academy/get-started',
  beforeLowFrictionStart,
}: MarketingMainMenuPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className={MARKETING_HERO_BAND_CLASS}>
        <div className={MARKETING_LEAD_CONTAINER_CLASS}>
          <p className="text-sm font-semibold uppercase text-primary">
            {content.eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-normal sm:text-5xl">
            {content.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{content.intro}</p>
        </div>
      </section>

      <section className={MARKETING_SECTION_CLASS}>
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {content.sections.map((section) => (
            <article key={section.title} className={MARKETING_CARD_CLASS}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {section.body}
              </p>
            </article>
          ))}
        </div>
        {(content.highlights || content.bestFor) && (
          <div className="mx-auto mt-10 grid max-w-7xl gap-5 lg:grid-cols-2">
            {content.highlights && (
              <article className={MARKETING_CARD_CLASS}>
                <p className="text-sm font-semibold uppercase text-primary">
                  What families can expect
                </p>
                <ul className="mt-4 grid gap-3">
                  {content.highlights.map((item) => (
                    <li key={item} className={MARKETING_INSET_CARD_CLASS}>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            )}
            {content.bestFor && (
              <article className={MARKETING_CARD_CLASS}>
                <p className="text-sm font-semibold uppercase text-primary">Best for</p>
                <ul className="mt-4 grid gap-3">
                  {content.bestFor.map((item) => (
                    <li key={item} className={MARKETING_INSET_CARD_CLASS}>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            )}
          </div>
        )}
        {content.categoryGroups && (
          <div className="mx-auto mt-10 max-w-7xl">
            <p className="text-sm font-semibold uppercase text-primary">
              Program categories
            </p>
            <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {content.categoryGroups.map((group) => (
                <article key={group.title} className={MARKETING_CARD_CLASS}>
                  <h2 className="text-lg font-semibold">{group.title}</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
        {(content.closingTitle || content.closingBody) && (
          <div
            className={`mx-auto mt-10 max-w-7xl ${MARKETING_ACTION_CARD_CLASS} bg-action-subtle/60`}
          >
            {content.closingTitle && (
              <h2 className="text-2xl font-semibold">{content.closingTitle}</h2>
            )}
            {content.closingBody && (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                {content.closingBody}
              </p>
            )}
          </div>
        )}
        <div
          className={`mx-auto mt-10 flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${MARKETING_ACTION_CARD_CLASS}`}
        >
          <div>
            <p className="text-lg font-semibold">Find the right learning path</p>
            <p className="text-sm text-muted-foreground">
              Start with your child’s goals, budget, and schedule so we can recommend the
              right support.
            </p>
          </div>
          <a
            href={loginHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Get started
          </a>
        </div>
      </section>
      {beforeLowFrictionStart}
      <MarketingLowFrictionStartSection loginHref={loginHref} />
    </div>
  );
}
