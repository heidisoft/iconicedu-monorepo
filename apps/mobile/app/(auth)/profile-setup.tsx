import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import {
  fetchOnboardingStatus,
  saveNameStep,
  savePhoneStep,
  saveTimezoneStep,
  saveLocationStep,
  saveStudentStep,
  saveEducatorProfileStep,
  saveEducatorAvailabilityStep,
  completeOnboarding,
  type OnboardingStatus,
} from '@/lib/api/queries';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONES: Array<{ id: string; label: string }> = [
  { id: 'Pacific/Auckland',    label: 'New Zealand (Auckland)' },
  { id: 'Australia/Sydney',    label: 'Australia (Sydney)' },
  { id: 'Australia/Melbourne', label: 'Australia (Melbourne)' },
  { id: 'Australia/Perth',     label: 'Australia (Perth)' },
  { id: 'Asia/Tokyo',          label: 'Japan (Tokyo)' },
  { id: 'Asia/Singapore',      label: 'Singapore' },
  { id: 'Asia/Colombo',        label: 'Sri Lanka (Colombo)' },
  { id: 'Asia/Kolkata',        label: 'India (Kolkata)' },
  { id: 'Asia/Dhaka',          label: 'Bangladesh (Dhaka)' },
  { id: 'Asia/Karachi',        label: 'Pakistan (Karachi)' },
  { id: 'Asia/Dubai',          label: 'UAE (Dubai)' },
  { id: 'Asia/Riyadh',         label: 'Saudi Arabia (Riyadh)' },
  { id: 'Europe/Istanbul',     label: 'Turkey (Istanbul)' },
  { id: 'Europe/Moscow',       label: 'Russia (Moscow)' },
  { id: 'Africa/Nairobi',      label: 'Kenya (Nairobi)' },
  { id: 'Africa/Lagos',        label: 'Nigeria (Lagos)' },
  { id: 'Europe/Paris',        label: 'France / Central Europe' },
  { id: 'Europe/London',       label: 'UK (London)' },
  { id: 'America/Sao_Paulo',   label: 'Brazil (São Paulo)' },
  { id: 'America/New_York',    label: 'US Eastern (New York)' },
  { id: 'America/Chicago',     label: 'US Central (Chicago)' },
  { id: 'America/Denver',      label: 'US Mountain (Denver)' },
  { id: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)' },
  { id: 'America/Toronto',     label: 'Canada (Toronto)' },
  { id: 'America/Vancouver',   label: 'Canada (Vancouver)' },
];

const COUNTRIES: Array<{ code: string; label: string; flag: string }> = [
  { code: 'LK', label: 'Sri Lanka',      flag: '🇱🇰' },
  { code: 'IN', label: 'India',          flag: '🇮🇳' },
  { code: 'AU', label: 'Australia',      flag: '🇦🇺' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', label: 'United States',  flag: '🇺🇸' },
  { code: 'CA', label: 'Canada',         flag: '🇨🇦' },
  { code: 'NZ', label: 'New Zealand',    flag: '🇳🇿' },
  { code: 'SG', label: 'Singapore',      flag: '🇸🇬' },
  { code: 'AE', label: 'UAE',            flag: '🇦🇪' },
  { code: 'SA', label: 'Saudi Arabia',   flag: '🇸🇦' },
  { code: 'PK', label: 'Pakistan',       flag: '🇵🇰' },
  { code: 'BD', label: 'Bangladesh',     flag: '🇧🇩' },
  { code: 'MY', label: 'Malaysia',       flag: '🇲🇾' },
  { code: 'KE', label: 'Kenya',          flag: '🇰🇪' },
  { code: 'NG', label: 'Nigeria',        flag: '🇳🇬' },
  { code: 'ZA', label: 'South Africa',   flag: '🇿🇦' },
  { code: 'FR', label: 'France',         flag: '🇫🇷' },
  { code: 'DE', label: 'Germany',        flag: '🇩🇪' },
  { code: 'TR', label: 'Turkey',         flag: '🇹🇷' },
  { code: 'BR', label: 'Brazil',         flag: '🇧🇷' },
  { code: 'JP', label: 'Japan',          flag: '🇯🇵' },
  { code: 'CN', label: 'China',          flag: '🇨🇳' },
  { code: 'PH', label: 'Philippines',    flag: '🇵🇭' },
  { code: 'OM', label: 'Oman',           flag: '🇴🇲' },
  { code: 'QA', label: 'Qatar',          flag: '🇶🇦' },
];

const GRADE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pre_k',         label: 'Pre-K' },
  { value: 'kindergarten',  label: 'Kindergarten' },
  { value: 'grade_1',       label: 'Grade 1' },
  { value: 'grade_2',       label: 'Grade 2' },
  { value: 'grade_3',       label: 'Grade 3' },
  { value: 'grade_4',       label: 'Grade 4' },
  { value: 'grade_5',       label: 'Grade 5' },
  { value: 'grade_6',       label: 'Grade 6' },
  { value: 'grade_7',       label: 'Grade 7' },
  { value: 'grade_8',       label: 'Grade 8' },
  { value: 'grade_9',       label: 'Grade 9' },
  { value: 'grade_10',      label: 'Grade 10 (O/L Prep)' },
  { value: 'grade_11',      label: 'Grade 11 (O/L Exam)' },
  { value: 'grade_12',      label: 'Grade 12 (A/L Year 1)' },
  { value: 'grade_13',      label: 'Grade 13 (A/L Year 2)' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate',      label: 'Graduate' },
];

const EDUCATOR_SUBJECTS = [
  'Mathematics', 'Science', 'English Language Arts', 'Social Studies',
  'STEM & Coding', 'Creative Arts', 'Music & Performance',
  'Mindfulness & SEL', 'Language Studies', 'Career Readiness',
];

const CLASS_TYPES = [
  { id: 'online',     label: 'Online' },
  { id: 'in_person',  label: 'In-Person' },
  { id: 'hybrid',     label: 'Hybrid' },
];

const DAYS_OF_WEEK = [
  { id: 'monday',    short: 'Mon' },
  { id: 'tuesday',   short: 'Tue' },
  { id: 'wednesday', short: 'Wed' },
  { id: 'thursday',  short: 'Thu' },
  { id: 'friday',    short: 'Fri' },
  { id: 'saturday',  short: 'Sat' },
  { id: 'sunday',    short: 'Sun' },
];

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - 4 - i);

// ─── Step types ────────────────────────────────────────────────────────────────

type WizardStepId =
  | 'name'
  | 'phone'
  | 'timezone'
  | 'location'
  | 'student-profile'
  | 'educator-profile'
  | 'educator-availability';

function buildSteps(profileKind: string | null, primaryRole: string | null): WizardStepId[] {
  const steps: WizardStepId[] = ['name', 'phone', 'timezone', 'location'];
  const kind = profileKind ?? primaryRole;
  if (kind === 'child') steps.push('student-profile');
  else if (kind === 'educator') {
    steps.push('educator-profile');
    steps.push('educator-availability');
  }
  // guardian: universal steps cover requirements; family management handled separately
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
    subtitle: 'For important updates and reminders. Include your country code (e.g. +94, +44, +1).',
  },
  timezone: {
    emoji: '🌍',
    title: 'Your time zone',
    subtitle: 'We use this to show the right times for your sessions and schedules.',
  },
  location: {
    emoji: '📍',
    title: 'Your location',
    subtitle: 'Used to personalise your experience and show relevant grade and curriculum options.',
  },
  'student-profile': {
    emoji: '🎓',
    title: 'Your school info',
    subtitle: 'Help your tutor personalise lessons for you.',
  },
  'educator-profile': {
    emoji: '📚',
    title: 'Your teaching profile',
    subtitle: 'Tell us what subjects and grade levels you specialise in.',
  },
  'educator-availability': {
    emoji: '🗓️',
    title: 'Your availability',
    subtitle: 'Let students know when you\'re available and how you like to teach.',
  },
};

// ─── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return {
    placeholderColor: C.textFaint,
    ...StyleSheet.create({
      safe:   { flex: 1, backgroundColor: C.pageBg },
      center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },

      header: {
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
        flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
      },
      backBtn: {
        width: 40, height: 40, alignItems: 'center' as const,
        justifyContent: 'center' as const, borderRadius: 20, backgroundColor: C.inputBg,
      },
      backArrow: { fontSize: 20, color: C.teal },
      stepLabel: { fontSize: 13, color: C.textFaint, fontWeight: '500' as const },

      progressTrack: {
        height: 4, borderRadius: 2, backgroundColor: C.border,
        marginHorizontal: 20, marginBottom: 8, overflow: 'hidden' as const,
      },
      progressFill: { height: 4, borderRadius: 2, backgroundColor: C.teal },

      scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },

      badge: {
        alignSelf: 'center' as const, width: 68, height: 68, borderRadius: 34,
        backgroundColor: C.teal + '18', alignItems: 'center' as const,
        justifyContent: 'center' as const, marginBottom: 20,
      },
      badgeEmoji: { fontSize: 30 },
      heading: {
        fontSize: 24, fontWeight: '700' as const, color: C.text,
        textAlign: 'center' as const, marginBottom: 6,
      },
      sub: {
        fontSize: 14, color: C.textMuted, textAlign: 'center' as const,
        marginBottom: 28, lineHeight: 20,
      },

      label: {
        fontSize: 12, fontWeight: '600' as const, color: C.textMuted,
        letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' as const,
      },
      labelOptional: { fontWeight: '400' as const, textTransform: 'none' as const, fontSize: 11 },

      inputWrap: {
        flexDirection: 'row' as const, alignItems: 'center' as const,
        backgroundColor: C.inputBg, borderRadius: 14,
        borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 16, marginBottom: 16, minHeight: 52,
      },
      input: { flex: 1, fontSize: 16, color: C.text, paddingVertical: 14 },
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
      listItemSelected:    { backgroundColor: C.tealBg, borderColor: C.teal },
      listItemTxt:         { flex: 1, fontSize: 15, color: C.text },
      listItemSelectedTxt: { color: C.teal, fontWeight: '600' as const },
      listCheck:           { fontSize: 15, color: C.teal },
      listFlag:            { fontSize: 20, marginRight: 10 },
      listChevron:         { fontSize: 18, color: C.textFaint },

      tabRow:       { flexDirection: 'row' as const, gap: 8, marginBottom: 16 },
      tabBtn:       {
        flex: 1, paddingVertical: 10, alignItems: 'center' as const,
        borderRadius: 12, backgroundColor: C.inputBg,
        borderWidth: 1, borderColor: C.border,
      },
      tabBtnActive: { backgroundColor: C.tealBg, borderColor: C.teal },
      tabTxt:       { fontSize: 14, fontWeight: '600' as const, color: C.textMuted },
      tabTxtActive: { color: C.teal },

      chipsRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 },
      chip: {
        flexDirection: 'row' as const, alignItems: 'center' as const,
        paddingHorizontal: 14, paddingVertical: 9,
        borderRadius: 20, borderWidth: 1,
      },
      chipTxt: { fontSize: 14, fontWeight: '500' as const },

      sectionLabel: {
        fontSize: 13, fontWeight: '700' as const, color: C.text,
        marginBottom: 10, marginTop: 4,
      },
      sectionHint: { fontSize: 12, color: C.textFaint, marginBottom: 12 },

      dayRow: {
        flexDirection: 'row' as const, alignItems: 'center' as const,
        paddingHorizontal: 14, paddingVertical: 12,
        backgroundColor: C.inputBg, borderRadius: 12,
        borderWidth: 1, borderColor: C.border, marginBottom: 8,
        gap: 10,
      },
      dayRowActive: { backgroundColor: C.tealBg, borderColor: C.teal },
      dayToggle: {
        width: 24, height: 24, borderRadius: 12,
        borderWidth: 2, borderColor: C.border,
        alignItems: 'center' as const, justifyContent: 'center' as const,
      },
      dayToggleActive: { backgroundColor: C.teal, borderColor: C.teal },
      dayToggleTxt: { fontSize: 13, color: '#ffffff', fontWeight: '700' as const },
      dayLabel: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' as const },
      dayLabelActive: { color: C.teal },
      timeRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
      timeInput: {
        backgroundColor: C.pageBg, borderRadius: 8,
        borderWidth: 1, borderColor: C.teal,
        paddingHorizontal: 10, paddingVertical: 6,
        fontSize: 13, color: C.text, width: 60, textAlign: 'center' as const,
      },
      timeSep: { fontSize: 13, color: C.textMuted },

      numberInputRow: {
        flexDirection: 'row' as const, alignItems: 'center' as const,
        backgroundColor: C.inputBg, borderRadius: 14,
        borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 16, marginBottom: 8, minHeight: 52, gap: 10,
      },
      numberInput: { flex: 1, fontSize: 16, color: C.text, paddingVertical: 14 },
      numberUnit: { fontSize: 14, color: C.textMuted },

      errorTxt: { fontSize: 13, color: '#ef4444', textAlign: 'center' as const, marginBottom: 12 },

      footer: {
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 32 : 20,
        paddingTop: 12, gap: 8,
      },
      btn:     { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: 'center' as const },
      btnDim:  { opacity: 0.4 },
      btnTxt:  { color: C.tealFg, fontSize: 16, fontWeight: '700' as const },
      skipBtn: { alignItems: 'center' as const, paddingVertical: 6 },
      skipTxt: { fontSize: 14, color: C.textFaint },
    }),
  };
}

type S = ReturnType<typeof makeStyles>;

// ─── Step sub-components ───────────────────────────────────────────────────────

function NameStep({ firstName, setFirstName, lastName, setLastName, s }: {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  s: S; colors: AppColors;
}) {
  return (
    <>
      <Text style={s.label}>First Name</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input} value={firstName} onChangeText={setFirstName}
          placeholder="First name" placeholderTextColor={s.placeholderColor}
          autoCapitalize="words" autoFocus returnKeyType="next"
        />
      </View>
      <Text style={s.label}>Last Name</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input} value={lastName} onChangeText={setLastName}
          placeholder="Last name" placeholderTextColor={s.placeholderColor}
          autoCapitalize="words" returnKeyType="done"
        />
      </View>
    </>
  );
}

function PhoneStep({ phone, setPhone, s, isChild }: {
  phone: string; setPhone: (v: string) => void;
  s: S; colors: AppColors; isChild: boolean;
}) {
  return (
    <>
      <Text style={s.label}>Phone Number{isChild ? <Text style={s.labelOptional}> (optional)</Text> : null}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input} value={phone} onChangeText={setPhone}
          placeholder="+94 71 234 5678" placeholderTextColor={s.placeholderColor}
          keyboardType="phone-pad" autoFocus returnKeyType="done"
        />
      </View>
      <Text style={s.inputHint}>Include your country code, e.g. +94, +44, +1</Text>
    </>
  );
}

function TimezoneStep({ timezone, setTimezone, s }: {
  timezone: string; setTimezone: (v: string) => void; s: S; colors: AppColors;
}) {
  const [search, setSearch] = useState('');

  const allTimezones = useMemo(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && !TIMEZONES.some((t) => t.id === detected)) {
        return [{ id: detected, label: `${detected} (your device)` }, ...TIMEZONES];
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
          style={s.searchInput} value={search} onChangeText={setSearch}
          placeholder="Search time zones…" placeholderTextColor={s.placeholderColor}
          autoCapitalize="none"
        />
      </View>
      {filtered.map((item) => {
        const sel = timezone === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={[s.listItem, sel && s.listItemSelected]}
            onPress={() => setTimezone(item.id)}
          >
            <Text style={[s.listItemTxt, sel && s.listItemSelectedTxt]}>{item.label}</Text>
            {sel && <Text style={s.listCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

function LocationStep({
  city, setCity, region, setRegion, postalCode, setPostalCode, countryCode, setCountryCode, s,
}: {
  city: string; setCity: (v: string) => void;
  region: string; setRegion: (v: string) => void;
  postalCode: string; setPostalCode: (v: string) => void;
  countryCode: string; setCountryCode: (v: string) => void;
  s: S; colors: AppColors;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [search]);

  if (showPicker) {
    return (
      <>
        <TouchableOpacity
          style={[s.listItem, { marginBottom: 12 }]}
          onPress={() => { setShowPicker(false); setSearch(''); }}
        >
          <Text style={s.listCheck}>‹</Text>
          <Text style={[s.listItemTxt, { marginLeft: 8 }]}>Back to location</Text>
        </TouchableOpacity>
        <View style={s.searchBox}>
          <Text>🔍</Text>
          <TextInput
            style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search countries…" placeholderTextColor={s.placeholderColor}
            autoFocus autoCapitalize="none"
          />
        </View>
        {filtered.map((c) => {
          const sel = countryCode === c.code;
          return (
            <TouchableOpacity
              key={c.code}
              style={[s.listItem, sel && s.listItemSelected]}
              onPress={() => { setCountryCode(c.code); setShowPicker(false); setSearch(''); }}
            >
              <Text style={s.listFlag}>{c.flag}</Text>
              <Text style={[s.listItemTxt, sel && s.listItemSelectedTxt]}>{c.label}</Text>
              {sel && <Text style={s.listCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </>
    );
  }

  return (
    <>
      <Text style={s.label}>Country</Text>
      <TouchableOpacity
        style={[s.inputWrap, { marginBottom: 16 }]}
        onPress={() => setShowPicker(true)}
      >
        {selectedCountry && <Text style={s.listFlag}>{selectedCountry.flag}</Text>}
        <Text style={[s.input, { paddingVertical: 0, color: selectedCountry ? undefined : s.placeholderColor }]}>
          {selectedCountry?.label ?? 'Select country…'}
        </Text>
        <Text style={s.listChevron}>›</Text>
      </TouchableOpacity>

      <Text style={s.label}>City</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input} value={city} onChangeText={setCity}
          placeholder="e.g. Colombo" placeholderTextColor={s.placeholderColor}
          autoCapitalize="words" returnKeyType="next"
        />
      </View>

      <Text style={s.label}>State / Region / Province</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input} value={region} onChangeText={setRegion}
          placeholder="e.g. Western Province" placeholderTextColor={s.placeholderColor}
          autoCapitalize="words" returnKeyType="next"
        />
      </View>

      <Text style={s.label}>
        Postal Code{'  '}
        <Text style={s.labelOptional}>(optional)</Text>
      </Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input} value={postalCode} onChangeText={setPostalCode}
          placeholder="e.g. 00100" placeholderTextColor={s.placeholderColor}
          returnKeyType="done"
        />
      </View>
    </>
  );
}

function StudentProfileStep({ birthYear, setBirthYear, grade, setGrade, s }: {
  birthYear: string; setBirthYear: (v: string) => void;
  grade: string | null; setGrade: (v: string) => void;
  s: S; colors: AppColors;
}) {
  const [tab, setTab] = useState<'grade' | 'year'>('grade');
  return (
    <>
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tabBtn, tab === 'grade' && s.tabBtnActive]} onPress={() => setTab('grade')}>
          <Text style={[s.tabTxt, tab === 'grade' && s.tabTxtActive]}>Grade Level</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'year' && s.tabBtnActive]} onPress={() => setTab('year')}>
          <Text style={[s.tabTxt, tab === 'year' && s.tabTxtActive]}>Birth Year</Text>
        </TouchableOpacity>
      </View>

      {tab === 'grade' ? (
        GRADE_OPTIONS.map((item) => {
          const sel = grade === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[s.listItem, sel && s.listItemSelected]}
              onPress={() => setGrade(item.value)}
            >
              <Text style={[s.listItemTxt, sel && s.listItemSelectedTxt]}>{item.label}</Text>
              {sel && <Text style={s.listCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })
      ) : (
        <>
          <Text style={s.label}>Year of Birth</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input} value={birthYear}
              onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
              placeholder={`e.g. ${BIRTH_YEARS[8]}`} placeholderTextColor={s.placeholderColor}
              keyboardType="number-pad" maxLength={4} autoFocus
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
                  s.listItemTxt, { textAlign: 'center' },
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

function EducatorProfileStep({
  subjects, setSubjects, gradeLevels, setGradeLevels, s, colors,
}: {
  subjects: string[]; setSubjects: (v: string[]) => void;
  gradeLevels: string[]; setGradeLevels: (v: string[]) => void;
  s: S; colors: AppColors;
}) {
  const toggleSubject = useCallback((subject: string) => {
    setSubjects(subjects.includes(subject)
      ? subjects.filter((x) => x !== subject)
      : [...subjects, subject]);
  }, [subjects, setSubjects]);

  const toggleGrade = useCallback((grade: string) => {
    setGradeLevels(gradeLevels.includes(grade)
      ? gradeLevels.filter((x) => x !== grade)
      : [...gradeLevels, grade]);
  }, [gradeLevels, setGradeLevels]);

  return (
    <>
      <Text style={s.sectionLabel}>Subjects you teach</Text>
      <Text style={s.sectionHint}>Select all that apply. You can update these later.</Text>
      <View style={s.chipsRow}>
        {EDUCATOR_SUBJECTS.map((subject) => {
          const sel = subjects.includes(subject);
          return (
            <TouchableOpacity
              key={subject}
              style={[
                s.chip,
                {
                  backgroundColor: sel ? colors.tealBg : colors.inputBg,
                  borderColor: sel ? colors.teal : colors.border,
                },
              ]}
              onPress={() => toggleSubject(subject)}
            >
              {sel && <Text style={{ color: colors.teal, fontSize: 13 }}>✓ </Text>}
              <Text style={[s.chipTxt, { color: sel ? colors.teal : colors.textMuted }]}>{subject}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.sectionLabel, { marginTop: 8 }]}>Grade levels you teach</Text>
      <Text style={s.sectionHint}>Select all grade levels you're comfortable teaching.</Text>
      {GRADE_OPTIONS.map((item) => {
        const sel = gradeLevels.includes(item.value);
        return (
          <TouchableOpacity
            key={item.value}
            style={[s.listItem, sel && s.listItemSelected]}
            onPress={() => toggleGrade(item.value)}
          >
            <Text style={[s.listItemTxt, sel && s.listItemSelectedTxt]}>{item.label}</Text>
            {sel && <Text style={s.listCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
      <Text style={s.inputHint}>At least one subject and one grade level are required.</Text>
    </>
  );
}

function EducatorAvailabilityStep({
  classTypes, setClassTypes, weeklyHours, setWeeklyHours, daySlots, setDaySlots, s, colors,
}: {
  classTypes: string[]; setClassTypes: (v: string[]) => void;
  weeklyHours: string; setWeeklyHours: (v: string) => void;
  daySlots: Record<string, { start: string; end: string }>;
  setDaySlots: (v: Record<string, { start: string; end: string }>) => void;
  s: S; colors: AppColors;
}) {
  const toggleClassType = useCallback((id: string) => {
    setClassTypes(classTypes.includes(id)
      ? classTypes.filter((x) => x !== id)
      : [...classTypes, id]);
  }, [classTypes, setClassTypes]);

  const toggleDay = useCallback((dayId: string) => {
    if (daySlots[dayId]) {
      const next = { ...daySlots };
      delete next[dayId];
      setDaySlots(next);
    } else {
      setDaySlots({ ...daySlots, [dayId]: { start: '09:00', end: '17:00' } });
    }
  }, [daySlots, setDaySlots]);

  const updateTime = useCallback((dayId: string, field: 'start' | 'end', value: string) => {
    setDaySlots({ ...daySlots, [dayId]: { ...daySlots[dayId], [field]: value } });
  }, [daySlots, setDaySlots]);

  return (
    <>
      <Text style={s.sectionLabel}>How do you teach?</Text>
      <View style={[s.chipsRow, { marginBottom: 20 }]}>
        {CLASS_TYPES.map((ct) => {
          const sel = classTypes.includes(ct.id);
          return (
            <TouchableOpacity
              key={ct.id}
              style={[
                s.chip,
                {
                  backgroundColor: sel ? colors.tealBg : colors.inputBg,
                  borderColor: sel ? colors.teal : colors.border,
                },
              ]}
              onPress={() => toggleClassType(ct.id)}
            >
              {sel && <Text style={{ color: colors.teal, fontSize: 13 }}>✓ </Text>}
              <Text style={[s.chipTxt, { color: sel ? colors.teal : colors.textMuted }]}>{ct.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.sectionLabel}>Weekly commitment <Text style={s.sectionHint}>(optional)</Text></Text>
      <View style={s.numberInputRow}>
        <TextInput
          style={s.numberInput} value={weeklyHours}
          onChangeText={(v) => setWeeklyHours(v.replace(/\D/g, ''))}
          placeholder="e.g. 10" placeholderTextColor={s.placeholderColor}
          keyboardType="number-pad" maxLength={3}
        />
        <Text style={s.numberUnit}>hours / week</Text>
      </View>

      <Text style={[s.sectionLabel, { marginTop: 4 }]}>Available days & times</Text>
      <Text style={s.sectionHint}>Toggle a day to set your available hours for that day.</Text>
      {DAYS_OF_WEEK.map((day) => {
        const isOn = !!daySlots[day.id];
        return (
          <View key={day.id} style={[s.dayRow, isOn && s.dayRowActive]}>
            <TouchableOpacity
              style={[s.dayToggle, isOn && s.dayToggleActive]}
              onPress={() => toggleDay(day.id)}
              hitSlop={8}
            >
              {isOn && <Text style={s.dayToggleTxt}>✓</Text>}
            </TouchableOpacity>
            <Text style={[s.dayLabel, isOn && s.dayLabelActive]}>{day.short}</Text>
            {isOn && (
              <View style={s.timeRow}>
                <TextInput
                  style={s.timeInput}
                  value={daySlots[day.id].start}
                  onChangeText={(v) => updateTime(day.id, 'start', v)}
                  placeholder="09:00"
                  placeholderTextColor={s.placeholderColor}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <Text style={s.timeSep}>–</Text>
                <TextInput
                  style={s.timeInput}
                  value={daySlots[day.id].end}
                  onChangeText={(v) => updateTime(day.id, 'end', v)}
                  placeholder="17:00"
                  placeholderTextColor={s.placeholderColor}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            )}
          </View>
        );
      })}
      <Text style={[s.inputHint, { marginTop: 4 }]}>Select at least one teaching format and one available day.</Text>
    </>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { session } = useAuth();

  // Redirect to login if somehow reached without a session
  useEffect(() => {
    if (!session) router.replace('/(auth)/login');
  }, [session, router]);

  // Form state — universal
  const [firstName, setFirstName]     = useState('');
  const [lastName, setLastName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [timezone, setTimezone]       = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'; } catch { return 'UTC'; }
  });
  const [city, setCity]               = useState('');
  const [region, setRegion]           = useState('');
  const [postalCode, setPostalCode]   = useState('');
  const [countryCode, setCountryCode] = useState('LK');

  // Student-specific
  const [birthYear, setBirthYear]     = useState('');
  const [grade, setGrade]             = useState<string | null>(null);

  // Educator-specific
  const [subjects, setSubjects]       = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<string[]>([]);
  const [classTypes, setClassTypes]   = useState<string[]>([]);
  const [weeklyHours, setWeeklyHours] = useState('');
  const [daySlots, setDaySlots]       = useState<Record<string, { start: string; end: string }>>({});

  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError]     = useState<string | null>(null);

  // Synchronously seed from the TanStack Query cache (populated by OTP screen).
  // If cache is cold this is null and statusLoading starts true.
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(() =>
    queryClient.getQueryData<OnboardingStatus>(['onboarding-status']) ?? null,
  );
  const [statusLoading, setStatusLoading] = useState(() =>
    !queryClient.getQueryData(['onboarding-status']),
  );

  // Kick off a network fetch only when the cache is cold or stale.
  useEffect(() => {
    queryClient
      .fetchQuery({
        queryKey: ['onboarding-status'],
        queryFn: fetchOnboardingStatus,
        staleTime: 5 * 60 * 1000,
      })
      .then((data) => {
        setOnboarding(data);
        setStatusLoading(false);
      })
      .catch(() => {
        setStatusLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kind = onboarding?.profileKind ?? onboarding?.primaryRole ?? null;

  const steps = useMemo(
    () => buildSteps(onboarding?.profileKind ?? null, onboarding?.primaryRole ?? null),
    [onboarding?.profileKind, onboarding?.primaryRole],
  );
  const currentStep = steps[stepIdx] as WizardStepId | undefined;
  const isLastStep = stepIdx === steps.length - 1;

  // Pre-populate from DB and jump to the first incomplete step (runs once after data loads)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!onboarding || initializedRef.current) return;
    initializedRef.current = true;

    const p = onboarding.prefill;
    if (p.firstName)                        setFirstName(p.firstName);
    if (p.lastName)                         setLastName(p.lastName);
    if (p.phone)                            setPhone(p.phone);
    if (p.timezone && p.timezone !== 'UTC') setTimezone(p.timezone);
    if (p.city)                             setCity(p.city);
    if (p.region)                           setRegion(p.region);
    if (p.postalCode)                       setPostalCode(p.postalCode);
    if (p.countryCode)                      setCountryCode(p.countryCode);

    // Jump directly to the first incomplete step
    const f = onboarding.flags;
    const onboardingKind = onboarding.profileKind ?? onboarding.primaryRole ?? null;
    let targetIdx = 0;

    if (!f.hasName) {
      targetIdx = steps.indexOf('name');
    } else if (f.requiresPhone && !f.hasPhone) {
      targetIdx = steps.indexOf('phone');
    } else if (!f.hasTimezone) {
      targetIdx = steps.indexOf('timezone');
    } else if (!f.hasLocation) {
      targetIdx = steps.indexOf('location');
    } else if (!f.hasRoleData) {
      const roleStep = steps.find((step) => step === 'student-profile' || step === 'educator-profile');
      if (roleStep) targetIdx = steps.indexOf(roleStep);
    } else if (onboardingKind === 'educator' && !f.hasAvailability) {
      const availIdx = steps.indexOf('educator-availability');
      if (availIdx !== -1) targetIdx = availIdx;
    }

    if (targetIdx > 0) setStepIdx(targetIdx);
  }, [onboarding, steps]);

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
        } else if (currentStep === 'location') {
          await saveLocationStep(onboarding.profileId, city, region, postalCode, countryCode);
        } else if (currentStep === 'student-profile') {
          await saveStudentStep(
            onboarding.profileId, onboarding.orgId ?? '',
            birthYear ? parseInt(birthYear, 10) : null, grade,
          );
        } else if (currentStep === 'educator-profile') {
          await saveEducatorProfileStep(
            onboarding.profileId, onboarding.orgId ?? '', subjects, gradeLevels,
          );
        } else if (currentStep === 'educator-availability') {
          const availability: Record<string, Array<{ start: string; end: string }>> = {};
          Object.entries(daySlots).forEach(([day, slot]) => {
            availability[day] = [slot];
          });
          await saveEducatorAvailabilityStep(
            onboarding.profileId, onboarding.orgId ?? '',
            classTypes,
            weeklyHours ? parseInt(weeklyHours, 10) : null,
            availability,
          );
        }
      }
      if (isLast) await completeOnboarding(onboarding.accountId);
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

  // Phone is skippable only for children
  const canSkip = currentStep === 'phone' && kind === 'child';

  const canNext = useMemo(() => {
    if (saving) return false;
    switch (currentStep) {
      case 'name':                  return !!firstName.trim() && !!lastName.trim();
      case 'phone':                 return kind === 'child' || !!phone.trim();
      case 'timezone':              return !!timezone && timezone !== 'UTC';
      case 'location':              return !!city.trim() && !!region.trim() && !!countryCode;
      case 'student-profile':       return !!grade;
      case 'educator-profile':      return subjects.length > 0 && gradeLevels.length > 0;
      case 'educator-availability': return classTypes.length > 0 && Object.keys(daySlots).length > 0;
      default:                      return true;
    }
  }, [saving, currentStep, firstName, lastName, phone, timezone, city, region, countryCode, grade, subjects, gradeLevels, classTypes, daySlots, kind]);

  const handleNext = useCallback(() => {
    setError(null);
    switch (currentStep) {
      case 'name':
        if (!firstName.trim()) { setError('Please enter your first name.'); return; }
        if (!lastName.trim())  { setError('Please enter your last name.'); return; }
        break;
      case 'phone':
        if (kind !== 'child' && !phone.trim()) { setError('Please enter your phone number.'); return; }
        break;
      case 'timezone':
        if (!timezone || timezone === 'UTC') { setError('Please select your time zone.'); return; }
        break;
      case 'location':
        if (!countryCode)     { setError('Please select your country.'); return; }
        if (!city.trim())     { setError('Please enter your city.'); return; }
        if (!region.trim())   { setError('Please enter your state or region.'); return; }
        break;
      case 'student-profile':
        if (!grade) { setError('Please select your grade level to continue.'); return; }
        break;
      case 'educator-profile':
        if (subjects.length === 0)   { setError('Please select at least one subject.'); return; }
        if (gradeLevels.length === 0) { setError('Please select at least one grade level.'); return; }
        break;
      case 'educator-availability':
        if (classTypes.length === 0)         { setError('Please select at least one teaching format.'); return; }
        if (Object.keys(daySlots).length === 0) { setError('Please select at least one available day.'); return; }
        break;
    }
    advance({ isSkip: false, isLast: isLastStep });
  }, [
    currentStep, firstName, lastName, phone, timezone, city, region, countryCode,
    grade, subjects, gradeLevels, classTypes, daySlots, kind, advance, isLastStep,
  ]);

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
          <TouchableOpacity style={s.backBtn} onPress={handleBack} hitSlop={8}>
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
          {meta && (
            <>
              <View style={s.badge}><Text style={s.badgeEmoji}>{meta.emoji}</Text></View>
              <Text style={s.heading}>{meta.title}</Text>
              <Text style={s.sub}>{meta.subtitle}</Text>
            </>
          )}

          {currentStep === 'name' && (
            <NameStep firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} s={s} colors={colors} />
          )}
          {currentStep === 'phone' && (
            <PhoneStep phone={phone} setPhone={setPhone} s={s} colors={colors} isChild={kind === 'child'} />
          )}
          {currentStep === 'timezone' && (
            <TimezoneStep timezone={timezone} setTimezone={setTimezone} s={s} colors={colors} />
          )}
          {currentStep === 'location' && (
            <LocationStep
              city={city} setCity={setCity}
              region={region} setRegion={setRegion}
              postalCode={postalCode} setPostalCode={setPostalCode}
              countryCode={countryCode} setCountryCode={setCountryCode}
              s={s} colors={colors}
            />
          )}
          {currentStep === 'student-profile' && (
            <StudentProfileStep
              birthYear={birthYear} setBirthYear={setBirthYear}
              grade={grade} setGrade={setGrade}
              s={s} colors={colors}
            />
          )}
          {currentStep === 'educator-profile' && (
            <EducatorProfileStep
              subjects={subjects} setSubjects={setSubjects}
              gradeLevels={gradeLevels} setGradeLevels={setGradeLevels}
              s={s} colors={colors}
            />
          )}
          {currentStep === 'educator-availability' && (
            <EducatorAvailabilityStep
              classTypes={classTypes} setClassTypes={setClassTypes}
              weeklyHours={weeklyHours} setWeeklyHours={setWeeklyHours}
              daySlots={daySlots} setDaySlots={setDaySlots}
              s={s} colors={colors}
            />
          )}

          {!!error && <Text style={s.errorTxt}>{error}</Text>}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btn, !canNext && s.btnDim]}
            onPress={handleNext}
            disabled={!canNext || saving}
          >
            {saving
              ? <ActivityIndicator color={colors.tealFg} />
              : <Text style={s.btnTxt}>{isLastStep ? 'Finish →' : 'Continue →'}</Text>
            }
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
