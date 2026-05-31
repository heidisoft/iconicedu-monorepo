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
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { useAnalytics } from '@/providers/analytics-provider';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import { AnalyticsEvent } from '@iconicedu/utils';
import {
  normalizeCountryCode,
  optionsForCountry,
  type GradeLevel,
} from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import {
  fetchOnboardingStatus,
  completeParentRole,
  createChildProfile,
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

const COUNTRIES: Array<{ code: string; label: string; flag: string }> = [
  { code: 'LK', label: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'IN', label: 'India', flag: '🇮🇳' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'CA', label: 'Canada', flag: '🇨🇦' },
  { code: 'NZ', label: 'New Zealand', flag: '🇳🇿' },
  { code: 'SG', label: 'Singapore', flag: '🇸🇬' },
  { code: 'AE', label: 'UAE', flag: '🇦🇪' },
  { code: 'SA', label: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'PK', label: 'Pakistan', flag: '🇵🇰' },
  { code: 'BD', label: 'Bangladesh', flag: '🇧🇩' },
  { code: 'MY', label: 'Malaysia', flag: '🇲🇾' },
  { code: 'KE', label: 'Kenya', flag: '🇰🇪' },
  { code: 'NG', label: 'Nigeria', flag: '🇳🇬' },
  { code: 'ZA', label: 'South Africa', flag: '🇿🇦' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'DE', label: 'Germany', flag: '🇩🇪' },
  { code: 'TR', label: 'Turkey', flag: '🇹🇷' },
  { code: 'BR', label: 'Brazil', flag: '🇧🇷' },
  { code: 'JP', label: 'Japan', flag: '🇯🇵' },
  { code: 'CN', label: 'China', flag: '🇨🇳' },
  { code: 'PH', label: 'Philippines', flag: '🇵🇭' },
  { code: 'OM', label: 'Oman', flag: '🇴🇲' },
  { code: 'QA', label: 'Qatar', flag: '🇶🇦' },
];

type AddressConfig = {
  cityLabel: string;
  cityPlaceholder: string;
  regionLabel: string;
  regionPlaceholder: string;
  postalLabel: string;
  postalPlaceholder: string;
};

const ADDRESS_CONFIG: Record<string, AddressConfig> = {
  US: {
    cityLabel: 'City',
    cityPlaceholder: 'e.g. New York',
    regionLabel: 'State',
    regionPlaceholder: 'e.g. New York',
    postalLabel: 'ZIP Code',
    postalPlaceholder: 'e.g. 10001',
  },
  CA: {
    cityLabel: 'City',
    cityPlaceholder: 'e.g. Toronto',
    regionLabel: 'Province',
    regionPlaceholder: 'e.g. Ontario',
    postalLabel: 'Postal Code',
    postalPlaceholder: 'e.g. M5H 2N2',
  },
  GB: {
    cityLabel: 'City or Town',
    cityPlaceholder: 'e.g. London',
    regionLabel: 'County or Region',
    regionPlaceholder: 'e.g. Greater London',
    postalLabel: 'Postcode',
    postalPlaceholder: 'e.g. SW1A 1AA',
  },
  AU: {
    cityLabel: 'City or Suburb',
    cityPlaceholder: 'e.g. Sydney',
    regionLabel: 'State or Territory',
    regionPlaceholder: 'e.g. New South Wales',
    postalLabel: 'Postcode',
    postalPlaceholder: 'e.g. 2000',
  },
  NZ: {
    cityLabel: 'City or Town',
    cityPlaceholder: 'e.g. Auckland',
    regionLabel: 'Region',
    regionPlaceholder: 'e.g. Auckland Region',
    postalLabel: 'Postcode',
    postalPlaceholder: 'e.g. 1010',
  },
  IN: {
    cityLabel: 'City',
    cityPlaceholder: 'e.g. Mumbai',
    regionLabel: 'State',
    regionPlaceholder: 'e.g. Maharashtra',
    postalLabel: 'PIN Code',
    postalPlaceholder: 'e.g. 400001',
  },
  LK: {
    cityLabel: 'City',
    cityPlaceholder: 'e.g. Colombo',
    regionLabel: 'Province',
    regionPlaceholder: 'e.g. Western Province',
    postalLabel: 'Postal Code',
    postalPlaceholder: 'e.g. 00100',
  },
  SG: {
    cityLabel: 'District',
    cityPlaceholder: 'e.g. Orchard',
    regionLabel: 'Region',
    regionPlaceholder: 'e.g. Central Region',
    postalLabel: 'Postal Code',
    postalPlaceholder: 'e.g. 238823',
  },
  AE: {
    cityLabel: 'City',
    cityPlaceholder: 'e.g. Dubai',
    regionLabel: 'Emirate',
    regionPlaceholder: 'e.g. Dubai',
    postalLabel: 'Postal Code',
    postalPlaceholder: '',
  },
  DE: {
    cityLabel: 'City',
    cityPlaceholder: 'e.g. Berlin',
    regionLabel: 'State (Bundesland)',
    regionPlaceholder: 'e.g. Berlin',
    postalLabel: 'Postleitzahl',
    postalPlaceholder: 'e.g. 10115',
  },
  FR: {
    cityLabel: 'City',
    cityPlaceholder: 'e.g. Paris',
    regionLabel: 'Region',
    regionPlaceholder: 'e.g. Île-de-France',
    postalLabel: 'Code Postal',
    postalPlaceholder: 'e.g. 75001',
  },
};

const DEFAULT_ADDRESS_CONFIG: AddressConfig = {
  cityLabel: 'City',
  cityPlaceholder: 'e.g. City name',
  regionLabel: 'State / Region / Province',
  regionPlaceholder: 'e.g. Region name',
  postalLabel: 'Postal Code',
  postalPlaceholder: 'e.g. Postal code',
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    county?: string;
    region?: string;
    postcode?: string;
    country_code?: string;
  };
};

type GradeOption = { value: GradeLevel; label: string };

const EDUCATOR_SUBJECTS = [
  'Mathematics',
  'Science',
  'English Language Arts',
  'Social Studies',
  'STEM & Coding',
  'Creative Arts',
  'Music & Performance',
  'Mindfulness & SEL',
  'Language Studies',
  'Career Readiness',
];

const CLASS_TYPES = [
  { id: 'online', label: 'Online' },
  { id: 'in_person', label: 'In-Person' },
  { id: 'hybrid', label: 'Hybrid' },
];

const DAYS_OF_WEEK = [
  { id: 'monday', short: 'Mon' },
  { id: 'tuesday', short: 'Tue' },
  { id: 'wednesday', short: 'Wed' },
  { id: 'thursday', short: 'Thu' },
  { id: 'friday', short: 'Fri' },
  { id: 'saturday', short: 'Sat' },
  { id: 'sunday', short: 'Sun' },
];

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - 4 - i);
const DEFAULT_GRADE_OPTIONS = optionsForCountry(normalizeCountryCode());

// ─── Step types ────────────────────────────────────────────────────────────────

type WizardStepId =
  | 'name'
  | 'phone'
  | 'timezone'
  | 'location'
  | 'student-profile'
  | 'educator-profile'
  | 'educator-availability'
  | 'first-child';

function buildSteps(
  profileKind: string | null,
  primaryRole: string | null,
): WizardStepId[] {
  const steps: WizardStepId[] = ['name', 'phone', 'timezone', 'location'];
  const kind = profileKind ?? primaryRole;
  if (kind === 'child') steps.push('student-profile');
  else if (kind === 'educator') {
    steps.push('educator-profile');
    steps.push('educator-availability');
  } else if (kind === 'guardian') {
    steps.push('first-child');
  }
  return steps;
}

const STEP_META: Record<
  WizardStepId,
  { title: string; subtitle: string; emoji: string }
> = {
  name: {
    emoji: '👤',
    title: 'Your name',
    subtitle: 'Let your teachers and classmates know who you are.',
  },
  phone: {
    emoji: '📱',
    title: 'Your phone number',
    subtitle:
      'For important updates and reminders. Include your country code (e.g. +1, +44, +94).',
  },
  timezone: {
    emoji: '🌍',
    title: 'Your time zone',
    subtitle: 'We use this to show the right times for your sessions and schedules.',
  },
  location: {
    emoji: '📍',
    title: 'Your location',
    subtitle:
      'Used to personalise your experience and show relevant grade and curriculum options.',
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
    subtitle: "Let students know when you're available and how you like to teach.",
  },
  'first-child': {
    emoji: '🎓',
    title: 'Add your first child',
    subtitle: 'Create your child profile so we can personalise their learning space.',
  },
};

// ─── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return {
    placeholderColor: C.textFaint,
    ...StyleSheet.create({
      safe: { flex: 1, backgroundColor: C.pageBg },
      center: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },

      header: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 4,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 10,
      },
      backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderRadius: 20,
        backgroundColor: C.inputBg,
      },
      backArrow: { fontSize: 20, color: C.teal },
      stepLabel: { fontSize: 14, color: C.textFaint, fontWeight: '500' as const },

      progressTrack: {
        height: 4,
        borderRadius: 2,
        backgroundColor: C.border,
        marginHorizontal: 20,
        marginBottom: 8,
        overflow: 'hidden' as const,
      },
      progressFill: { height: 4, borderRadius: 2, backgroundColor: C.teal },

      scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },

      badge: {
        alignSelf: 'center' as const,
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: C.teal + '18',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginBottom: 20,
      },
      badgeEmoji: { fontSize: 30 },
      heading: {
        fontSize: 26,
        fontWeight: '700' as const,
        color: C.text,
        textAlign: 'center' as const,
        marginBottom: 6,
      },
      sub: {
        fontSize: 15,
        color: C.textMuted,
        textAlign: 'center' as const,
        marginBottom: 28,
        lineHeight: 20,
      },

      label: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: C.textMuted,
        marginBottom: 6,
      },
      labelOptional: {
        fontWeight: '400' as const,
        fontSize: 13,
      },

      inputWrap: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: C.inputBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 16,
        marginBottom: 16,
        minHeight: 52,
      },
      input: { flex: 1, fontSize: 17, color: C.text, paddingVertical: 14 },
      inputHint: {
        fontSize: 13,
        color: C.textFaint,
        marginTop: -10,
        marginBottom: 16,
        marginLeft: 4,
      },

      searchBox: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: C.inputBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        marginBottom: 12,
      },
      searchInput: { flex: 1, fontSize: 15, color: C.text },
      addressSearchBox: {
        minHeight: 52,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 0,
      },
      addressSearchInput: { fontSize: 17, paddingVertical: 14 },

      listItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 6,
        backgroundColor: C.inputBg,
        borderWidth: 1,
        borderColor: C.border,
      },
      listItemSelected: { backgroundColor: C.tealBg, borderColor: C.teal },
      listItemTxt: { flex: 1, fontSize: 16, color: C.text },
      listItemSelectedTxt: { color: C.teal, fontWeight: '600' as const },
      listCheck: { fontSize: 16, color: C.teal },
      listFlag: { fontSize: 20, marginRight: 10 },
      listChevron: { fontSize: 18, color: C.textFaint },

      tabRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 16 },
      tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center' as const,
        borderRadius: 12,
        backgroundColor: C.inputBg,
        borderWidth: 1,
        borderColor: C.border,
      },
      tabBtnActive: { backgroundColor: C.tealBg, borderColor: C.teal },
      tabTxt: { fontSize: 15, fontWeight: '600' as const, color: C.textMuted },
      tabTxtActive: { color: C.teal },

      chipsRow: {
        flexDirection: 'row' as const,
        flexWrap: 'wrap' as const,
        gap: 8,
        marginBottom: 16,
      },
      chip: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        borderWidth: 1,
      },
      chipTxt: { fontSize: 15, fontWeight: '500' as const },

      sectionLabel: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: C.text,
        marginBottom: 10,
        marginTop: 4,
      },
      sectionHint: { fontSize: 13, color: C.textFaint, marginBottom: 12 },

      dayRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: C.inputBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 8,
        gap: 10,
      },
      dayRowActive: { backgroundColor: C.tealBg, borderColor: C.teal },
      dayToggle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: C.border,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
      dayToggleActive: { backgroundColor: C.teal, borderColor: C.teal },
      dayToggleTxt: { fontSize: 14, color: '#ffffff', fontWeight: '700' as const },
      dayLabel: { flex: 1, fontSize: 16, color: C.text, fontWeight: '500' as const },
      dayLabelActive: { color: C.teal },
      timeRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
      timeInput: {
        backgroundColor: C.pageBg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.teal,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 14,
        color: C.text,
        width: 60,
        textAlign: 'center' as const,
      },
      timeSep: { fontSize: 14, color: C.textMuted },

      numberInputRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: C.inputBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 16,
        marginBottom: 8,
        minHeight: 52,
        gap: 10,
      },
      numberInput: { flex: 1, fontSize: 17, color: C.text, paddingVertical: 14 },
      numberUnit: { fontSize: 15, color: C.textMuted },

      errorTxt: {
        fontSize: 14,
        color: '#ef4444',
        textAlign: 'center' as const,
        marginBottom: 12,
      },

      footer: {
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 32 : 20,
        paddingTop: 12,
        gap: 8,
      },
      btn: {
        backgroundColor: C.teal,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center' as const,
      },
      btnDim: { opacity: 0.4 },
      btnTxt: { color: C.tealFg, fontSize: 17, fontWeight: '700' as const },
      skipBtn: { alignItems: 'center' as const, paddingVertical: 6 },
      skipTxt: { fontSize: 15, color: C.textFaint },
    }),
  };
}

type S = ReturnType<typeof makeStyles>;

// ─── Step sub-components ───────────────────────────────────────────────────────

function NameStep({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  s,
}: {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  s: S;
  colors: AppColors;
}) {
  return (
    <>
      <Text style={s.label}>First Name</Text>
      <View style={[s.inputWrap, { marginBottom: 12 }]}>
        <TextInput
          style={s.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
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
        />
      </View>
    </>
  );
}

function formatPhone(input: string): string {
  // Strip everything except digits and a leading +
  const stripped = input.replace(/[^\d+]/g, '');
  const normalized = stripped.startsWith('+')
    ? '+' + stripped.slice(1).replace(/\+/g, '')
    : stripped.replace(/\+/g, '');

  if (!normalized.startsWith('+')) return normalized;
  const digits = normalized.slice(1); // digits after +

  // +1 — US / Canada: +1 (XXX) XXX-XXXX
  if (digits.startsWith('1')) {
    const nat = digits.slice(1);
    if (nat.length === 0) return '+1';
    if (nat.length <= 3) return `+1 (${nat}`;
    if (nat.length <= 6) return `+1 (${nat.slice(0, 3)}) ${nat.slice(3)}`;
    return `+1 (${nat.slice(0, 3)}) ${nat.slice(3, 6)}-${nat.slice(6, 10)}`;
  }

  // +44 — UK: +44 XXXX XXXXXX
  if (digits.startsWith('44')) {
    const nat = digits.slice(2);
    if (nat.length === 0) return '+44';
    if (nat.length <= 4) return `+44 ${nat}`;
    return `+44 ${nat.slice(0, 4)} ${nat.slice(4, 10)}`;
  }

  // +61 — Australia: +61 X XXXX XXXX
  if (digits.startsWith('61')) {
    const nat = digits.slice(2);
    if (nat.length === 0) return '+61';
    if (nat.length <= 1) return `+61 ${nat}`;
    if (nat.length <= 5) return `+61 ${nat[0]} ${nat.slice(1)}`;
    return `+61 ${nat[0]} ${nat.slice(1, 5)} ${nat.slice(5, 9)}`;
  }

  // +94 — Sri Lanka: +94 XX XXX XXXX
  if (digits.startsWith('94')) {
    const nat = digits.slice(2);
    if (nat.length === 0) return '+94';
    if (nat.length <= 2) return `+94 ${nat}`;
    if (nat.length <= 5) return `+94 ${nat.slice(0, 2)} ${nat.slice(2)}`;
    return `+94 ${nat.slice(0, 2)} ${nat.slice(2, 5)} ${nat.slice(5, 9)}`;
  }

  // Generic — keep raw with + prefix, no extra formatting
  return normalized;
}

function PhoneStep({
  phone,
  setPhone,
  s,
  isChild,
}: {
  phone: string;
  setPhone: (v: string) => void;
  s: S;
  colors: AppColors;
  isChild: boolean;
}) {
  const handleChange = useCallback(
    (text: string) => setPhone(formatPhone(text)),
    [setPhone],
  );

  return (
    <>
      <Text style={s.label}>
        Phone Number{isChild ? <Text style={s.labelOptional}> (optional)</Text> : null}
      </Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={phone}
          onChangeText={handleChange}
          placeholder="+1 (555) 867-5309"
          placeholderTextColor={s.placeholderColor}
          keyboardType="phone-pad"
          autoFocus
        />
      </View>
      <Text style={s.inputHint}>Include your country code, e.g. +1, +44, +94</Text>
    </>
  );
}

type DetectedLocation = {
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
};

function TimezoneStep({
  timezone,
  setTimezone,
  onLocationDetected,
  s,
  colors,
}: {
  timezone: string;
  setTimezone: (v: string) => void;
  onLocationDetected?: (loc: DetectedLocation) => void;
  s: S;
  colors: AppColors;
}) {
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  // Initialize label only when timezone was explicitly prefilled from DB
  // (i.e. it differs from the device's current Intl timezone, meaning it was stored before)
  const [detectedLabel, setDetectedLabel] = useState<string | null>(() => {
    try {
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone && timezone !== 'UTC' && timezone !== deviceTz) {
        return TIMEZONES.find((t) => t.id === timezone)?.label ?? timezone;
      }
    } catch {
      /* ignore */
    }
    return null;
  });
  const [showManual, setShowManual] = useState(false);
  const [search, setSearch] = useState('');

  const allTimezones = useMemo(() => {
    // Include detected device timezone if it's not already in the list
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && !TIMEZONES.some((t) => t.id === detected)) {
        return [{ id: detected, label: detected }, ...TIMEZONES];
      }
    } catch {
      /* ignore */
    }
    return TIMEZONES;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTimezones;
    const q = search.toLowerCase();
    return allTimezones.filter(
      (t) => t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
    );
  }, [search, allTimezones]);

  const handleDetect = useCallback(async () => {
    setDetecting(true);
    setDetectError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDetectError(
          'Location permission denied. Please select your time zone manually.',
        );
        setShowManual(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const tz = geo?.timezone;
      if (tz) {
        setTimezone(tz);
        const match = TIMEZONES.find((t) => t.id === tz);
        setDetectedLabel(match?.label ?? tz);
        onLocationDetected?.({
          city: geo.city ?? '',
          region: geo.region ?? '',
          postalCode: geo.postalCode ?? '',
          countryCode: geo.isoCountryCode ?? '',
        });
      } else {
        setDetectError('Could not determine your time zone. Please select it manually.');
        setShowManual(true);
      }
    } catch {
      setDetectError('Location unavailable. Please select your time zone manually.');
      setShowManual(true);
    } finally {
      setDetecting(false);
    }
  }, [setTimezone]);

  // Confirmed state — show after GPS detection, manual selection, or DB prefill
  if (!showManual && !!detectedLabel) {
    const label = detectedLabel;

    return (
      <>
        {/* Detected timezone card */}
        <View
          style={[
            s.listItem,
            s.listItemSelected,
            { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
          ]}
        >
          <Text style={[s.listItemSelectedTxt, { fontWeight: '700', fontSize: 13 }]}>
            ✓ Time zone selected
          </Text>
          <Text style={[s.listItemSelectedTxt, { fontSize: 17 }]}>{label}</Text>
        </View>

        {detectError ? (
          <Text style={[s.inputHint, { color: colors.textMuted, marginTop: 4 }]}>
            {detectError}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[s.listItem, { marginTop: 4 }]}
          onPress={() => {
            setShowManual(true);
            setDetectedLabel(null);
          }}
        >
          <Text style={s.listItemTxt}>Choose a different time zone</Text>
          <Text style={s.listChevron}>›</Text>
        </TouchableOpacity>
      </>
    );
  }

  // Initial state — not yet detected, not manual
  if (!showManual && !detectedLabel) {
    return (
      <>
        <TouchableOpacity
          style={[
            s.listItem,
            {
              backgroundColor: colors.tealBg,
              borderColor: colors.teal,
              justifyContent: 'center',
              minHeight: 56,
            },
          ]}
          onPress={handleDetect}
          disabled={detecting}
          activeOpacity={0.8}
        >
          {detecting ? (
            <ActivityIndicator color={colors.teal} size="small" />
          ) : (
            <Text style={[s.listItemSelectedTxt, { textAlign: 'center', fontSize: 16 }]}>
              📍 Detect from my location
            </Text>
          )}
        </TouchableOpacity>

        {detectError ? (
          <Text style={[s.inputHint, { marginTop: 8 }]}>{detectError}</Text>
        ) : null}

        <TouchableOpacity
          style={[s.listItem, { marginTop: 4 }]}
          onPress={() => setShowManual(true)}
        >
          <Text style={s.listItemTxt}>Choose manually</Text>
          <Text style={s.listChevron}>›</Text>
        </TouchableOpacity>
      </>
    );
  }

  // Manual selection
  return (
    <>
      <TouchableOpacity
        style={[s.listItem, { marginBottom: 12 }]}
        onPress={() => {
          setShowManual(false);
          setSearch('');
        }}
      >
        <Text style={s.listCheck}>‹</Text>
        <Text style={[s.listItemTxt, { marginLeft: 8 }]}>Back</Text>
      </TouchableOpacity>
      <View style={s.searchBox}>
        <Text>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search time zones…"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="none"
          autoFocus
        />
      </View>
      {filtered.map((item) => {
        const sel = timezone === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={[s.listItem, sel && s.listItemSelected]}
            onPress={() => {
              setTimezone(item.id);
              const match = TIMEZONES.find((t) => t.id === item.id);
              setDetectedLabel(match?.label ?? item.id);
              setShowManual(false);
              setSearch('');
            }}
          >
            <Text style={[s.listItemTxt, sel && s.listItemSelectedTxt]}>
              {item.label}
            </Text>
            {sel && <Text style={s.listCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

function LocationStep({
  city,
  setCity,
  region,
  setRegion,
  postalCode,
  setPostalCode,
  countryCode,
  setCountryCode,
  s,
  colors,
  enableAddressSearch,
}: {
  city: string;
  setCity: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  postalCode: string;
  setPostalCode: (v: string) => void;
  countryCode: string;
  setCountryCode: (v: string) => void;
  s: S;
  colors: AppColors;
  enableAddressSearch: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const addrConfig = ADDRESS_CONFIG[countryCode] ?? DEFAULT_ADDRESS_CONFIG;
  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [countrySearch]);

  useEffect(() => {
    if (!enableAddressSearch) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (!addressQuery.trim() || addressQuery.length < 3) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const countryFilter = countryCode
          ? `&countrycodes=${countryCode.toLowerCase()}`
          : '';
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressQuery)}&format=json&addressdetails=1&limit=5${countryFilter}`,
          { headers: { 'User-Agent': 'IconicEdu/1.0' } },
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [addressQuery, countryCode, enableAddressSearch]);

  const handleSelectSuggestion = useCallback(
    (result: NominatimResult) => {
      const addr = result.address;
      const resolvedCity =
        addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '';
      const resolvedRegion = addr.state ?? addr.county ?? addr.region ?? '';
      const resolvedPostal = addr.postcode ?? '';
      const resolvedCountry = addr.country_code?.toUpperCase() ?? '';

      if (resolvedCity) setCity(resolvedCity);
      if (resolvedRegion) setRegion(resolvedRegion);
      if (resolvedPostal) setPostalCode(resolvedPostal);
      if (resolvedCountry && COUNTRIES.some((c) => c.code === resolvedCountry)) {
        setCountryCode(resolvedCountry);
      }
      setAddressQuery('');
      setSuggestions([]);
    },
    [setCity, setCountryCode, setPostalCode, setRegion],
  );

  if (showPicker) {
    return (
      <>
        <TouchableOpacity
          style={[s.listItem, { marginBottom: 12 }]}
          onPress={() => {
            setShowPicker(false);
            setCountrySearch('');
          }}
        >
          <Text style={s.listCheck}>‹</Text>
          <Text style={[s.listItemTxt, { marginLeft: 8 }]}>Back to location</Text>
        </TouchableOpacity>
        <View style={s.searchBox}>
          <Text>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={countrySearch}
            onChangeText={setCountrySearch}
            placeholder="Search countries…"
            placeholderTextColor={s.placeholderColor}
            autoFocus
            autoCapitalize="none"
          />
        </View>
        {filteredCountries.map((c) => {
          const sel = countryCode === c.code;
          return (
            <TouchableOpacity
              key={c.code}
              style={[s.listItem, sel && s.listItemSelected]}
              onPress={() => {
                setCountryCode(c.code);
                setShowPicker(false);
                setCountrySearch('');
              }}
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
        <Text
          style={[
            s.input,
            {
              paddingVertical: 0,
              color: selectedCountry ? undefined : s.placeholderColor,
            },
          ]}
        >
          {selectedCountry?.label ?? 'Select country…'}
        </Text>
        <Text style={s.listChevron}>›</Text>
      </TouchableOpacity>

      {enableAddressSearch && (
        <>
          <Text style={s.label}>
            Search address{'  '}
            <Text style={s.labelOptional}>(auto-fill fields below)</Text>
          </Text>
          <View
            style={[
              s.searchBox,
              s.addressSearchBox,
              { marginBottom: suggestions.length > 0 ? 4 : 16 },
            ]}
          >
            <Text>🔍</Text>
            <TextInput
              style={[s.searchInput, s.addressSearchInput]}
              value={addressQuery}
              onChangeText={setAddressQuery}
              placeholder="Type a city, suburb or address…"
              placeholderTextColor={s.placeholderColor}
              autoCapitalize="words"
              returnKeyType="search"
            />
            {isSearching && <ActivityIndicator size="small" color={colors.teal} />}
            {addressQuery.length > 0 && !isSearching && (
              <TouchableOpacity
                onPress={() => {
                  setAddressQuery('');
                  setSuggestions([]);
                }}
              >
                <Text
                  style={{
                    color: s.placeholderColor,
                    fontSize: 16,
                    paddingHorizontal: 4,
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
      {enableAddressSearch && suggestions.length > 0 && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            marginBottom: 16,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((result, i) => (
            <TouchableOpacity
              key={result.place_id}
              onPress={() => handleSelectSuggestion(result)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ fontSize: 14, color: colors.text }} numberOfLines={2}>
                {result.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={s.label}>{addrConfig.cityLabel}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={city}
          onChangeText={setCity}
          placeholder={addrConfig.cityPlaceholder}
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      <Text style={s.label}>{addrConfig.regionLabel}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={region}
          onChangeText={setRegion}
          placeholder={addrConfig.regionPlaceholder}
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      <Text style={s.label}>
        {addrConfig.postalLabel}
        {'  '}
        <Text style={s.labelOptional}>(optional)</Text>
      </Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={postalCode}
          onChangeText={setPostalCode}
          placeholder={addrConfig.postalPlaceholder}
          placeholderTextColor={s.placeholderColor}
          returnKeyType="done"
        />
      </View>
    </>
  );
}

function GradeLevelSelect({
  value,
  onChange,
  options,
  s,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: GradeOption[];
  s: S;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <TouchableOpacity
        style={[s.inputWrap, isOpen && { marginBottom: 6 }]}
        onPress={() => setIsOpen((open) => !open)}
        activeOpacity={0.85}
      >
        <Text
          style={[
            s.input,
            {
              paddingVertical: 0,
              color: selected ? undefined : s.placeholderColor,
            },
          ]}
        >
          {selected?.label ?? 'Select grade'}
        </Text>
        <Text style={s.listChevron}>{isOpen ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>
      {isOpen &&
        options.map((item) => {
          const isSelected = value === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[s.listItem, isSelected && s.listItemSelected]}
              onPress={() => {
                onChange(item.value);
                setIsOpen(false);
              }}
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
  birthYear,
  setBirthYear,
  grade,
  setGrade,
  gradeOptions,
  s,
}: {
  birthYear: string;
  setBirthYear: (v: string) => void;
  grade: string | null;
  setGrade: (v: string) => void;
  gradeOptions: GradeOption[];
  s: S;
  colors: AppColors;
}) {
  return (
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
          returnKeyType="next"
        />
      </View>

      <Text style={s.label}>Grade Level</Text>
      <GradeLevelSelect value={grade} onChange={setGrade} options={gradeOptions} s={s} />
    </>
  );
}

function EducatorProfileStep({
  subjects,
  setSubjects,
  gradeLevels,
  setGradeLevels,
  s,
  colors,
}: {
  subjects: string[];
  setSubjects: (v: string[]) => void;
  gradeLevels: string[];
  setGradeLevels: (v: string[]) => void;
  s: S;
  colors: AppColors;
}) {
  const toggleSubject = useCallback(
    (subject: string) => {
      setSubjects(
        subjects.includes(subject)
          ? subjects.filter((x) => x !== subject)
          : [...subjects, subject],
      );
    },
    [subjects, setSubjects],
  );

  const toggleGrade = useCallback(
    (grade: string) => {
      setGradeLevels(
        gradeLevels.includes(grade)
          ? gradeLevels.filter((x) => x !== grade)
          : [...gradeLevels, grade],
      );
    },
    [gradeLevels, setGradeLevels],
  );

  return (
    <>
      <Text style={s.sectionLabel}>Subjects you teach</Text>
      <Text style={s.sectionHint}>
        Select all that apply. You can update these later.
      </Text>
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
              {sel && <Text style={{ color: colors.teal, fontSize: 14 }}>✓ </Text>}
              <Text style={[s.chipTxt, { color: sel ? colors.teal : colors.textMuted }]}>
                {subject}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.sectionLabel, { marginTop: 8 }]}>Grade levels you teach</Text>
      <Text style={s.sectionHint}>
        {"Select all grade levels you're comfortable teaching."}
      </Text>
      {DEFAULT_GRADE_OPTIONS.map((item) => {
        const sel = gradeLevels.includes(item.value);
        return (
          <TouchableOpacity
            key={item.value}
            style={[s.listItem, sel && s.listItemSelected]}
            onPress={() => toggleGrade(item.value)}
          >
            <Text style={[s.listItemTxt, sel && s.listItemSelectedTxt]}>
              {item.label}
            </Text>
            {sel && <Text style={s.listCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
      <Text style={s.inputHint}>
        At least one subject and one grade level are required.
      </Text>
    </>
  );
}

function EducatorAvailabilityStep({
  classTypes,
  setClassTypes,
  weeklyHours,
  setWeeklyHours,
  daySlots,
  setDaySlots,
  s,
  colors,
}: {
  classTypes: string[];
  setClassTypes: (v: string[]) => void;
  weeklyHours: string;
  setWeeklyHours: (v: string) => void;
  daySlots: Record<string, { start: string; end: string }>;
  setDaySlots: (v: Record<string, { start: string; end: string }>) => void;
  s: S;
  colors: AppColors;
}) {
  const toggleClassType = useCallback(
    (id: string) => {
      setClassTypes(
        classTypes.includes(id)
          ? classTypes.filter((x) => x !== id)
          : [...classTypes, id],
      );
    },
    [classTypes, setClassTypes],
  );

  const toggleDay = useCallback(
    (dayId: string) => {
      if (daySlots[dayId]) {
        const next = { ...daySlots };
        delete next[dayId];
        setDaySlots(next);
      } else {
        setDaySlots({ ...daySlots, [dayId]: { start: '09:00', end: '17:00' } });
      }
    },
    [daySlots, setDaySlots],
  );

  const updateTime = useCallback(
    (dayId: string, field: 'start' | 'end', value: string) => {
      setDaySlots({ ...daySlots, [dayId]: { ...daySlots[dayId], [field]: value } });
    },
    [daySlots, setDaySlots],
  );

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
              {sel && <Text style={{ color: colors.teal, fontSize: 14 }}>✓ </Text>}
              <Text style={[s.chipTxt, { color: sel ? colors.teal : colors.textMuted }]}>
                {ct.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.sectionLabel}>
        Weekly commitment <Text style={s.sectionHint}>(optional)</Text>
      </Text>
      <View style={s.numberInputRow}>
        <TextInput
          style={s.numberInput}
          value={weeklyHours}
          onChangeText={(v) => setWeeklyHours(v.replace(/\D/g, ''))}
          placeholder="e.g. 10"
          placeholderTextColor={s.placeholderColor}
          keyboardType="number-pad"
          maxLength={3}
        />
        <Text style={s.numberUnit}>hours / week</Text>
      </View>

      <Text style={[s.sectionLabel, { marginTop: 4 }]}>Available days & times</Text>
      <Text style={s.sectionHint}>
        Toggle a day to set your available hours for that day.
      </Text>
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
      <Text style={[s.inputHint, { marginTop: 4 }]}>
        Select at least one teaching format and one available day.
      </Text>
    </>
  );
}

function FirstChildStep({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  birthYear,
  setBirthYear,
  grade,
  setGrade,
  gradeOptions,
  s,
}: {
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  birthYear: string;
  setBirthYear: (value: string) => void;
  grade: string | null;
  setGrade: (value: string) => void;
  gradeOptions: GradeOption[];
  s: S;
}) {
  return (
    <>
      <Text style={s.label}>Child First Name</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      <Text style={s.label}>Child Last Name</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

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
          returnKeyType="next"
        />
      </View>

      <Text style={s.label}>Grade Level</Text>
      <GradeLevelSelect value={grade} onChange={setGrade} options={gradeOptions} s={s} />
    </>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { session, setOnboardingCompletionStatus } = useAuth();
  const analytics = useAnalytics();
  const enableAddressSearch = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMobileOnboardingAddressSearch,
  );

  useEffect(() => {
    analytics.screen('Profile Setup', { screen_name: 'profile_setup' });
  }, [analytics]);

  // Redirect to login if somehow reached without a session
  useEffect(() => {
    if (!session) router.replace('/(auth)/login');
  }, [session, router]);

  // Form state — universal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    } catch {
      return 'UTC';
    }
  });
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const countryGradeOptions = useMemo(
    () => optionsForCountry(normalizeCountryCode(countryCode)),
    [countryCode],
  );

  // Student-specific
  const [birthYear, setBirthYear] = useState('');
  const [grade, setGrade] = useState<string | null>(null);

  // Educator-specific
  const [subjects, setSubjects] = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<string[]>([]);
  const [classTypes, setClassTypes] = useState<string[]>([]);
  const [weeklyHours, setWeeklyHours] = useState('');
  const [daySlots, setDaySlots] = useState<
    Record<string, { start: string; end: string }>
  >({});

  // Guardian onboarding
  const [childFirstName, setChildFirstName] = useState('');
  const [childLastName, setChildLastName] = useState('');
  const [childBirthYear, setChildBirthYear] = useState('');
  const [childGrade, setChildGrade] = useState<string | null>(null);

  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Synchronously seed from the TanStack Query cache (populated by OTP screen).
  // If cache is cold this is null and statusLoading starts true.
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(
    () => queryClient.getQueryData<OnboardingStatus>(['onboarding-status']) ?? null,
  );
  const [statusLoading, setStatusLoading] = useState(
    () => !queryClient.getQueryData(['onboarding-status']),
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const roleClaimedRef = useRef(false);

  // Load onboarding status. If the account doesn't exist yet (new user arriving
  // via OAuth or OTP), create a parent account first then re-fetch.
  useEffect(() => {
    async function loadOnboarding() {
      setStatusError(null);
      try {
        let data: OnboardingStatus;
        try {
          data = await queryClient.fetchQuery({
            queryKey: ['onboarding-status'],
            queryFn: fetchOnboardingStatus,
            staleTime: 5 * 60 * 1000,
          });
        } catch {
          // Account doesn't exist yet — create parent account first.
          if (!roleClaimedRef.current) {
            roleClaimedRef.current = true;
            await completeParentRole();
            queryClient.removeQueries({ queryKey: ['onboarding-status'] });
          }
          data = await queryClient.fetchQuery({
            queryKey: ['onboarding-status'],
            queryFn: fetchOnboardingStatus,
            staleTime: 0,
          });
        }
        setOnboarding(data);
        setOnboardingCompletionStatus(data.isComplete);

        if (data.isComplete) {
          router.replace('/(app)/(tabs)');
          return;
        }

        setStatusLoading(false);
      } catch (err) {
        roleClaimedRef.current = false;
        setStatusError(
          err instanceof Error && err.message
            ? err.message
            : 'Could not connect to the server. Please check your connection and try again.',
        );
        setStatusLoading(false);
      }
    }
    void loadOnboarding();
  }, [queryClient, retryCount, router, setOnboardingCompletionStatus]);

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
    if (p.firstName) setFirstName(p.firstName);
    if (p.lastName) setLastName(p.lastName);
    if (p.phone) setPhone(p.phone);
    if (p.timezone && p.timezone !== 'UTC') setTimezone(p.timezone);
    if (p.city) setCity(p.city);
    if (p.region) setRegion(p.region);
    if (p.postalCode) setPostalCode(p.postalCode);
    if (p.countryCode) setCountryCode(p.countryCode);

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
      const roleStep = steps.find(
        (step) =>
          step === 'student-profile' ||
          step === 'educator-profile' ||
          step === 'first-child',
      );
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
          const rawPhone = phone.replace(/[\s()-]/g, '');
          if (rawPhone.trim()) await savePhoneStep(onboarding.accountId, rawPhone);
        } else if (currentStep === 'timezone') {
          await saveTimezoneStep(onboarding.profileId, timezone);
        } else if (currentStep === 'location') {
          await saveLocationStep(
            onboarding.profileId,
            city,
            region,
            postalCode,
            countryCode,
          );
        } else if (currentStep === 'student-profile') {
          await saveStudentStep(
            onboarding.profileId,
            onboarding.orgId ?? '',
            birthYear ? parseInt(birthYear, 10) : null,
            grade,
          );
        } else if (currentStep === 'educator-profile') {
          await saveEducatorProfileStep(
            onboarding.profileId,
            onboarding.orgId ?? '',
            subjects,
            gradeLevels,
          );
        } else if (currentStep === 'educator-availability') {
          const availability: Record<string, Array<{ start: string; end: string }>> = {};
          Object.entries(daySlots).forEach(([day, slot]) => {
            availability[day] = [slot];
          });
          await saveEducatorAvailabilityStep(
            onboarding.profileId,
            onboarding.orgId ?? '',
            classTypes,
            weeklyHours ? parseInt(weeklyHours, 10) : null,
            availability,
          );
        } else if (currentStep === 'first-child') {
          if (!onboarding.orgId) {
            throw new Error('Organization not found. Please try logging in again.');
          }
          const trimmedFirstName = childFirstName.trim();
          const trimmedLastName = childLastName.trim();
          await createChildProfile({
            orgId: onboarding.orgId,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            displayName: `${trimmedFirstName} ${trimmedLastName}`.trim(),
            gradeLevel: childGrade ?? '',
            birthYear: parseInt(childBirthYear, 10),
            timezone,
            city,
            region,
            countryCode,
            postalCode,
          });
        }
      }
      if (isLast) {
        await completeOnboarding(onboarding.accountId);
        setOnboardingCompletionStatus(true);
        analytics.capture(AnalyticsEvent.ONBOARDING_COMPLETED, { role: kind });
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

  // Phone is skippable only for children
  const canSkip = currentStep === 'phone' && kind === 'child';

  const canNext = useMemo(() => {
    if (saving) return false;
    switch (currentStep) {
      case 'name':
        return !!firstName.trim() && !!lastName.trim();
      case 'phone':
        return kind === 'child' || !!phone.trim();
      case 'timezone':
        return !!timezone;
      case 'location':
        return !!city.trim() && !!region.trim() && !!countryCode;
      case 'student-profile':
        return !!grade;
      case 'educator-profile':
        return subjects.length > 0 && gradeLevels.length > 0;
      case 'educator-availability':
        return classTypes.length > 0 && Object.keys(daySlots).length > 0;
      case 'first-child':
        return (
          !!childFirstName.trim() &&
          !!childLastName.trim() &&
          !!childGrade &&
          childBirthYear.length === 4
        );
      default:
        return true;
    }
  }, [
    saving,
    currentStep,
    firstName,
    lastName,
    phone,
    timezone,
    city,
    region,
    countryCode,
    grade,
    subjects,
    gradeLevels,
    classTypes,
    daySlots,
    childFirstName,
    childLastName,
    childGrade,
    childBirthYear,
    kind,
  ]);

  const handleNext = useCallback(() => {
    setError(null);
    switch (currentStep) {
      case 'name':
        if (!firstName.trim()) {
          setError('Please enter your first name.');
          return;
        }
        if (!lastName.trim()) {
          setError('Please enter your last name.');
          return;
        }
        break;
      case 'phone':
        if (kind !== 'child' && !phone.trim()) {
          setError('Please enter your phone number.');
          return;
        }
        break;
      case 'timezone':
        if (!timezone) {
          setError('Please select your time zone.');
          return;
        }
        break;
      case 'location':
        if (!countryCode) {
          setError('Please select your country.');
          return;
        }
        if (!city.trim()) {
          setError('Please enter your city.');
          return;
        }
        if (!region.trim()) {
          setError('Please enter your state or region.');
          return;
        }
        break;
      case 'student-profile':
        if (!grade) {
          setError('Please select your grade level to continue.');
          return;
        }
        break;
      case 'educator-profile':
        if (subjects.length === 0) {
          setError('Please select at least one subject.');
          return;
        }
        if (gradeLevels.length === 0) {
          setError('Please select at least one grade level.');
          return;
        }
        break;
      case 'educator-availability':
        if (classTypes.length === 0) {
          setError('Please select at least one teaching format.');
          return;
        }
        if (Object.keys(daySlots).length === 0) {
          setError('Please select at least one available day.');
          return;
        }
        break;
      case 'first-child':
        if (!childFirstName.trim()) {
          setError("Please enter your child's first name.");
          return;
        }
        if (!childLastName.trim()) {
          setError("Please enter your child's last name.");
          return;
        }
        if (!childBirthYear || childBirthYear.length !== 4) {
          setError("Please enter your child's birth year.");
          return;
        }
        if (!childGrade) {
          setError("Please select your child's grade level.");
          return;
        }
        break;
    }
    advance({ isSkip: false, isLast: isLastStep });
  }, [
    currentStep,
    firstName,
    lastName,
    phone,
    timezone,
    city,
    region,
    countryCode,
    grade,
    subjects,
    gradeLevels,
    classTypes,
    daySlots,
    childFirstName,
    childLastName,
    childBirthYear,
    childGrade,
    kind,
    advance,
    isLastStep,
  ]);

  const handleSkip = useCallback(() => {
    setError(null);
    advance({ isSkip: true, isLast: isLastStep });
  }, [advance, isLastStep]);

  const handleBack = useCallback(() => {
    if (stepIdx > 0) {
      setStepIdx((i) => i - 1);
      setError(null);
    }
  }, [stepIdx]);

  if (statusLoading || statusError) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        {statusError ? (
          <View style={{ paddingHorizontal: 32, alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '600',
                color: colors.text,
                textAlign: 'center',
              }}
            >
              Unable to connect
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: colors.textMuted,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              {statusError}
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 8,
                backgroundColor: colors.teal,
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 32,
              }}
              onPress={() => {
                queryClient.removeQueries({ queryKey: ['onboarding-status'] });
                setStatusError(null);
                setStatusLoading(true);
                setRetryCount((n) => n + 1);
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: colors.tealFg, fontSize: 16, fontWeight: '700' }}>
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator color={colors.teal} size="large" />
        )}
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
        <Text style={s.stepLabel}>
          Step {stepIdx + 1} of {steps.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View
          style={[
            s.progressFill,
            { width: `${Math.round(progress * 100)}%` as `${number}%` },
          ]}
        />
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
              <View style={s.badge}>
                <Text style={s.badgeEmoji}>{meta.emoji}</Text>
              </View>
              <Text style={s.heading}>{meta.title}</Text>
              <Text style={s.sub}>{meta.subtitle}</Text>
            </>
          )}

          {currentStep === 'name' && (
            <NameStep
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              s={s}
              colors={colors}
            />
          )}
          {currentStep === 'phone' && (
            <PhoneStep
              phone={phone}
              setPhone={setPhone}
              s={s}
              colors={colors}
              isChild={kind === 'child'}
            />
          )}
          {currentStep === 'timezone' && (
            <TimezoneStep
              timezone={timezone}
              setTimezone={setTimezone}
              onLocationDetected={(loc) => {
                if (loc.city) setCity(loc.city);
                if (loc.region) setRegion(loc.region);
                if (loc.postalCode) setPostalCode(loc.postalCode);
                if (loc.countryCode) setCountryCode(loc.countryCode);
              }}
              s={s}
              colors={colors}
            />
          )}
          {currentStep === 'location' && (
            <LocationStep
              city={city}
              setCity={setCity}
              region={region}
              setRegion={setRegion}
              postalCode={postalCode}
              setPostalCode={setPostalCode}
              countryCode={countryCode}
              setCountryCode={setCountryCode}
              s={s}
              colors={colors}
              enableAddressSearch={enableAddressSearch}
            />
          )}
          {currentStep === 'student-profile' && (
            <StudentProfileStep
              birthYear={birthYear}
              setBirthYear={setBirthYear}
              grade={grade}
              setGrade={setGrade}
              gradeOptions={countryGradeOptions}
              s={s}
              colors={colors}
            />
          )}
          {currentStep === 'educator-profile' && (
            <EducatorProfileStep
              subjects={subjects}
              setSubjects={setSubjects}
              gradeLevels={gradeLevels}
              setGradeLevels={setGradeLevels}
              s={s}
              colors={colors}
            />
          )}
          {currentStep === 'educator-availability' && (
            <EducatorAvailabilityStep
              classTypes={classTypes}
              setClassTypes={setClassTypes}
              weeklyHours={weeklyHours}
              setWeeklyHours={setWeeklyHours}
              daySlots={daySlots}
              setDaySlots={setDaySlots}
              s={s}
              colors={colors}
            />
          )}
          {currentStep === 'first-child' && (
            <FirstChildStep
              firstName={childFirstName}
              setFirstName={setChildFirstName}
              lastName={childLastName}
              setLastName={setChildLastName}
              birthYear={childBirthYear}
              setBirthYear={setChildBirthYear}
              grade={childGrade}
              setGrade={setChildGrade}
              gradeOptions={countryGradeOptions}
              s={s}
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
            {saving ? (
              <ActivityIndicator color={colors.tealFg} />
            ) : (
              <Text style={s.btnTxt}>{isLastStep ? 'Finish →' : 'Continue →'}</Text>
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
