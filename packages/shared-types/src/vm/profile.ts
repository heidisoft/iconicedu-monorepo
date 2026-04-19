import type {
  AccountStatus,
  AvatarSource,
  ConnectionVM,
  IdsBaseVM,
  ISODateTime,
  ThemeKey,
  UUID,
} from '@iconicedu/shared-types/shared/shared';
import type { GradeLevel } from '@iconicedu/shared-types/shared/grades';
import type { DayAvailability } from '@iconicedu/shared-types/shared/availability';
import type { EducatorAvailabilityVM } from '@iconicedu/shared-types/vm/availability';
import type { FamilyLinkInviteVM } from '@iconicedu/shared-types/vm/family-link-invite';

export interface AvatarVM {
  source: AvatarSource;
  url?: string | null;
  seed?: string | null;
  updatedAt?: ISODateTime | null;
}

export type PresenceStateVM = {
  text?: string | null;
  emoji?: string | null;
  expiresAt?: ISODateTime | null;
};

export type PresenceDisplayStatusVM = 'online' | 'idle' | 'busy' | 'away' | 'offline';

export type LiveStatusVM =
  | 'online'
  | 'in_class'
  | 'teaching'
  | 'reviewing_work'
  | 'busy'
  | 'away'
  | 'offline';

export interface PresenceVM {
  state: PresenceStateVM;
  liveStatus: LiveStatusVM;
  displayStatus?: PresenceDisplayStatusVM;
  lastSeenAt?: ISODateTime | null;
  presenceLoaded?: boolean;
}

export interface UserProfileBlockVM {
  displayName: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  avatar: AvatarVM;
}

export interface UserPrefsVM {
  timezone?: string | null;
  locale?: string | null;
  languagesSpoken?: string[] | null;
  notificationDefaults?: NotificationDefaultsVM | null;
  notificationScopedDefaults?: NotificationScopedPreferenceVM[] | null;
}

export type NotificationChannelVM = 'push' | 'email' | 'sms' | 'whatsapp';

export interface NotificationPreferenceVM {
  channels: NotificationChannelVM[];
  muted?: boolean | null;
}

export type NotificationScopeKindVM = 'channel' | 'learning_space';

export interface NotificationScopedPreferenceVM extends NotificationPreferenceVM {
  scopeKind: NotificationScopeKindVM;
  scopeId: UUID;
  prefKey: NotificationKey | string;
}

export type NotificationKey =
  | 'defaults.message_updates'
  | 'defaults.weekly_digest'
  | 'defaults.sms_reminders'
  | 'system.alerts'
  | 'system.notice'
  | 'messages.direct_message'
  | 'messages.teacher_message'
  | 'messages.mentions'
  | 'messages.replies'
  | 'messages.mute_busy'
  | 'schedule.upcoming_reminder'
  | 'schedule.starting_soon'
  | 'schedule.rescheduled'
  | 'schedule.canceled'
  | 'schedule.no_show'
  | 'schedule.makeup'
  | 'homework.assigned'
  | 'homework.due_reminder'
  | 'homework.feedback'
  | 'homework.new'
  | 'homework.new_resource'
  | 'progress.weekly_report'
  | 'progress.monthly_report'
  | 'progress.attendance_summary'
  | 'progress.milestones'
  | 'announcements.important'
  | 'announcements.class_posts'
  | 'announcements.policy_updates'
  | 'billing.receipt'
  | 'billing.failed'
  | 'billing.invoice_ready'
  | 'billing.refund'
  | 'billing.renewal'
  | 'app.security_alerts'
  | 'app.new_device'
  | 'app.account_changes'
  | 'digest.instant'
  | 'digest.daily'
  | 'digest.weekly'
  | 'digest.urgent_only'
  | 'dm.posted'
  | 'dm.edited'
  | 'dm.deleted'
  | 'dm.reaction.added'
  | 'message.posted'
  | 'file.uploaded'
  | 'class.created'
  | 'class.updated'
  | 'channel.updated'
  | 'member.invited'
  | 'members.invited'
  | 'member.joined'
  | 'member.removed'
  | 'class.session.scheduled'
  | 'class.session.rescheduled'
  | 'class.session.canceled'
  | 'session.started'
  | 'session.ended'
  | 'session.completed'
  | 'session.reminder.sent'
  | 'session.feedback_request.sent'
  | 'payment.reminder'
  | 'payment.reminder.sent'
  | 'payment.received'
  | 'payment.failed';

export type NotificationDefaultsVM = Partial<
  Record<NotificationKey, NotificationPreferenceVM>
>;

export interface UserLocationVM {
  countryCode?: string | null;
  countryName?: string | null;
  streetAddress?: string | null;
  region?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

export interface UserInternalVM {
  notesInternal?: string | null;
  leadSource?: string | null;
}

export interface UserMetaVM {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface UserUiVM {
  themeKey?: ThemeKey | null;
}

export interface BaseUserProfileVM {
  ids: Omit<IdsBaseVM, 'accountId'> & { accountId: UUID };
  profile: UserProfileBlockVM;
  prefs: UserPrefsVM;

  presence?: PresenceVM | null;

  status?: AccountStatus;
  accountEmail?: string | null;

  location?: UserLocationVM;

  internal?: UserInternalVM;

  meta: UserMetaVM;

  ui?: UserUiVM;
}

export interface EducatorProfileVM extends BaseUserProfileVM {
  kind: 'educator';

  headline?: string | null;
  subjects?: string[] | null;
  gradesSupported?: GradeLevel[] | null;

  education?: string | null;
  experienceYears?: number | null;

  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: number;
  }> | null;

  joinedDate: ISODateTime;

  ageGroupsComfortableWith?: string[] | null;

  identityVerificationStatus?: 'unverified' | 'pending' | 'verified' | null;

  curriculumTags?: string[] | null;
  badges?: string[] | null;
  availability?: EducatorAvailabilityVM | null;

  averageRating?: number | null;
  totalReviews?: number | null;

  featuredVideoIntroUrl?: string | null;
}

export interface ChildProfileVM extends BaseUserProfileVM {
  kind: 'child';

  guardianNames?: string[] | null;

  gradeLevel?: GradeLevel | null;
  birthYear?: number | null;

  schoolName?: string | null;
  schoolYear?: string | null;

  interests?: string[] | null;
  strengths?: string[] | null;
  learningPreferences?: string[] | null;
  motivationStyles?: string[] | null;

  confidenceLevel?: string | null;
  communicationStyles?: string[] | null;

  accountAuthUserId?: UUID | null;
}

export type ChildProfileSaveInput = {
  profileId: string;
  orgId: string;
  gradeId?: GradeLevel | null;
  gradeLabel?: string | null;
  birthYear?: number | null;
  schoolName?: string | null;
  schoolYear?: string | null;
  interests?: string[] | null;
  strengths?: string[] | null;
  learningPreferences?: string[] | null;
  motivationStyles?: string[] | null;
  confidenceLevel?: string | null;
  communicationStyles?: string[] | null;
};

export interface GuardianProfileVM extends BaseUserProfileVM {
  kind: 'guardian';

  children?: ConnectionVM<ChildProfileVM> | null;

  joinedDate: ISODateTime;

  sessionNotesVisibility?: 'private' | 'shared' | null;

  familyInvites?: FamilyLinkInviteVM[] | null;
}

export interface StaffProfileVM extends BaseUserProfileVM {
  kind: 'staff';

  department?: string | null;
  managerStaffId?: UUID | null;
  specialties?: string[] | null;
  jobTitle?: string | null;

  permissionsScope?: 'limited' | 'standard' | 'elevated' | null;

  weeklyAvailability?: DayAvailability | null;
}

export interface SystemProfileVM extends BaseUserProfileVM {
  kind: 'system';
}

export type UserProfileVM =
  | EducatorProfileVM
  | GuardianProfileVM
  | ChildProfileVM
  | StaffProfileVM
  | SystemProfileVM;

export type EducatorGradeEntry = {
  gradeId: GradeLevel;
  gradeLabel?: string | null;
};

export type EducatorProfileSaveInput = {
  profileId: UUID;
  orgId: UUID;
  headline?: string | null;
  subjects?: string[] | null;
  gradeLevels?: EducatorGradeEntry[] | null;
  featuredVideoIntroUrl?: string | null;
  education?: string | null;
  experienceYears?: number | null;
  certifications?: string[] | null;
  badges?: string[] | null;
  ageGroups?: string[] | null;
  curriculumTags?: string[] | null;
};

export type StaffProfileSaveInput = {
  profileId: UUID;
  orgId: UUID;
  department?: string | null;
  jobTitle?: string | null;
  weeklyAvailability?: DayAvailability | null;
  specialties?: string[] | null;
};
