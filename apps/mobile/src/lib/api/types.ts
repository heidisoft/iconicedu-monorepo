export type DmParticipant = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  account_id?: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  timezone?: string | null;
  city?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  kind?: string | null;
  ui_theme_key?: string | null;
};

export type ChannelListItem = {
  id: string;
  org_id: string;
  topic: string | null;
  description: string | null;
  kind: string;
  updated_at: string;
  unread_count: number;
  thread_unread_count?: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  icon_key?: string | null;
  themeKey?: string | null;
  messageUiThemeKey?: 'classic' | 'feed' | null;
  purpose?: string | null;
  student_name?: string | null;
  student_profiles?: Array<{ name: string; themeKey?: string | null }>;
  participant_profiles?: Array<{
    name: string;
    kind: 'educator' | 'guardian' | 'child' | 'staff' | 'system';
    themeKey?: string | null;
  }>;
  participants?: DmParticipant[];
  is_supervised?: boolean;
  supervised_child_name?: string | null;
  is_learning_space?: boolean;
  is_support?: boolean;
};

export type DayAvailability = Record<string, Array<{ start: string; end: string }>>;

export type OnboardingStatus = {
  isComplete: boolean;
  isRoleAllowed: boolean;
  profileId: string | null;
  accountId: string | null;
  orgId: string | null;
  primaryRole: string | null;
  profileKind: string | null;
  flags: {
    hasName: boolean;
    hasTimezone: boolean;
    hasLocation: boolean;
    hasPhone: boolean;
    requiresPhone: boolean;
    hasRoleData: boolean;
    hasAvailability: boolean;
  };
  prefill: {
    firstName: string;
    lastName: string;
    phone: string;
    timezone: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
  };
};
