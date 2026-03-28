import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(text: string, letters = 2) {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, letters).toUpperCase();
  }
  const initials = parts.map((part) => part[0]).join('');
  return initials.slice(0, letters).toUpperCase();
}
