import type { ProfileLocationInput } from './country-address';

/** Editable presentation data. Roles, account status and permissions are never editable. */
export type ProfileSettingsInput = {
  firstName: string;
  lastName: string;
  displayName: string;
  themeKey: string;
  timezone: string;
  locale: string;
  hideRole: boolean;
  hideStatus: boolean;
  location?: ProfileLocationInput;
  avatarUrl?: string;
  birthYear?: number;
  gradeLevel?: string;
  languagesSpoken?: string[];
};

/** Each editor submits only the fields owned by its section. */
export type ProfileSettingsSectionInput =
  | { section: 'photo'; values: { avatarUrl: string } }
  | {
      section: 'identity';
      values: Pick<ProfileSettingsInput, 'firstName' | 'lastName' | 'displayName'>;
    }
  | {
      section: 'appearance';
      values: Pick<ProfileSettingsInput, 'themeKey' | 'avatarUrl'>;
    }
  | { section: 'location'; values: Required<Pick<ProfileSettingsInput, 'location'>> }
  | {
      section: 'regional';
      values: Pick<ProfileSettingsInput, 'timezone' | 'locale' | 'languagesSpoken'>;
    }
  | {
      section: 'visibility';
      values: Pick<ProfileSettingsInput, 'hideRole' | 'hideStatus'>;
    }
  | { section: 'child'; values: { birthYear: number; gradeLevel: string } }
  | { section: 'about'; values: { bio: string } };
export type ProfileSettingsSection = ProfileSettingsSectionInput['section'];
