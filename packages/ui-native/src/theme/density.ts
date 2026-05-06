import React, { createContext, useContext } from 'react';
import { listRowClasses, cardClasses, buttonClasses, tabsClasses } from './components';

export type Density = 'compact' | 'comfortable' | 'spacious';

/**
 * When to use each density:
 *  compact     — data-dense screens (schedules, admin tables, settings lists)
 *  comfortable — default for most screens (messages, home, profile)
 *  spacious    — onboarding, single-focus forms, marketing-style cards
 */
export const DENSITY_ROW_CLASS: Record<Density, string> = {
  compact: listRowClasses.compact,
  comfortable: listRowClasses.default,
  spacious: listRowClasses.comfortable,
} as const;

export const DENSITY_CARD_CLASS: Record<Density, string> = {
  compact: cardClasses.compact,
  comfortable: cardClasses.default,
  spacious: cardClasses.comfortable,
} as const;

export const DENSITY_BTN_CLASS: Record<Density, string> = {
  compact: buttonClasses.sm,
  comfortable: buttonClasses.default,
  spacious: buttonClasses.lg,
} as const;

export const DENSITY_TAB_CLASS: Record<Density, string> = {
  compact: tabsClasses.compact,
  comfortable: tabsClasses.default,
  spacious: tabsClasses.default,
} as const;

const DensityContext = createContext<Density>('comfortable');

export const DensityProvider: React.FC<{
  density?: Density;
  children: React.ReactNode;
}> = ({ density = 'comfortable', children }) =>
  React.createElement(DensityContext.Provider, { value: density }, children);

export function useDensity(): Density {
  return useContext(DensityContext);
}
