import React, { useState, useCallback, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  BookOpenCheck,
  Users,
  LayoutGrid,
  LifeBuoy,
  ArrowRightLeft,
  Check,
  Sparkles,
} from 'lucide-react-native';
import { BottomSheet, Card, IconButton, SiteLogo } from '@iconicedu/ui-native';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-native/components/ui/dialog';
import { useAuth } from '@/providers/auth-provider';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useUpcomingSessions } from '@/hooks/use-upcoming-sessions';
import { useFamilyLinks } from '@/hooks/use-family-links';
import { useLearningSpaces } from '@/hooks/use-learning-spaces';
import { useSupportChannel } from '@/hooks/use-support-channel';
import { useTheme } from '@/providers/theme-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { SessionCard, type ClassSession } from '@/components/sessions/session-card';
import { AppSupportFooter } from '@/components/support/app-support-footer';
import { QueryError } from '@/components/errors/query-error';
import {
  buildHomeMetricSummary,
  buildHomeUpcomingSessionsMetricDisplay,
  splitHomeSessionsByTimeline,
} from '@/lib/home-metrics';
import {
  fetchOrgSessions,
  queryKeys,
  selfServeCancelSession,
  selfServeRescheduleSession,
  submitClassRequest,
} from '@/lib/api/queries';
import {
  OTHER_SUBJECT_OPTION,
  STANDARD_SUBJECT_OPTIONS,
  type ClassRequestIntent,
} from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';

// ---------------------------------------------------------------------------
// Avatar color helpers — ui_theme_key → hex, fallback to seed palette
// ---------------------------------------------------------------------------

function resolveAvatarColor(
  themeKey?: string | null,
  seed?: string | null,
): { bg: string; fg: string } {
  return profileAvatarColors({ seed: seed ?? 'default', themeKey });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getSupportPalette(C: AppColors) {
  const isDark = C.bg === C.pageBg && C.text === '#FFFFFF';
  return {
    bg: isDark ? '#f59e0b22' : '#fff7ed',
    border: isDark ? '#f59e0b55' : '#fdba74',
    text: isDark ? '#fbbf24' : '#c2410c',
  };
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
  }
  return trimmed[0]?.toUpperCase() ?? 'U';
}

const FAMILY_SWITCH_HANDLE_HEIGHT = 28;
const FAMILY_SWITCH_HEADER_HEIGHT = 76;
const FAMILY_SWITCH_CARD_PADDING = 36;
const FAMILY_SWITCH_ROW_HEIGHT = 62;
const FAMILY_SWITCH_ROW_GAP = 12;
const FAMILY_SWITCH_BOTTOM_PADDING = 18;
const DEFAULT_SUBJECT_OPTIONS = [...STANDARD_SUBJECT_OPTIONS, OTHER_SUBJECT_OPTION];
const DEFAULT_CLASS_REQUEST_INTENT: ClassRequestIntent = 'ongoing-tutoring';

type RequestableStudent = {
  profileId: string;
  displayName: string;
};

type SessionChangeModalState =
  | { kind: 'cancel'; session: ClassSession; note: string }
  | {
      kind: 'reschedule';
      session: ClassSession;
      date: string;
      startTime: string;
      endTime: string;
      note: string;
    }
  | null;

function toggleSelectedValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function formatSessionDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function formatSessionTimeInput(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function combineSessionLocalDateTime(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  if (!year || !month || !day || hour == null || minute == null) {
    throw new Error('Enter a valid date and time.');
  }
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function ClassRequestSheet({
  visible,
  onClose,
  students,
  defaultStudentIds,
  colors,
  s,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  students: RequestableStudent[];
  defaultStudentIds: string[];
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
  onCreated: (channelId: string) => void;
}) {
  const [studentProfileIds, setStudentProfileIds] = useState<string[]>(defaultStudentIds);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [otherSubject, setOtherSubject] = useState('');
  const [learningGoals, setLearningGoals] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setStudentProfileIds(defaultStudentIds);
    setSubjects([]);
    setOtherSubject('');
    setLearningGoals('');
    setSpecialRequirements('');
    setRequestError(null);
  }, [defaultStudentIds, visible]);

  const handleSubmit = useCallback(async () => {
    if (!studentProfileIds.length) {
      setRequestError('Select at least one student.');
      return;
    }
    if (!subjects.length) {
      setRequestError('Select at least one subject.');
      return;
    }
    if (subjects.includes(OTHER_SUBJECT_OPTION) && !otherSubject.trim()) {
      setRequestError('Enter the custom subject when "Other" is selected.');
      return;
    }

    setSubmitting(true);
    setRequestError(null);
    try {
      const response = await submitClassRequest({
        requestIntent: DEFAULT_CLASS_REQUEST_INTENT,
        studentProfileIds,
        subjects,
        otherSubject: otherSubject.trim() || null,
        learningGoals: learningGoals.trim(),
        specialRequirements: specialRequirements.trim() || null,
      });
      onClose();
      onCreated(response.channelId);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'Unable to create class request.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    learningGoals,
    onClose,
    onCreated,
    otherSubject,
    specialRequirements,
    studentProfileIds,
    subjects,
  ]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      partialHeight={640}
      sheetStyle={{ backgroundColor: colors.pageBg }}
    >
      <ScrollView
        style={{ maxHeight: 584 }}
        contentContainerStyle={s.requestSheet}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.requestHeader}>
          <Text style={s.requestTitle}>Explore Classes</Text>
          <Text style={s.requestSubtitle}>
            Tell us what you need, and we will match your family with the best tutors in
            the world to help your kids learn, grow, and thrive.
          </Text>
        </View>

        <View style={s.requestField}>
          <Text style={s.requestLabel}>Student name *</Text>
          <View style={s.requestChipRow}>
            {students.map((student) => {
              const selected = studentProfileIds.includes(student.profileId);
              return (
                <TouchableOpacity
                  key={student.profileId}
                  style={[s.requestChip, selected && s.requestChipSelected]}
                  onPress={() =>
                    setStudentProfileIds((current) =>
                      toggleSelectedValue(current, student.profileId),
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Text
                    style={[s.requestChipText, selected && s.requestChipTextSelected]}
                  >
                    {student.displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.requestField}>
          <Text style={s.requestLabel}>Subject *</Text>
          <View style={s.requestChipRow}>
            {DEFAULT_SUBJECT_OPTIONS.map((subject) => {
              const selected = subjects.includes(subject);
              return (
                <TouchableOpacity
                  key={subject}
                  style={[s.requestChip, selected && s.requestChipSelected]}
                  onPress={() =>
                    setSubjects((current) => toggleSelectedValue(current, subject))
                  }
                  activeOpacity={0.85}
                >
                  <Text
                    style={[s.requestChipText, selected && s.requestChipTextSelected]}
                  >
                    {subject}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {subjects.includes(OTHER_SUBJECT_OPTION) ? (
          <View style={s.requestField}>
            <Text style={s.requestLabel}>Other subject</Text>
            <TextInput
              style={s.requestInput}
              value={otherSubject}
              onChangeText={setOtherSubject}
              placeholder="Enter custom subject"
              placeholderTextColor={colors.textFaint}
            />
          </View>
        ) : null}

        <View style={s.requestField}>
          <Text style={s.requestLabel}>Learning goals</Text>
          <Text style={s.requestHelper}>
            What specific topics or skills should the tutor focus on?
          </Text>
          <TextInput
            style={[s.requestInput, s.requestTextArea]}
            value={learningGoals}
            onChangeText={setLearningGoals}
            placeholder="Describe the support you want"
            placeholderTextColor={colors.textFaint}
            multiline
          />
        </View>

        <View style={s.requestField}>
          <Text style={s.requestLabel}>Special requirements</Text>
          <Text style={s.requestHelper}>
            Any accommodations, learning preferences, or other notes for the tutor.
          </Text>
          <TextInput
            style={[s.requestInput, s.requestTextArea]}
            value={specialRequirements}
            onChangeText={setSpecialRequirements}
            placeholder="Optional notes"
            placeholderTextColor={colors.textFaint}
            multiline
          />
        </View>

        {requestError ? <Text style={s.requestError}>{requestError}</Text> : null}

        <TouchableOpacity
          style={[s.boostButton, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.tealFg} />
          ) : (
            <Text style={s.boostButtonText}>Submit request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}

function makeStyles(C: AppColors) {
  const supportPalette = getSupportPalette(C);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 22 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 1,
      minWidth: 0,
    },
    profileTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexShrink: 1,
      minWidth: 0,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#ffffff', fontWeight: '800', fontSize: 20 },
    profileTextWrap: {
      gap: 2,
      flexShrink: 1,
      minWidth: 0,
    },
    profileName: { fontSize: 16, color: C.text, fontWeight: '700' },
    profileEmail: { fontSize: 13, color: C.textMuted },
    familySwitchSheetContent: {
      paddingBottom: FAMILY_SWITCH_BOTTOM_PADDING,
    },
    familySwitchCard: {
      padding: 18,
      gap: 12,
    },
    familySwitchHeader: {
      gap: 4,
    },
    familySwitchTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: C.text,
    },
    familySwitchSubtitle: {
      fontSize: 14,
      color: C.textMuted,
      lineHeight: 18,
    },
    familySwitchList: {
      gap: 12,
    },
    familySwitchAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    familySwitchAvatarText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },
    switchOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bg,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    switchOptionActive: {
      borderColor: C.teal,
      backgroundColor: C.tealBg,
    },
    switchOptionText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    switchOptionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
    },
    switchOptionSubtext: {
      fontSize: 13,
      color: C.textMuted,
    },
    greetingLine: { fontSize: 16, color: C.textMuted, fontWeight: '500' },
    headlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headline: {
      fontSize: 30,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0,
      lineHeight: 36,
      flex: 1,
    },
    supportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 10,
      height: 32,
      borderRadius: 999,
      backgroundColor: supportPalette.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: supportPalette.border,
      position: 'relative',
    },
    supportBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: supportPalette.text,
    },
    supportIconWrap: {
      width: 14,
      height: 14,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricsRow: { gap: 12, paddingRight: 16 },
    metricCard: {
      minHeight: 148,
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      justifyContent: 'space-between',
    },
    metricHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    metricTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
      lineHeight: 18,
    },
    metricIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricValue: {
      fontSize: 34,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0,
      lineHeight: 38,
    },
    metricLabel: { fontSize: 13, color: C.textMuted, lineHeight: 17 },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    emptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 18,
    },
    emptyStateCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: C.border,
      backgroundColor: C.card,
      paddingHorizontal: 8,
      overflow: 'hidden',
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
    },
    emptyDesc: {
      fontSize: 15,
      color: C.textMuted,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
    },
    boostCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.teal,
      backgroundColor: C.tealBg,
      padding: 18,
      gap: 14,
    },
    boostHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    boostIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boostTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: C.text,
    },
    boostDesc: {
      marginTop: 4,
      fontSize: 14,
      color: C.textMuted,
      lineHeight: 19,
    },
    boostButton: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
    },
    boostButtonText: {
      color: C.tealFg,
      fontSize: 15,
      fontWeight: '800',
    },
    changeModalInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    changeModalInput: {
      minHeight: 42,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: C.text,
      backgroundColor: C.inputBg,
      fontSize: 14,
    },
    changeModalTextArea: {
      minHeight: 82,
      textAlignVertical: 'top',
    },
    changeModalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    changeModalSecondaryBtn: {
      minHeight: 38,
      justifyContent: 'center',
      borderRadius: 19,
      paddingHorizontal: 16,
      backgroundColor: C.inputBg,
    },
    changeModalSecondaryTxt: {
      color: C.text,
      fontWeight: '700',
    },
    changeModalPrimaryBtn: {
      minHeight: 38,
      justifyContent: 'center',
      borderRadius: 19,
      paddingHorizontal: 16,
      backgroundColor: C.teal,
    },
    changeModalPrimaryTxt: {
      color: C.tealFg,
      fontWeight: '700',
    },
    requestSheet: {
      paddingHorizontal: 18,
      paddingBottom: 24,
      gap: 16,
    },
    requestHeader: {
      gap: 6,
      paddingBottom: 2,
    },
    requestTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: C.text,
      lineHeight: 25,
    },
    requestSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: C.textMuted,
    },
    requestField: {
      gap: 7,
    },
    requestLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: C.text,
    },
    requestHelper: {
      fontSize: 13,
      color: C.textMuted,
      lineHeight: 18,
    },
    requestChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    requestChip: {
      minHeight: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    requestChipSelected: {
      borderColor: C.teal,
      backgroundColor: C.tealBg,
    },
    requestChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textMuted,
    },
    requestChipTextSelected: {
      color: C.teal,
    },
    requestInput: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      color: C.text,
      fontSize: 14,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    requestTextArea: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    requestError: {
      color: '#ef4444',
      fontSize: 13,
      lineHeight: 18,
    },
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();
  const { familySwitchOptions, switchFamilyView, isViewingAsChild } = useFamilyView();
  const {
    data: profile,
    isPending: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useProfile();
  const {
    sessions,
    isPending: sessionsLoading,
    refetch: refetchSessions,
  } = useUpcomingSessions();
  const {
    data: account,
    isPending: accountLoading,
    isError: accountError,
    refetch: refetchAccount,
  } = useAccount();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const primaryRole = (account as Record<string, unknown> | undefined)?.primary_role as
    | string
    | null
    | undefined;
  const { childProfiles } = useFamilyLinks();
  const {
    data: learningSpaces = [],
    isPending: learningSpacesLoading,
    refetch: refetchLearningSpaces,
  } = useLearningSpaces(orgId ?? '');
  const {
    data: supportChannel,
    isPending: supportLoading,
    refetch: refetchSupportChannel,
  } = useSupportChannel(orgId ?? '');
  const {
    data: orgSchedules = [],
    isPending: schedulesSummaryLoading,
    refetch: refetchOrgSchedules,
  } = useQuery({
    queryKey: queryKeys.orgSessions(orgId ?? ''),
    queryFn: () => fetchOrgSessions(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
  const { colors } = useTheme();
  const router = useRouter();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const supportPalette = React.useMemo(() => getSupportPalette(colors), [colors]);

  const profileData = profile as {
    id?: string | null;
    kind?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    avatar_seed?: string | null;
    timezone?: string | null;
    ui_theme_key?: string | null;
  } | null;
  const fullName =
    [profileData?.first_name?.trim(), profileData?.last_name?.trim()]
      .filter((value): value is string => Boolean(value))
      .join(' ') ||
    profileData?.display_name?.trim() ||
    user?.email?.split('@')[0] ||
    'User';
  const firstName =
    profileData?.first_name?.trim() ||
    profileData?.display_name?.trim()?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const initial = firstName[0]?.toUpperCase() ?? 'U';
  const avatarUrl = profileData?.avatar_url ?? null;
  const { bg: avatarBg, fg: avatarFg } = resolveAvatarColor(
    profileData?.ui_theme_key,
    profileData?.avatar_seed ?? user?.id ?? user?.email,
  );
  const secondaryHeaderText = isViewingAsChild
    ? 'Viewing as student'
    : (user?.email ?? '');

  const topMetrics = React.useMemo(
    () =>
      buildHomeMetricSummary({
        schedules: orgSchedules,
        learningSpaces: learningSpaces.map((space) => ({
          id: String((space as Record<string, unknown>).id),
          status: ((space as Record<string, unknown>).status as string | null) ?? null,
          subject: ((space as Record<string, unknown>).subject as string | null) ?? null,
          title: ((space as Record<string, unknown>).title as string | null) ?? null,
        })),
        profileKind: profileData?.kind ?? null,
        primaryRole: primaryRole ?? null,
        profileId: profileData?.id ?? null,
        childProfileIds: (childProfiles as Record<string, unknown>[]).map(
          (child) => child.id as string,
        ),
        timezone: profileData?.timezone ?? null,
      }),
    [
      childProfiles,
      learningSpaces,
      orgSchedules,
      primaryRole,
      profileData?.id,
      profileData?.kind,
      profileData?.timezone,
    ],
  );
  const metricCardWidth = Math.max(160, (windowWidth - 40 - 12) / 2);
  const ThirdMetricIcon =
    topMetrics.thirdMetricTitle === 'Active Subjects'
      ? BookOpenCheck
      : topMetrics.thirdMetricTitle === 'Active Students'
        ? Users
        : LayoutGrid;

  const [refreshing, setRefreshing] = useState(false);
  const [familySwitchOpen, setFamilySwitchOpen] = useState(false);
  const [switchingProfileId, setSwitchingProfileId] = useState<string | null>(null);
  const [todaySectionY, setTodaySectionY] = useState(0);
  const [thisWeekSectionY, setThisWeekSectionY] = useState(0);
  const sessionBuckets = React.useMemo(
    () =>
      splitHomeSessionsByTimeline({
        sessions,
        timezone: profileData?.timezone ?? null,
      }),
    [profileData?.timezone, sessions],
  );
  const todaySessions = sessionBuckets.today;
  const thisWeekSessions = sessionBuckets.thisWeek;
  const nextWeekSessions = sessionBuckets.nextWeek;
  const [classRequestOpen, setClassRequestOpen] = useState(false);
  const [sessionChangeModal, setSessionChangeModal] =
    useState<SessionChangeModalState>(null);
  const requestableStudents = React.useMemo<RequestableStudent[]>(() => {
    const children = familySwitchOptions
      .filter((option) => option.kind === 'child')
      .map((option) => ({
        profileId: option.profileId,
        displayName: option.displayName?.trim() || option.label,
      }));

    if (
      profileData?.kind === 'child' &&
      profileData.id &&
      !children.some((student) => student.profileId === profileData.id)
    ) {
      children.unshift({
        profileId: profileData.id,
        displayName: fullName,
      });
    }

    return children;
  }, [familySwitchOptions, fullName, profileData?.id, profileData?.kind]);
  const defaultRequestStudentIds = React.useMemo(() => {
    if (isViewingAsChild && profileData?.id) return [profileData.id];
    return requestableStudents[0]?.profileId ? [requestableStudents[0].profileId] : [];
  }, [isViewingAsChild, profileData?.id, requestableStudents]);
  const canRequestClasses =
    ['guardian', 'child'].includes(profileData?.kind ?? '') &&
    requestableStudents.length > 0;
  const shouldShowClassRequestCta =
    canRequestClasses &&
    !sessionsLoading &&
    !refreshing &&
    topMetrics.thirdMetricTitle === 'Active Subjects' &&
    topMetrics.thirdMetricValue === 0;
  const upcomingSessionsMetric = buildHomeUpcomingSessionsMetricDisplay({
    upcomingSessionsThisWeek: topMetrics.upcomingSessionsThisWeek,
    nextWeekSessions,
  });
  const showTodaySection = sessionsLoading || refreshing || todaySessions.length > 0;
  const showThisWeekSection =
    sessionsLoading || refreshing || thisWeekSessions.length > 0;
  const homeHeaderLoading =
    refreshing || accountLoading || profileLoading || supportLoading;
  const overviewLoading =
    refreshing ||
    accountLoading ||
    profileLoading ||
    schedulesSummaryLoading ||
    learningSpacesLoading;
  const supportFooterLoading = refreshing || accountLoading || supportLoading;
  const familySwitchRowsHeight =
    familySwitchOptions.length * FAMILY_SWITCH_ROW_HEIGHT +
    Math.max(familySwitchOptions.length - 1, 0) * FAMILY_SWITCH_ROW_GAP;
  const familySwitchSheetHeight = Math.min(
    FAMILY_SWITCH_HANDLE_HEIGHT +
      FAMILY_SWITCH_HEADER_HEIGHT +
      FAMILY_SWITCH_CARD_PADDING +
      familySwitchRowsHeight +
      FAMILY_SWITCH_BOTTOM_PADDING,
    windowHeight * 0.78,
  );
  const refreshHomeData = useCallback(
    () =>
      Promise.all([
        refetchAccount(),
        refetchProfile(),
        refetchSessions(),
        refetchLearningSpaces(),
        refetchSupportChannel(),
        refetchOrgSchedules(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.familyLinks(
            orgId ?? '',
            ((account as Record<string, unknown> | undefined)?.id as string) ?? '',
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.childProfiles(
            orgId ?? '',
            (childProfiles as Record<string, unknown>[]).map(
              (child) => child.id as string,
            ),
          ),
        }),
      ]),
    [
      account,
      childProfiles,
      orgId,
      queryClient,
      refetchAccount,
      refetchLearningSpaces,
      refetchOrgSchedules,
      refetchProfile,
      refetchSessions,
      refetchSupportChannel,
    ],
  );
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshHomeData().finally(() => setRefreshing(false));
  }, [refreshHomeData]);
  const invalidateSessionData = useCallback(async () => {
    if (!orgId) return;
    await Promise.all([
      refetchSessions(),
      refetchOrgSchedules(),
      queryClient.invalidateQueries({ queryKey: queryKeys.orgSessions(orgId) }),
    ]);
  }, [orgId, queryClient, refetchOrgSchedules, refetchSessions]);
  const cancelSessionMutation = useMutation({
    mutationFn: (input: { session: ClassSession; note?: string | null }) =>
      selfServeCancelSession({
        orgId: orgId ?? '',
        scheduleId: input.session.scheduleId ?? input.session.id,
        occurrenceKey: input.session.occurrenceKey ?? null,
        note: input.note ?? null,
      }),
    onSuccess: async (result) => {
      setSessionChangeModal(null);
      await invalidateSessionData();
      Alert.alert(
        result.approvalRequired ? 'Request sent' : 'Session canceled',
        result.approvalRequired
          ? 'This change is waiting for approval.'
          : 'The session was updated.',
      );
    },
    onError: (error) => {
      Alert.alert(
        'Unable to cancel',
        error instanceof Error ? error.message : 'Please try again.',
      );
    },
  });
  const rescheduleSessionMutation = useMutation({
    mutationFn: (input: {
      session: ClassSession;
      date: string;
      startTime: string;
      endTime: string;
      note?: string | null;
    }) =>
      selfServeRescheduleSession({
        orgId: orgId ?? '',
        scheduleId: input.session.scheduleId ?? input.session.id,
        occurrenceKey: input.session.occurrenceKey ?? null,
        startAt: combineSessionLocalDateTime(input.date, input.startTime),
        endAt: combineSessionLocalDateTime(input.date, input.endTime),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        note: input.note ?? null,
      }),
    onSuccess: async (result) => {
      setSessionChangeModal(null);
      await invalidateSessionData();
      Alert.alert(
        result.approvalRequired ? 'Request sent' : 'Session rescheduled',
        result.approvalRequired
          ? 'This change is waiting for approval.'
          : 'The session was updated.',
      );
    },
    onError: (error) => {
      Alert.alert(
        'Unable to reschedule',
        error instanceof Error ? error.message : 'Please try again.',
      );
    },
  });
  const buildSessionCardActions = useCallback(
    (session: ClassSession) => {
      if (session.isPast || session.disabled || !orgId) {
        return { cancelAction: null, rescheduleAction: null };
      }

      return {
        cancelAction: {
          onPress: () =>
            setSessionChangeModal({
              kind: 'cancel',
              session,
              note: '',
            }),
          disabled: cancelSessionMutation.isPending,
        },
        rescheduleAction: {
          onPress: () =>
            setSessionChangeModal({
              kind: 'reschedule',
              session,
              date: formatSessionDateInput(session.startAt),
              startTime: formatSessionTimeInput(session.startAt),
              endTime: formatSessionTimeInput(session.endAt),
              note: '',
            }),
          disabled: rescheduleSessionMutation.isPending,
        },
      };
    },
    [cancelSessionMutation.isPending, orgId, rescheduleSessionMutation.isPending],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshHomeData();
    }, [refreshHomeData]),
  );
  const handleUpcomingSessionsPress = useCallback(() => {
    const targetY = todaySessions.length > 0 ? todaySectionY : thisWeekSectionY;

    scrollRef.current?.scrollTo({
      y: Math.max(targetY - 16, 0),
      animated: true,
    });
  }, [thisWeekSectionY, todaySectionY, todaySessions.length]);
  const canShowFamilySwitcher =
    familySwitchOptions.length > 1 &&
    profileData?.kind &&
    ['guardian', 'child'].includes(profileData.kind);
  const handleFamilySwitch = useCallback(
    async (childProfileId: string | null) => {
      setSwitchingProfileId(childProfileId ?? '__parent__');
      setRefreshing(true);
      try {
        await switchFamilyView(childProfileId);
        await Promise.all([
          refetchAccount(),
          refetchProfile(),
          refetchSessions(),
          refetchLearningSpaces(),
          refetchSupportChannel(),
          refetchOrgSchedules(),
          queryClient.invalidateQueries({
            queryKey: queryKeys.familyLinks(
              orgId ?? '',
              ((account as Record<string, unknown> | undefined)?.id as string) ?? '',
            ),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.childProfiles(
              orgId ?? '',
              (childProfiles as Record<string, unknown>[]).map(
                (child) => child.id as string,
              ),
            ),
          }),
        ]);
        setFamilySwitchOpen(false);
      } finally {
        setSwitchingProfileId(null);
        setRefreshing(false);
      }
    },
    [
      account,
      childProfiles,
      orgId,
      queryClient,
      refetchAccount,
      refetchLearningSpaces,
      refetchOrgSchedules,
      refetchProfile,
      refetchSessions,
      refetchSupportChannel,
      switchFamilyView,
    ],
  );
  const handleClassRequestCreated = useCallback(
    (channelId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channels(orgId ?? '') });
      router.push({
        pathname: '/(app)/channel/[channelId]',
        params: { channelId },
      });
    },
    [orgId, queryClient, router],
  );

  const coreDataError = (accountError || profileError) && !account && !profile;
  if (coreDataError) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center' }]} edges={['top']}>
        <QueryError onRetry={onRefresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
          />
        }
      >
        {/* Top bar */}
        {homeHeaderLoading ? (
          <View style={s.topBar}>
            <View style={s.topBarLeft}>
              <View style={s.profileTrigger}>
                <PulseBox width={44} height={44} radius={22} />
                <View style={s.profileTextWrap}>
                  <PulseBox width={132} height={16} radius={4} />
                  <PulseBox width={168} height={12} radius={4} />
                </View>
              </View>
              <PulseBox width={32} height={32} radius={999} />
            </View>
            <PulseBox width={42} height={42} radius={12} />
          </View>
        ) : (
          <View style={s.topBar}>
            <View style={s.topBarLeft}>
              <TouchableOpacity
                style={s.profileTrigger}
                onPress={() => router.push('/(app)/(tabs)/account')}
                activeOpacity={0.8}
                accessibilityLabel="Open account"
              >
                <View
                  style={[
                    s.avatar,
                    {
                      backgroundColor: avatarUrl ? 'transparent' : avatarBg,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 44, height: 44 }}
                    />
                  ) : (
                    <Text style={[s.avatarTxt, { color: avatarFg }]}>{initial}</Text>
                  )}
                </View>
                <View style={s.profileTextWrap}>
                  <Text numberOfLines={1} style={s.profileName}>
                    {fullName}
                  </Text>
                  {!!secondaryHeaderText && (
                    <Text numberOfLines={1} style={s.profileEmail}>
                      {secondaryHeaderText}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              {canShowFamilySwitcher ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 rounded-full"
                  onPress={() => setFamilySwitchOpen(true)}
                  label="Switch family view"
                  icon={
                    <ArrowRightLeft
                      size={16}
                      color={isViewingAsChild ? colors.teal : colors.textMuted}
                    />
                  }
                />
              ) : null}
            </View>
            <SiteLogo height={32} color={colors.text} />
          </View>
        )}

        {/* Greeting */}
        {homeHeaderLoading ? (
          <View style={{ gap: 8 }}>
            <PulseBox width={160} height={16} radius={4} />
            <View style={s.headlineRow}>
              <PulseBox width={220} height={34} radius={6} />
              <PulseBox width={96} height={32} radius={999} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={s.greetingLine}>
              {getGreeting()}, {firstName}
            </Text>
            <View style={s.headlineRow}>
              <Text style={s.headline}>Welcome back</Text>
              {supportChannel?.id ? (
                <TouchableOpacity
                  style={s.supportBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/channel/[channelId]',
                      params: {
                        channelId: supportChannel.id,
                        topic: supportChannel.topic ?? 'Live Support',
                        iconKey: supportChannel.icon_key ?? 'life-buoy',
                        themeKey: supportChannel.themeKey ?? '',
                        messageUiThemeKey: supportChannel.messageUiThemeKey ?? 'feed',
                        isLearningSpace: '0',
                        purpose: 'support',
                      },
                    })
                  }
                  activeOpacity={0.8}
                  accessibilityLabel="Open live support"
                >
                  <View style={s.supportIconWrap}>
                    <LifeBuoy size={14} color={supportPalette.text} />
                  </View>
                  <Text style={s.supportBtnText}>Support</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        <View style={{ gap: 10 }}>
          <Text style={s.sectionLabel}>Overview</Text>
          {overviewLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.metricsRow}
            >
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  style={[s.metricCard, { width: metricCardWidth, gap: 18 }]}
                >
                  <View style={s.metricHeader}>
                    <PulseBox width={110} height={16} radius={4} />
                    <PulseBox width={36} height={36} radius={12} />
                  </View>
                  <View style={{ gap: 8 }}>
                    <PulseBox width={index === 1 ? 42 : 34} height={34} radius={6} />
                    <PulseBox width={90} height={12} radius={4} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.metricsRow}
            >
              <TouchableOpacity
                style={[s.metricCard, { width: metricCardWidth }]}
                onPress={handleUpcomingSessionsPress}
                activeOpacity={0.85}
                disabled={sessionsLoading || refreshing}
              >
                <View style={s.metricHeader}>
                  <Text style={s.metricTitle}>Upcoming Sessions</Text>
                  <View style={s.metricIconWrap}>
                    <CalendarClock size={18} color={colors.teal} />
                  </View>
                </View>
                <View>
                  <Text style={s.metricValue}>{upcomingSessionsMetric.value}</Text>
                  <Text style={s.metricLabel}>{upcomingSessionsMetric.label}</Text>
                </View>
              </TouchableOpacity>

              <View style={[s.metricCard, { width: metricCardWidth }]}>
                <View style={s.metricHeader}>
                  <Text style={s.metricTitle}>Completed Classes</Text>
                  <View style={s.metricIconWrap}>
                    <CalendarCheck size={18} color={colors.teal} />
                  </View>
                </View>
                <View>
                  <Text style={s.metricValue}>
                    {topMetrics.completedClassesThisMonth}
                  </Text>
                  <Text style={s.metricLabel}>This month</Text>
                </View>
              </View>

              <View style={[s.metricCard, { width: metricCardWidth }]}>
                <View style={s.metricHeader}>
                  <Text style={s.metricTitle}>{topMetrics.thirdMetricTitle}</Text>
                  <View style={s.metricIconWrap}>
                    <ThirdMetricIcon size={18} color={colors.teal} />
                  </View>
                </View>
                <View>
                  <Text style={s.metricValue}>{topMetrics.thirdMetricValue}</Text>
                  <Text style={s.metricLabel}>{topMetrics.thirdMetricLabel}</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        {/* Upcoming sessions */}
        {showTodaySection && (
          <View
            style={{ gap: 10 }}
            onLayout={(event) => setTodaySectionY(event.nativeEvent.layout.y)}
          >
            <View style={s.activityHeader}>
              <Text style={s.sectionLabel}>Today</Text>
            </View>
            {sessionsLoading || refreshing ? (
              <View style={{ gap: 6 }}>
                {[0, 1].map((i) => (
                  <View
                    key={`today-skeleton-${i}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <PulseBox width={44} height={60} radius={10} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <PulseBox width={i === 0 ? 140 : 120} height={13} radius={4} />
                      <PulseBox width={80} height={11} radius={4} />
                    </View>
                    <PulseBox width={50} height={26} radius={20} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {todaySessions.map((session) => {
                  const actions = buildSessionCardActions(session);
                  return (
                    <SessionCard
                      key={session.id}
                      session={session}
                      pressTarget="messages"
                      titleVariant="message-list"
                      cancelAction={actions.cancelAction}
                      rescheduleAction={actions.rescheduleAction}
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}

        {showThisWeekSection && (
          <View
            style={{ gap: 10 }}
            onLayout={(event) => setThisWeekSectionY(event.nativeEvent.layout.y)}
          >
            <View style={s.activityHeader}>
              <Text style={s.sectionLabel}>This week</Text>
            </View>
            {sessionsLoading || refreshing ? (
              <View style={{ gap: 6 }}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <PulseBox width={44} height={60} radius={10} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <PulseBox width={i === 0 ? 140 : 120} height={13} radius={4} />
                      <PulseBox width={80} height={11} radius={4} />
                    </View>
                    <PulseBox width={50} height={26} radius={20} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {thisWeekSessions.map((session) => {
                  const actions = buildSessionCardActions(session);
                  return (
                    <SessionCard
                      key={session.id}
                      session={session}
                      pressTarget="messages"
                      titleVariant="message-list"
                      cancelAction={actions.cancelAction}
                      rescheduleAction={actions.rescheduleAction}
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}

        <View style={{ gap: 10 }}>
          <View style={s.activityHeader}>
            <Text style={s.sectionLabel}>Next week</Text>
          </View>
          {sessionsLoading || refreshing ? (
            <View style={{ gap: 6 }}>
              {[0, 1].map((i) => (
                <View
                  key={`next-week-skeleton-${i}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <PulseBox width={44} height={60} radius={10} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <PulseBox width={i === 0 ? 140 : 120} height={13} radius={4} />
                    <PulseBox width={80} height={11} radius={4} />
                  </View>
                  <PulseBox width={50} height={26} radius={20} />
                </View>
              ))}
            </View>
          ) : nextWeekSessions.length > 0 ? (
            <View style={{ gap: 6 }}>
              {nextWeekSessions.map((session) => {
                const actions = buildSessionCardActions(session);
                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    pressTarget="messages"
                    titleVariant="message-list"
                    showJoinButton={false}
                    cancelAction={actions.cancelAction}
                    rescheduleAction={actions.rescheduleAction}
                  />
                );
              })}
            </View>
          ) : shouldShowClassRequestCta ? (
            <View style={s.boostCard}>
              <View style={s.boostHeader}>
                <View style={s.boostIcon}>
                  <Sparkles size={22} color={colors.teal} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.boostTitle}>Boost Your Learning!</Text>
                  <Text style={s.boostDesc}>
                    Add more subjects or increase session frequency for better results.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={s.boostButton}
                onPress={() => setClassRequestOpen(true)}
                activeOpacity={0.85}
              >
                <Sparkles size={16} color={colors.tealFg} />
                <Text style={s.boostButtonText}>Explore More Classes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.emptyStateCard}>
              <View style={s.emptyWrap}>
                <View style={[s.emptyIcon, { backgroundColor: colors.inputBg }]}>
                  <CalendarDays size={32} color={colors.textMuted} />
                </View>
                <Text style={s.emptyTitle}>No sessions next week</Text>
                <Text style={s.emptyDesc}>
                  Sessions scheduled for next week will appear here.
                </Text>
              </View>
            </View>
          )}
        </View>

        <AppSupportFooter isLoading={supportFooterLoading} />
      </ScrollView>
      <Dialog
        open={Boolean(sessionChangeModal)}
        onOpenChange={(open: boolean) => {
          if (!open) setSessionChangeModal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sessionChangeModal?.kind === 'cancel'
                ? 'Cancel session'
                : 'Reschedule session'}
            </DialogTitle>
          </DialogHeader>
          {sessionChangeModal?.kind === 'reschedule' ? (
            <>
              <TextInput
                value={sessionChangeModal.date}
                onChangeText={(date) =>
                  setSessionChangeModal({ ...sessionChangeModal, date })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={s.changeModalInput}
              />
              <View style={s.changeModalInputRow}>
                <TextInput
                  value={sessionChangeModal.startTime}
                  onChangeText={(startTime) =>
                    setSessionChangeModal({ ...sessionChangeModal, startTime })
                  }
                  placeholder="Start"
                  placeholderTextColor={colors.textMuted}
                  style={[s.changeModalInput, { flex: 1 }]}
                />
                <TextInput
                  value={sessionChangeModal.endTime}
                  onChangeText={(endTime) =>
                    setSessionChangeModal({ ...sessionChangeModal, endTime })
                  }
                  placeholder="End"
                  placeholderTextColor={colors.textMuted}
                  style={[s.changeModalInput, { flex: 1 }]}
                />
              </View>
            </>
          ) : null}
          <TextInput
            value={sessionChangeModal?.note ?? ''}
            onChangeText={(note) =>
              sessionChangeModal
                ? setSessionChangeModal({ ...sessionChangeModal, note })
                : undefined
            }
            placeholder="Add a note"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[s.changeModalInput, s.changeModalTextArea]}
          />
          <DialogFooter>
            <View style={s.changeModalActions}>
              <TouchableOpacity
                style={s.changeModalSecondaryBtn}
                onPress={() => setSessionChangeModal(null)}
              >
                <Text style={s.changeModalSecondaryTxt}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.changeModalPrimaryBtn}
                disabled={
                  cancelSessionMutation.isPending || rescheduleSessionMutation.isPending
                }
                onPress={() => {
                  if (!sessionChangeModal) return;
                  if (sessionChangeModal.kind === 'cancel') {
                    cancelSessionMutation.mutate({
                      session: sessionChangeModal.session,
                      note: sessionChangeModal.note,
                    });
                    return;
                  }
                  rescheduleSessionMutation.mutate(sessionChangeModal);
                }}
              >
                <Text style={s.changeModalPrimaryTxt}>
                  {sessionChangeModal?.kind === 'cancel' ? 'Send' : 'Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BottomSheet
        visible={familySwitchOpen}
        onClose={() => setFamilySwitchOpen(false)}
        partialHeight={familySwitchSheetHeight}
        sheetStyle={{ backgroundColor: colors.pageBg }}
      >
        <View style={s.familySwitchSheetContent}>
          <Card style={s.familySwitchCard}>
            <View style={s.familySwitchHeader}>
              <Text style={s.familySwitchTitle}>View as</Text>
              <Text style={s.familySwitchSubtitle}>
                Switch between your parent view and linked child accounts.
              </Text>
            </View>
            <View style={s.familySwitchList}>
              {familySwitchOptions.map((option) => {
                const optionTitle = option.displayName?.trim() || option.label;
                const optionSubtitle = option.isParentOption ? 'Parent' : 'Child';
                const isSwitching =
                  switchingProfileId ===
                  (option.isParentOption ? '__parent__' : option.profileId);
                const optionSeed = option.avatarSeed ?? option.profileId;
                const { bg: optionAvatarBg, fg: optionAvatarFg } = resolveAvatarColor(
                  option.themeKey ?? null,
                  optionSeed,
                );

                return (
                  <TouchableOpacity
                    key={option.profileId}
                    style={[
                      s.switchOption,
                      option.isActive ? s.switchOptionActive : null,
                    ]}
                    disabled={option.isActive || Boolean(switchingProfileId)}
                    onPress={() =>
                      handleFamilySwitch(option.isParentOption ? null : option.profileId)
                    }
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        s.familySwitchAvatar,
                        {
                          backgroundColor: option.avatarUrl
                            ? 'transparent'
                            : optionAvatarBg,
                        },
                      ]}
                    >
                      {option.avatarUrl ? (
                        <Image
                          source={{ uri: option.avatarUrl }}
                          style={{ width: 36, height: 36 }}
                        />
                      ) : (
                        <Text
                          style={[s.familySwitchAvatarText, { color: optionAvatarFg }]}
                        >
                          {getInitials(optionTitle)}
                        </Text>
                      )}
                    </View>
                    <View style={s.switchOptionText}>
                      <Text numberOfLines={1} style={s.switchOptionLabel}>
                        {optionTitle}
                      </Text>
                      <Text numberOfLines={1} style={s.switchOptionSubtext}>
                        {isSwitching ? 'Switching...' : optionSubtitle}
                      </Text>
                    </View>
                    {option.isActive ? <Check size={18} color={colors.teal} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>
      </BottomSheet>
      <ClassRequestSheet
        visible={classRequestOpen}
        onClose={() => setClassRequestOpen(false)}
        students={requestableStudents}
        defaultStudentIds={defaultRequestStudentIds}
        colors={colors}
        s={s}
        onCreated={handleClassRequestCreated}
      />
    </SafeAreaView>
  );
}
