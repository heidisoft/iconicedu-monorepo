import type { ReactNode } from 'react';

/** Feature modules describe actions without importing a particular menu or toolbar. */
export type MeetingFeatureAction = {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  mobileOnly?: boolean;
  onSelect: () => void;
};
