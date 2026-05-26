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
import {
  Users,
  FileText,
  Mail,
  MapPin,
  Globe,
  BookOpen,
  GraduationCap,
  Clock,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AboutField = {
  key: string;
  label: string;
  value: string;
  Icon: LucideIcon;
};

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

function formatLocalTime(timezone?: string | null): string | null {
  const value = timezone?.trim();
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: value,
    }).format(new Date());
  } catch {
    return null;
  }
}

function buildAboutFields(user: UserProfileVM): AboutField[] {
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

  push('role', 'Role', roleLabelFromKind(user.kind), Users);
  push('bio', 'Bio', user.profile.bio, FileText);
  push('email', 'Email', user.profile.email ?? user.accountEmail ?? null, Mail);
  push('location', 'Location', buildLocationLabel(user), MapPin);
  push('timezone', 'Timezone', user.prefs?.timezone, Globe);
  push('localTime', 'Current local time', formatLocalTime(user.prefs?.timezone), Clock);
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

  if (url) {
    return (
      <Image source={{ uri: url }} style={s.largeAvatar} accessibilityLabel={name} />
    );
  }

  return (
    <View style={[s.largeAvatar, { backgroundColor: avatarBgColor(seed) }]}>
      <Text style={s.largeAvatarInitials}>{getInitials(name)}</Text>
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

  if (!user) return null;

  const displayName = user.profile.displayName;
  const roleLabel = roleLabelFromKind(user.kind);
  const aboutFields = buildAboutFields(user);
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
          <Text style={[s.displayName, { color: colors.text }]}>{displayName}</Text>

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
              <View style={[s.messageActionIcon, { backgroundColor: colors.inputBg }]}>
                <MessageCircle size={18} color={colors.text} />
              </View>
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
  messageActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
