import type { LiveSessionProviderVM } from '@iconicedu/shared-types';

export const ADMIN_LIVE_SESSION_PROVIDER_OPTIONS: Array<{
  value: LiveSessionProviderVM;
  label: string;
}> = [
  { value: 'daily', label: 'Daily Meetings' },
  { value: 'zoom', label: 'Zoom (Video SDK)' },
  { value: 'custom', label: 'External' },
];
