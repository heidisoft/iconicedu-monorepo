import type { ISODateTime, UUID } from '../shared/shared';

export type PushTokenPlatform = 'ios' | 'android' | 'web';

export interface PushTokenRow {
  id: UUID;
  org_id: UUID;
  profile_id: UUID;
  token: string;
  platform: PushTokenPlatform;
  device_id: string | null;
  revoked_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}
