'use client';

/** flag-exempt: restore screen-reader announcements for the existing caption display. */
export function ZoomCaptions({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={
        text
          ? 'absolute inset-x-4 bottom-24 z-20 mx-auto w-fit max-w-lg rounded-lg bg-black/80 px-4 py-2 text-center text-sm text-white'
          : 'sr-only'
      }
    >
      {text}
    </div>
  );
}
