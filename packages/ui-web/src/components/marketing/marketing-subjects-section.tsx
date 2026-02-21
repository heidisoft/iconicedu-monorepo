import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@iconicedu/ui-web/ui/carousel';
import { HERO_SUBJECTS } from './marketing.constants';

export function MarketingSubjectsSection() {
  return (
    <section id="subjects" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="rounded-[2.75rem] border border-border/60 bg-secondary/25 px-3 py-3 sm:px-5 sm:py-4">
        <Carousel
          opts={{ align: 'start', loop: true }}
          className="w-full"
          aria-label="Hero subjects carousel"
        >
          <div className="flex items-center gap-2">
            <CarouselPrevious className="static size-12 shrink-0 translate-y-0 border-border/40 bg-background text-foreground shadow-none hover:bg-muted disabled:opacity-40" />
            <CarouselContent className="-ml-0">
              {HERO_SUBJECTS.map((subject) => (
                <CarouselItem
                  key={subject.label}
                  className="basis-auto pl-0 pr-5 sm:pr-7"
                >
                  <div className="inline-flex min-w-28 flex-col items-center gap-2 text-center">
                    <span className="text-2xl leading-none">{subject.icon}</span>
                    <span className="text-base text-foreground">{subject.label}</span>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselNext className="static size-12 shrink-0 translate-y-0 border-border/40 bg-background text-foreground shadow-none hover:bg-muted disabled:opacity-40" />
          </div>
        </Carousel>
      </div>
    </section>
  );
}
