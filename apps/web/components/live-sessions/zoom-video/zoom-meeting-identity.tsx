'use client';

export function ZoomMeetingIdentity({
  title,
  participantCount,
}: {
  title: string;
  participantCount: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-base sm:text-xl lg:text-2xl lg:leading-8">
      <h1 className="min-w-0 truncate font-medium tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      <span
        className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
        aria-hidden="true"
      />
      <span className="shrink-0 font-medium text-muted-foreground">
        {participantCount} {participantCount === 1 ? 'Attendee' : 'Attendees'}
      </span>
    </div>
  );
}
