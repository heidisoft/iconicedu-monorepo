import type { LiveSessionProviderVM } from '@iconicedu/shared-types';

export const ADMIN_LIVE_SESSION_PROVIDER_OPTIONS: Array<{
  value: LiveSessionProviderVM;
  label: string;
}> = [
  { value: 'daily', label: 'Daily Meetings' },
  { value: 'custom', label: 'External' },
];
