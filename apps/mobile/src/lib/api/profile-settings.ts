import type {
  ProfileSettingsInput,
  ProfileSettingsSectionInput,
} from '@iconicedu/shared-types';
import { apiGet, apiPut, apiDelete } from './http-client';

export type ProfileSettingsResult = {
  profile: Record<string, unknown>;
  canEdit: boolean;
  canRemove: boolean;
  canInvite?: boolean;
  childAccount?: { email: string | null; hasAuthAccount: boolean };
  removalBlocked: boolean;
  childDetails?: { birth_year?: number };
  gradeLevel?: string;
};
export const fetchProfileSettings = (id: string) =>
  apiGet<ProfileSettingsResult>(`/profiles/${encodeURIComponent(id)}/settings`);
export const saveProfileSettings = (
  id: string,
  input: ProfileSettingsInput | ProfileSettingsSectionInput,
) => apiPut(`/profiles/${encodeURIComponent(id)}/settings`, input);
export const removeFamilyChild = (id: string) =>
  apiDelete(`/profiles/${encodeURIComponent(id)}/family-child`);
