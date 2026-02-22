import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import {
  fetchOnboardingStatus,
  saveNameStep,
  savePhoneStep,
  saveTimezoneStep,
  saveStudentStep,
  saveEducatorSubjectsStep,
  completeOnboarding,
} from '@/lib/api/queries';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONES: Array<{ id: string; label: string }> = [
  { id: 'Pacific/Auckland', label: 'New Zealand (Auckland)' },
  { id: 'Australia/Sydney', label: 'Australia (Sydney)' },
  { id: 'Australia/Melbourne', label: 'Australia (Melbourne)' },
  { id: 'Australia/Perth', label: 'Australia (Perth)' },
  { id: 'Asia/Tokyo', label: 'Japan (Tokyo)' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Colombo', label: 'Sri Lanka (Colombo)' },
  { id: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { id: 'Asia/Dhaka', label: 'Bangladesh (Dhaka)' },
  { id: 'Asia/Karachi', label: 'Pakistan (Karachi)' },
  { id: 'Asia/Dubai', label: 'UAE (Dubai)' },
  { id: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh)' },
  { id: 'Europe/Istanbul', label: 'Turkey (Istanbul)' },
  { id: 'Europe/Moscow', label: 'Russia (Moscow)' },
  { id: 'Africa/Nairobi', label: 'Kenya (Nairobi)' },
  { id: 'Africa/Lagos', label: 'Nigeria (Lagos)' },
  { id: 'Europe/Paris', label: 'France / Central Europe' },
  { id: 'Europe/London', label: 'UK (London)' },
  { id: 'America/Sao_Paulo', label: 'Brazil (São Paulo)' },
  { id: 'America/New_York', label: 'US Eastern (New York)' },
  { id: 'America/Chicago', label: 'US Central (Chicago)' },
  { id: 'America/Denver', label: 'US Mountain (Denver)' },
  { id: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)' },
  { id: 'America/Toronto', label: 'Canada (Toronto)' },
  { id: 'America/Vancouver', label: 'Canada (Vancouver)' },
];

const GRADE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pre_k', label: 'Pre-K' },
  { value: 'kindergarten', label: 'Kindergarten' },
  { value: 'grade_1', label: 'Grade 1' },
  { value: 'grade_2', label: 'Grade 2' },
  { value: 'grade_3', label: 'Grade 3' },
  { value: 'grade_4', label: 'Grade 4' },
  { value: 'grade_5', label: 'Grade 5' },
  { value: 'grade_6', label: 'Grade 6' },
  { value: 'grade_7', label: 'Grade 7' },
  { value: 'grade_8', label: 'Grade 8' },
  { value: 'grade_9', label: 'Grade 9' },
  { value: 'grade_10', label: 'Grade 10 (O/L Prep)' },
  { value: 'grade_11', label: 'Grade 11 (O/L Exam)' },
  { value: 'grade_12', label: 'Grade 12 (A/L Year 1)' },
  { value: 'grade_13', label: 'Grade 13 (A/L Year 2)' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
];

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - 4 - i);

// ─── Step types ────────────────────────────────────────────────────────────────

type WizardStepId = 'name' | 'phone' | 'timezone' | 'student-profile' | 'educator-subjects';

function buildSteps(profileKind: string | null, primaryRole: string | null): WizardStepId[] {
  const steps: WizardStepId[] = ['name', 'phone', 'timezone'];
  const kind = profileKind ?? primaryRole;
  if (kind === 'child') steps.push('student-profile');
  else if (kind === 'educator') steps.push('educator-subjects');
  return steps;
}

const STEP_META: Record<WizardStepId, { title: string; subtitle: string; emoji: string }> = {
  name: {
    emoji: '👤',
    title: 'Your name',
    subtitle: 'Let your teachers and classmates know who you are.',
  },
  phone: {
    emoji: '📱',
    title: 'Your phone number',
    subtitle: 'For important updates and reminders. You can skip this step.',
  },
  timezone: {
    emoji: '🌍',
    title: 'Your time zone',
    subtitle: 'We use this to show the right times for your sessions and schedules.',
  },
  'student-profile': {
    emoji: '🎓',
    title: 'Your school info',
    subtitle: 'Help your tutor personalise lessons for you.',
  },
  'educator-subjects': {
    emoji: '📚',
    title: 'What do you teach?',
    subtitle: 'Add the subjects you specialise in. You can update these later.',
  },
};

// ─── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return {
    placeholderColor: C.textFaint,
    ...StyleSheet.create({
      safe: { flex: 1, backgroundColor: C.pageBg },
      center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },

      header: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 4,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 10,
      },
      backBtn: {
        width: 40, height: 40,
        alignItems: 'center' as const, justifyContent: 'center' as const,
        borderRadius: 20, backgroundColor: C.inputBg,
      },
      backArrow: { fontSize: 20, color: C.teal },
      stepLabel: { fontSize: 13, color: C.textFaint, fontWeight: '500' as const },

      progressTrack: {
        height: 4, borderRadius: 2, backgroundColor: C.border,
        marginHorizontal: 20, marginBottom: 8, overflow: 'hidden' as const,
      },
      progressFill: { height: 4, borderRadius: 2, backgroundColor: C.teal },

      scrollContent: {
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40,
      },

      badge: {
        alignSelf: 'center' as const,
        width: 68, height: 68, borderRadius: 34,
        backgroundColor: C.teal + '18',
        alignItems: 'center' as const, justifyContent: 'center' as const,
        marginBottom: 20,
      },
      badgeEmoji: { fontSize: 30 },
      heading: {
        fontSize: 24, fontWeight: '700' as const, color: C.text,
        textAlign: 'center' as const, marginBottom: 6,
      },
      sub: {
        fontSize: 14, color: C.textMuted,
        textAlign: 'center' as const, marginBottom: 28, lineHeight: 20,
      },

      label: {
        fontSize: 12, fontWeight: '600' as const, color: C.textMuted,
        letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' as const,
      },

      inputWrap: {
        flexDirection: 'row' as const, alignItems: 'center' as const,
        backgroundColor: C.inputBg, borderRadius: 14,
        borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 16, marginBottom: 16, minHeight: 52,
      },
      input: {
        flex: 1, fontSize: 16, color: C.text,
        paddingVertical: 14, letterSpacing: 0,
      },
      inputHint: { fontSize: 12, color: C.textFaint, marginTop: -10, marginBottom: 16, marginLeft: 4 },

      searchBox: {
        flexDirection: 'row' as const, alignItems: 'center' as const,
        backgroundColor: C.inputBg, borderRadius: 12,
        borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12,
      },
      searchInput: { flex: 1, fontSize: 14, color: C.text },

      listItem: {
        flexDirection: 'row' as const, alignItems: 'center' as const,
        paddingHorizontal: 16, paddingVertical: 14,
        borderRadius: 12, marginBottom: 6,
        backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
      },
      listItemSelected: { backgroundColor: C.tealBg, borderColor: C.teal },
      listItemTxt: { flex: 1, fontSize: 15, color: C.text },
      listItemSelectedTxt: { color: C.teal, fontWeight: '600' as const },
      listCheck: { fontSize: 15, color: C.teal },

      tabRow: {
        flexDirection: 'row' as const, gap: 8, marginBottom: 16,
      },
      tabBtn: {
        flex: 1, paddingVertical: 10, alignItems: 'center' as const,
        borderRadius: 12, backgroundColor: C.inputBg,
        borderWidth: 1, borderColor: C.border,
      },
      tabBtnActive: { backgroundColor: C.tealBg, borderColor: C.teal },
      tabTxt: { fontSize: 14, fontWeight: '600' as const, color: C.textMuted },
      tabTxtActive: { color: C.teal },

      chipsRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 },
      chip: {
        flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
        backgroundColor: C.tealBg, borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: C.teal,
      },
      chipTxt: { fontSize: 14, color: C.teal, fontWeight: '600' as const },
      chipX: { fontSize: 16, color: C.teal, lineHeight: 18 },
      addBtn: { paddingHorizontal: 12, paddingVertical: 4, justifyContent: 'center' as const },
      addBtnTxt: { fontSize: 24, lineHeight: 28 },

      errorTxt: {
        fontSize: 13, color: '#ef4444',
        textAlign: 'center' as const, marginBottom: 12,
      },

      footer: {
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 32 : 20,
        paddingTop: 12, gap: 8,
      },
      btn: {
        backgroundColor: C.teal, borderRadius: 14,
        paddingVertical: 16, alignItems: 'center' as const,
      },
      btnDisabled: { opacity: 0.4 },
      btnTxt: { color: C.tealFg, fontSize: 16, fontWeight: '700' as const },
      skipBtn: { alignItems: 'center' as const, paddingVertical: 6 },
      skipTxt: { fontSize: 14, color: C.textFaint },
    }),
  };
}

type S = ReturnType<typeof makeStyles>;

// ─── Step sub-components ───────────────────────────────────────────────────────

function NameStep({
  firstName, setFirstName, lastName, setLastName, s, colors,
}: {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  s: S; colors: AppColors;
}) {
  return (
    <>
      <Text style={s.label}>First Name</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
          accessibilityLabel="First name"
        />
      </View>

      <Text style={s.label}>Last Name</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="done"
          accessibilityLabel="Last name"
        />
      </View>
    </>
  );
}

function PhoneStep({ phone, setPhone, s }: { phone: string; setPhone: (v: string) => void; s: S; colors: AppColors }) {
  return (
    <>
      <Text style={s.label}>Phone Number</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+94 71 234 5678"
          placeholderTextColor={s.placeholderColor}
          keyboardType="phone-pad"
          autoFocus
          returnKeyType="done"
          accessibilityLabel="Phone number"
        />
      </View>
      <Text style={s.inputHint}>Include your country code, e.g. +94, +44, +1</Text>
    </>
  );
}

function TimezoneStep({
  timezone, setTimezone, s,
}: { timezone: string; setTimezone: (v: string) => void; s: S; colors: AppColors }) {
  const [search, setSearch] = useState('');

  const allTimezones = useMemo(() => {
    try {
      const detectedId = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedId && !TIMEZONES.some((t) => t.id === detectedId)) {
        return [{ id: detectedId, label: `${detectedId} (your device)` }, ...TIMEZONES];
      }
    } catch { /* ignore */ }
    return TIMEZONES;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTimezones;
    const q = search.toLowerCase();
    return allTimezones.filter(
      (t) => t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
    );
  }, [search, allTimezones]);

  return (
    <>
      <View style={s.searchBox}>
        <Text>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search time zones…"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="none"
          accessibilityLabel="Search time zones"
        />
      </View>
      {filtered.map((item) => {
        const isSelected = timezone === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={[s.listItem, isSelected && s.listItemSelected]}
            onPress={() => setTimezone(item.id)}
            accessibilityLabel={item.label}
          >
            <Text style={[s.listItemTxt, isSelected && s.listItemSelectedTxt]}>
              {item.label}
            </Text>
            {isSelected && <Text style={s.listCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

function StudentProfileStep({
  birthYear, setBirthYear, grade, setGrade, s,
}: {
  birthYear: string; setBirthYear: (v: string) => void;
  grade: string | null; setGrade: (v: string) => void;
  s: S; colors: AppColors;
}) {
  const [tab, setTab] = useState<'grade' | 'year'>('grade');

  return (
    <>
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'grade' && s.tabBtnActive]}
          onPress={() => setTab('grade')}
        >
          <Text style={[s.tabTxt, tab === 'grade' && s.tabTxtActive]}>Grade Level</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'year' && s.tabBtnActive]}
          onPress={() => setTab('year')}
        >
          <Text style={[s.tabTxt, tab === 'year' && s.tabTxtActive]}>Birth Year</Text>
        </TouchableOpacity>
      </View>

      {tab === 'grade' ? (
        GRADE_OPTIONS.map((item) => {
          const isSelected = grade === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[s.listItem, isSelected && s.listItemSelected]}
              onPress={() => setGrade(item.value)}
              accessibilityLabel={item.label}
            >
              <Text style={[s.listItemTxt, isSelected && s.listItemSelectedTxt]}>
                {item.label}
              </Text>
              {isSelected && <Text style={s.listCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })
      ) : (
        <>
          <Text style={s.label}>Year of Birth</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={birthYear}
              onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
              placeholder={`e.g. ${BIRTH_YEARS[8]}`}
              placeholderTextColor={s.placeholderColor}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              accessibilityLabel="Birth year"
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {BIRTH_YEARS.slice(0, 16).map((yr) => (
              <TouchableOpacity
                key={yr}
                onPress={() => setBirthYear(String(yr))}
                style={[
                  s.listItem,
                  { paddingHorizontal: 12, paddingVertical: 10, minWidth: 72, justifyContent: 'center' },
                  birthYear === String(yr) && s.listItemSelected,
                ]}
              >
                <Text style={[
                  s.listItemTxt,
                  { textAlign: 'center' },
                  birthYear === String(yr) && s.listItemSelectedTxt,
                ]}>
                  {yr}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </>
  );
}

function EducatorSubjectsStep({
  subjects, setSubjects, s, colors,
}: { subjects: string[]; setSubjects: (v: string[]) => void; s: S; colors: AppColors }) {
  const [input, setInput] = useState('');

  const addSubject = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || subjects.map((s) => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      setInput('');
      return;
    }
    setSubjects([...subjects, trimmed]);
    setInput('');
  }, [input, subjects, setSubjects]);

  const removeSubject = useCallback(
    (sub: string) => setSubjects(subjects.filter((s) => s !== sub)),
    [subjects, setSubjects],
  );

  return (
    <>
      {subjects.length > 0 && (
        <View style={s.chipsRow}>
          {subjects.map((sub) => (
            <TouchableOpacity key={sub} style={s.chip} onPress={() => removeSubject(sub)}>
              <Text style={s.chipTxt}>{sub}</Text>
              <Text style={s.chipX}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={s.label}>Add Subject</Text>
      <View style={[s.inputWrap, { marginBottom: 8 }]}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="e.g. Mathematics"
          placeholderTextColor={s.placeholderColor}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={addSubject}
          accessibilityLabel="Subject name"
        />
        <TouchableOpacity
          style={s.addBtn}
          onPress={addSubject}
          disabled={!input.trim()}
          hitSlop={8}
          accessibilityLabel="Add subject"
        >
          <Text style={[s.addBtnTxt, { color: input.trim() ? colors.teal : colors.textFaint }]}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.inputHint}>Press + or Return after each subject. Tap a chip to remove it.</Text>
    </>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'; } catch { return 'UTC'; }
  });
  const [birthYear, setBirthYear] = useState('');
  const [grade, setGrade] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);

  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: onboarding, isLoading: statusLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
    staleTime: 0,
  });

  const steps = useMemo(
    () => buildSteps(onboarding?.profileKind ?? null, onboarding?.primaryRole ?? null),
    [onboarding?.profileKind, onboarding?.primaryRole],
  );
  const currentStep = steps[stepIdx] as WizardStepId | undefined;
  const isLastStep = stepIdx === steps.length - 1;

  // Pre-populate from DB
  useEffect(() => {
    if (!onboarding?.prefill) return;
    if (onboarding.prefill.firstName) setFirstName(onboarding.prefill.firstName);
    if (onboarding.prefill.lastName) setLastName(onboarding.prefill.lastName);
    if (onboarding.prefill.phone) setPhone(onboarding.prefill.phone);
    if (onboarding.prefill.timezone && onboarding.prefill.timezone !== 'UTC') {
      setTimezone(onboarding.prefill.timezone);
    }
  }, [onboarding]);

  const { mutate: advance, isPending: saving } = useMutation({
    mutationFn: async ({ isSkip, isLast }: { isSkip: boolean; isLast: boolean }) => {
      if (!onboarding?.profileId || !onboarding?.accountId) {
        throw new Error('Profile not found. Please try logging in again.');
      }

      if (!isSkip) {
        if (currentStep === 'name') {
          await saveNameStep(onboarding.profileId, firstName, lastName);
        } else if (currentStep === 'phone') {
          if (phone.trim()) await savePhoneStep(onboarding.accountId, phone);
        } else if (currentStep === 'timezone') {
          await saveTimezoneStep(onboarding.profileId, timezone);
        } else if (currentStep === 'student-profile') {
          await saveStudentStep(
            onboarding.profileId,
            onboarding.orgId ?? '',
            birthYear ? parseInt(birthYear, 10) : null,
            grade,
          );
        } else if (currentStep === 'educator-subjects') {
          await saveEducatorSubjectsStep(
            onboarding.profileId,
            onboarding.orgId ?? '',
            subjects,
          );
        }
      }

      if (isLast) {
        await completeOnboarding(onboarding.accountId);
      }
    },
    onSuccess: (_, { isLast }) => {
      setError(null);
      if (isLast) {
        queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
        queryClient.invalidateQueries({ queryKey: ['account'] });
        router.replace('/(app)/(tabs)');
      } else {
        setStepIdx((i) => i + 1);
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Something went wrong. Please try again.');
    },
  });

  const canSkip = currentStep === 'phone' ||
    currentStep === 'student-profile' ||
    currentStep === 'educator-subjects';

  const canNext = useMemo(() => {
    if (saving) return false;
    if (currentStep === 'name') return !!firstName.trim() && !!lastName.trim();
    return true;
  }, [saving, currentStep, firstName, lastName]);

  const handleNext = useCallback(() => {
    setError(null);
    if (currentStep === 'name') {
      if (!firstName.trim()) { setError('Please enter your first name.'); return; }
      if (!lastName.trim()) { setError('Please enter your last name.'); return; }
    }
    if (currentStep === 'timezone' && (!timezone || timezone === 'UTC')) {
      setError('Please select your time zone.'); return;
    }
    advance({ isSkip: false, isLast: isLastStep });
  }, [currentStep, firstName, lastName, timezone, advance, isLastStep]);

  const handleSkip = useCallback(() => {
    setError(null);
    advance({ isSkip: true, isLast: isLastStep });
  }, [advance, isLastStep]);

  const handleBack = useCallback(() => {
    if (stepIdx > 0) { setStepIdx((i) => i - 1); setError(null); }
  }, [stepIdx]);

  if (statusLoading) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </SafeAreaView>
    );
  }

  const meta = currentStep ? STEP_META[currentStep] : null;
  const progress = steps.length > 0 ? (stepIdx + 1) / steps.length : 0;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        {stepIdx > 0 ? (
          <TouchableOpacity style={s.backBtn} onPress={handleBack} hitSlop={8} accessibilityLabel="Go back">
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={s.stepLabel}>Step {stepIdx + 1} of {steps.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step badge + title */}
          {meta && (
            <>
              <View style={s.badge}>
                <Text style={s.badgeEmoji}>{meta.emoji}</Text>
              </View>
              <Text style={s.heading}>{meta.title}</Text>
              <Text style={s.sub}>{meta.subtitle}</Text>
            </>
          )}

          {/* Step content */}
          {currentStep === 'name' && (
            <NameStep
              firstName={firstName} setFirstName={setFirstName}
              lastName={lastName} setLastName={setLastName}
              s={s} colors={colors}
            />
          )}
          {currentStep === 'phone' && (
            <PhoneStep phone={phone} setPhone={setPhone} s={s} colors={colors} />
          )}
          {currentStep === 'timezone' && (
            <TimezoneStep timezone={timezone} setTimezone={setTimezone} s={s} colors={colors} />
          )}
          {currentStep === 'student-profile' && (
            <StudentProfileStep
              birthYear={birthYear} setBirthYear={setBirthYear}
              grade={grade} setGrade={setGrade}
              s={s} colors={colors}
            />
          )}
          {currentStep === 'educator-subjects' && (
            <EducatorSubjectsStep
              subjects={subjects} setSubjects={setSubjects}
              s={s} colors={colors}
            />
          )}

          {!!error && <Text style={s.errorTxt}>{error}</Text>}
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btn, !canNext && s.btnDisabled]}
            onPress={handleNext}
            disabled={!canNext || saving}
            accessibilityLabel={isLastStep ? 'Finish' : 'Next step'}
          >
            {saving ? (
              <ActivityIndicator color={colors.tealFg} />
            ) : (
              <Text style={s.btnTxt}>{isLastStep ? 'Finish →' : 'Next →'}</Text>
            )}
          </TouchableOpacity>

          {canSkip && (
            <TouchableOpacity style={s.skipBtn} onPress={handleSkip} disabled={saving}>
              <Text style={s.skipTxt}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
