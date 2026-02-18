import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createContext } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * React context for propagating text styles through compound components.
 * Used by Button, Badge, etc. to pass className to nested Text children.
 */
export const TextClassContext = createContext<string | undefined>(undefined);
