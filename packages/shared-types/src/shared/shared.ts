export type UUID = string;
export type ISODateTime = string;
export type IANATimezone = string;

export interface IdsBaseVM {
  id: UUID;
  orgId: UUID;
}

export type AvatarSource = 'seed' | 'upload' | 'external';
export type AccountStatus = 'active' | 'invited' | 'suspended' | 'deleted';
export type AccountRoleStatus = 'unassigned' | 'active' | 'pending' | 'blocked';
export type ThemeKey =
  | 'slate'
  | 'gray'
  | 'zinc'
  | 'neutral'
  | 'stone'
  | 'amber'
  | 'blue'
  | 'cyan'
  | 'emerald'
  | 'fuchsia'
  | 'green'
  | 'indigo'
  | 'lime'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'rose'
  | 'sky'
  | 'teal'
  | 'violet'
  | 'yellow';
export interface ConnectionVM<T> {
  items: T[];
  nextCursor?: string | null;
  total?: number | null;
}

export type EntityRefVM =
  | { kind: 'learning_space'; id: UUID }
  | { kind: 'schedule'; id: UUID }
  | { kind: 'session'; id: UUID }
  | { kind: 'session_change_request'; id: UUID }
  | { kind: 'homework'; id: UUID }
  | { kind: 'summary'; id: UUID }
  | { kind: 'message'; id: UUID }
  | { kind: 'file'; id: UUID }
  | { kind: 'user'; id: UUID }
  | { kind: 'educator'; id: UUID }
  | { kind: 'guardian'; id: UUID }
  | { kind: 'child'; id: UUID }
  | { kind: 'staff'; id: UUID };

export type FamilyLinkInviteRole = 'guardian' | 'child';
export type FamilyLinkInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export type FamilyRelation =
  | 'guardian'
  | 'legal_guardian'
  | 'caregiver'
  | 'relative'
  | 'other';

export type OnboardingStep =
  | 'account-phone'
  | 'profile'
  | 'preferences-timezone'
  | 'location'
  | 'family'
  | 'student-profile'
  | 'educator-profile'
  | 'staff-profile'
  | 'educator-availability';
