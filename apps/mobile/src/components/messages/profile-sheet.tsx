import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  FileText,
  Mail,
  MapPin,
  Globe,
  BookOpen,
  GraduationCap,
  Clock,
  Clock3,
  Presentation,
  ShieldUser,
  User,
  BriefcaseBusiness,
  Sunrise,
  Sun,
  Sunset,
  MoonStar,
  CircleOff,
  Award,
  Megaphone,
  Calendar,
  School,
  Heart,
  Sparkles,
  MessageCircle,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { BottomSheet } from '@iconicedu/ui-native';
import type { UserProfileVM, ChildProfileVM, GradeLevel } from '@iconicedu/shared-types';
import { gradeLabel, normalizeCountryCode } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import { avatarBgColor, getInitials } from './message-item';
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';
import { apiGet } from '@/lib/api/http-client';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import {
  formatLocalTimeText,
  type LocalTimePresenceStatus,
  resolveLocalTimeIconKey,
} from '@/lib/local-time-context';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AboutField = {
  key: string;
  label: string;
  value: string;
  Icon: LucideIcon;
};

type ProfilePresenceRow = {
  profile_id: string;
  display_status?: string | null;
  last_seen_at?: string | null;
};

type ProfilePresenceSummary = {
  displayStatus?: string | null;
  lastSeenAt?: string | null;
};

function normalizePresenceStatus(value?: string | null): LocalTimePresenceStatus {
  if (
    value === 'online' ||
    value === 'busy' ||
    value === 'idle' ||
    value === 'away' ||
    value === 'offline'
  ) {
    return value;
  }
  return null;
}

function roleLabelFromKind(kind: UserProfileVM['kind']): string {
  switch (kind) {
    case 'educator':
      return 'Teacher';
    case 'guardian':
      return 'Parent';
    case 'child':
      return 'Student';
    case 'staff':
      return 'Staff';
    case 'system':
      return 'System';
    default:
      return 'Member';
  }
}

function roleIconFromKind(kind: UserProfileVM['kind']): LucideIcon {
  switch (kind) {
    case 'educator':
      return Presentation;
    case 'guardian':
      return ShieldUser;
    case 'child':
      return User;
    case 'staff':
      return BriefcaseBusiness;
    case 'system':
      return Sparkles;
    default:
      return Users;
  }
}

function buildLocationLabel(user: UserProfileVM): string | null {
  const parts = [user.location?.city, user.location?.region, user.location?.countryName]
    .filter((p): p is string => Boolean(p?.trim()))
    .map((p) => p.trim());
  return parts.length ? parts.join(', ') : null;
}

function getChildrenNames(user: UserProfileVM): string[] {
  if (user.kind === 'guardian' && user.children?.items?.length) {
    return user.children.items
      .map((child: ChildProfileVM) => child.profile.displayName)
      .filter(Boolean);
  }
  return [];
}

function localTimeIconFromKey(
  key: ReturnType<typeof resolveLocalTimeIconKey>,
): LucideIcon {
  switch (key) {
    case 'morning':
      return Sunrise;
    case 'day':
      return Sun;
    case 'evening':
      return Sunset;
    case 'off-hours':
      return MoonStar;
    case 'offline':
      return CircleOff;
    case 'clock':
    default:
      return Clock3;
  }
}

function formatRelativeLastSeen(iso?: string | null): string | null {
  if (!iso) return null;
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return null;

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function buildLastSeenLabel(
  user: UserProfileVM,
  presence?: ProfilePresenceSummary | null,
): string | null {
  const displayStatus = presence?.displayStatus ?? user.presence?.displayStatus ?? null;
  if (displayStatus === 'online') return 'Online now';
  const relative = formatRelativeLastSeen(
    presence?.lastSeenAt ?? user.presence?.lastSeenAt,
  );
  return relative ? `Last seen ${relative}` : null;
}

function buildAboutFields(
  user: UserProfileVM,
  presence?: ProfilePresenceSummary | null,
): AboutField[] {
  const countryCode = normalizeCountryCode(user.location?.countryCode);
  const fields: AboutField[] = [];

  const push = (
    key: string,
    label: string,
    value: string | null | undefined,
    Icon: LucideIcon,
  ) => {
    if (!value?.trim()) return;
    fields.push({ key, label, value: value.trim(), Icon });
  };

  push('bio', 'Bio', user.profile.bio, FileText);
  push('email', 'Email', user.profile.email ?? user.accountEmail ?? null, Mail);
  push('location', 'Location', buildLocationLabel(user), MapPin);
  push(
    'localTime',
    'Current local time',
    formatLocalTimeText(user.prefs?.timezone),
    localTimeIconFromKey(
      resolveLocalTimeIconKey({
        timezone: user.prefs?.timezone,
        presenceStatus: normalizePresenceStatus(
          presence?.displayStatus ?? user.presence?.displayStatus ?? null,
        ),
      }),
    ),
  );
  push('lastSeen', 'Last seen', buildLastSeenLabel(user, presence), Clock);
  push('languages', 'Languages', user.prefs?.languagesSpoken?.join(', '), Globe);

  if (user.kind === 'educator') {
    push('headline', 'Headline', user.headline, Megaphone);
    push('subjects', 'Subjects', user.subjects?.join(', '), BookOpen);
    push(
      'grades',
      'Grades supported',
      user.gradesSupported
        ?.map((g: GradeLevel) => gradeLabel(g, countryCode))
        .filter(Boolean)
        .join(', '),
      GraduationCap,
    );
    push(
      'experience',
      'Experience',
      typeof user.experienceYears === 'number' ? `${user.experienceYears} years` : null,
      Clock,
    );
    push('education', 'Education', user.education, School);
    push(
      'certifications',
      'Certifications',
      user.certifications
        ?.map((c) => {
          if (c.issuer && c.year) return `${c.name} (${c.issuer}, ${c.year})`;
          if (c.issuer) return `${c.name} (${c.issuer})`;
          if (c.year) return `${c.name} (${c.year})`;
          return c.name;
        })
        .join(', '),
      Award,
    );
    push('curriculum', 'Curriculum', user.curriculumTags?.join(', '), BookOpen);
    push('badges', 'Badges', user.badges?.join(', '), Award);
  }

  if (user.kind === 'child') {
    push(
      'grade',
      'Grade',
      user.gradeLevel ? gradeLabel(user.gradeLevel, countryCode) : null,
      GraduationCap,
    );
    push('school', 'School', user.schoolName, School);
    push('schoolYear', 'School year', user.schoolYear, Calendar);
    push('parents', 'Parents', user.guardianNames?.join(', '), Users);
    push('interests', 'Interests', user.interests?.join(', '), Heart);
    push('strengths', 'Strengths', user.strengths?.join(', '), Sparkles);
    push('learning', 'Learning style', user.learningPreferences?.join(', '), BookOpen);
  }

  if (user.kind === 'guardian') {
    const names = getChildrenNames(user);
    push('children', 'Children', names.join(', '), Users);
  }

  if (user.kind === 'staff') {
    push('department', 'Department', user.department, Users);
    push('jobTitle', 'Job title', user.jobTitle, Award);
  }

  return fields;
}

// ─── Avatar (large) ───────────────────────────────────────────────────────────

const LARGE_AVATAR_SIZE = 80;

function LargeAvatar({ user }: { user: UserProfileVM }) {
  const avatar = user.profile.avatar;
  const name = user.profile.displayName;
  const url =
    avatar?.source === 'upload' || avatar?.source === 'external'
      ? (avatar.url ?? null)
      : null;
  const seed = avatar?.source === 'seed' ? (avatar.seed ?? user.ids.id) : user.ids.id;
  const avatarColors = profileAvatarColors({ seed, themeKey: user.ui?.themeKey });

  if (url) {
    return (
      <Image source={{ uri: url }} style={s.largeAvatar} accessibilityLabel={name} />
    );
  }

  return (
    <View
      style={[s.largeAvatar, { backgroundColor: avatarBgColor(seed, user.ui?.themeKey) }]}
    >
      <Text style={[s.largeAvatarInitials, { color: avatarColors.fg }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type ProfileSheetProps = {
  visible: boolean;
  user: UserProfileVM | null;
  onClose: () => void;
  onMessagePress?: () => void;
};

export function ProfileSheet({
  visible,
  user,
  onClose,
  onMessagePress,
}: ProfileSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const profileId = user?.ids.id ?? '';
  const orgId = user?.ids.orgId ?? '';
  const presenceQuery = useQuery({
    queryKey: ['profile-preview-presence', orgId, profileId],
    queryFn: async () => {
      const rows = await apiGet<ProfilePresenceRow[]>('/presence', {
        orgId,
        profileIds: profileId,
      });
      const row = rows[0] ?? null;
      return row
        ? {
            displayStatus: row.display_status ?? null,
            lastSeenAt: row.last_seen_at ?? null,
          }
        : null;
    },
    enabled: visible && Boolean(orgId && profileId),
    staleTime: 30 * 1000,
  });

  if (!user) return null;

  const displayName = user.profile.displayName;
  const roleLabel = roleLabelFromKind(user.kind);
  const RoleIcon = roleIconFromKind(user.kind);
  const aboutFields = buildAboutFields(user, presenceQuery.data);
  const hasPresence = user.presence?.state?.emoji || user.presence?.state?.text;

  return (
    <BottomSheet visible={visible} onClose={onClose} allowExpand>
      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <LargeAvatar user={user} />
          <RoleNameIndicator
            name={displayName}
            role={user.kind}
            iconSize={16}
            textStyle={[s.displayName, { color: colors.text }]}
            containerStyle={s.displayNameWrap}
            numberOfLines={2}
          />

          {hasPresence && (
            <View style={[s.presenceBadge, { backgroundColor: colors.card }]}>
              {user.presence?.state?.emoji ? (
                <Text style={s.presenceEmoji}>{user.presence.state.emoji}</Text>
              ) : null}
              {user.presence?.state?.text ? (
                <Text
                  style={[s.presenceText, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {user.presence.state.text}
                </Text>
              ) : null}
            </View>
          )}

          <View style={[s.roleBadge, { backgroundColor: colors.card }]}>
            <RoleIcon size={14} color={colors.textMuted} strokeWidth={2} />
            <Text style={[s.roleText, { color: colors.textMuted }]}>{roleLabel}</Text>
          </View>

          {onMessagePress ? (
            <TouchableOpacity
              style={[
                s.messageAction,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Message ${displayName}`}
              onPress={onMessagePress}
            >
              <MessageCircle size={18} color={colors.text} />
              <Text style={[s.messageActionText, { color: colors.text }]}>Message</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Separator */}
        <View style={[s.separator, { backgroundColor: colors.border }]} />

        {/* About section */}
        {aboutFields.length > 0 && (
          <View style={s.aboutSection}>
            <Text style={[s.aboutTitle, { color: colors.text }]}>About</Text>
            {aboutFields.map((field) => (
              <View key={field.key} style={s.aboutRow}>
                <field.Icon size={16} color={colors.textMuted} style={s.aboutIcon} />
                <View style={s.aboutContent}>
                  <Text style={[s.aboutLabel, { color: colors.textMuted }]}>
                    {field.label}
                  </Text>
                  <Text style={[s.aboutValue, { color: colors.text }]}>
                    {field.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 16,
  },
  largeAvatar: {
    width: LARGE_AVATAR_SIZE,
    height: LARGE_AVATAR_SIZE,
    borderRadius: LARGE_AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarInitials: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  displayNameWrap: {
    justifyContent: 'center',
    maxWidth: '100%',
  },
  presenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  presenceEmoji: {
    fontSize: 15,
  },
  presenceText: {
    fontSize: 14,
    maxWidth: 200,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  messageAction: {
    marginTop: 4,
    minWidth: 104,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  messageActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  aboutSection: {
    gap: 12,
    paddingTop: 8,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  aboutIcon: {
    marginTop: 2,
  },
  aboutContent: {
    flex: 1,
  },
  aboutLabel: {
    fontSize: 13,
  },
  aboutValue: {
    fontSize: 15,
    marginTop: 1,
  },
});
