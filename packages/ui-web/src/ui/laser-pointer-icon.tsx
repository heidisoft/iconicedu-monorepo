import type { ComponentProps } from 'react';

/** Shared laser-style pen icon for whiteboard and temporary screen annotations. */
export function LaserPointerIcon({
  size = 16,
  ...props
}: ComponentProps<'svg'> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m4 17 9-9 3 3-9 9H4v-3Z" />
      <path d="m11 10 3 3M17 7l4-4M18 10h3M14 6V3" />
    </svg>
  );
}
