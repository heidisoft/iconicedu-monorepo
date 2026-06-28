import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js';
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
  Animated,
  Easing,
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
import { queryKeys } from '@/lib/api/query-keys';
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

// Derived from PHONE_COUNTRIES after its definition — placeholder used by LocationStep
let COUNTRIES: Array<{ code: string; label: string; flag: string }> = [];

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
    subtitle: 'This helps personalise your account and lets others know who you are.',
  },
  phone: {
    emoji: '📱',
    title: 'Your phone number',
    subtitle:
      'For important updates and reminders. Select your country, then enter your number.',
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
      },
      backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderRadius: 20,
        backgroundColor: C.inputBg,
        borderWidth: 1,
        borderColor: C.border,
      },
      backArrow: { fontSize: 22, color: C.teal, lineHeight: 26 },
      stepLabel: {
        flex: 1,
        fontSize: 14,
        color: C.textFaint,
        fontWeight: '500' as const,
        textAlign: 'center' as const,
      },

      progressTrack: {
        height: 4,
        borderRadius: 2,
        backgroundColor: C.border,
        marginHorizontal: 20,
        marginBottom: 12,
        overflow: 'hidden' as const,
      },
      progressFill: { height: 4, borderRadius: 2, backgroundColor: C.teal },

      scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },

      badge: {
        alignSelf: 'center' as const,
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: C.teal + '18',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginBottom: 18,
      },
      badgeEmoji: { fontSize: 30 },
      heading: {
        fontSize: 26,
        fontWeight: '700' as const,
        color: C.text,
        textAlign: 'center' as const,
        marginBottom: 8,
      },
      sub: {
        fontSize: 15,
        color: C.textMuted,
        textAlign: 'center' as const,
        marginBottom: 28,
        lineHeight: 22,
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
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 16,
        marginBottom: 16,
        minHeight: 52,
      },
      inputWrapFocused: {
        borderColor: C.teal,
      },
      inputWrapError: {
        borderColor: '#ef4444',
      },
      input: {
        flex: 1,
        fontSize: 16,
        color: C.text,
        paddingVertical: 14,
        letterSpacing: 0,
      },
      inputHint: {
        fontSize: 13,
        color: C.textFaint,
        marginTop: -10,
        marginBottom: 16,
        marginLeft: 2,
      },

      infoCard: {
        backgroundColor: C.teal + '12',
        borderRadius: 10,
        padding: 14,
        marginBottom: 20,
      },
      infoCardTxt: { fontSize: 14, color: C.textMuted, lineHeight: 21 },

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
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 0,
      },
      addressSearchInput: { fontSize: 16, paddingVertical: 14 },

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
        borderRadius: 10,
        backgroundColor: C.inputBg,
        borderWidth: 1,
        borderColor: C.border,
      },
      tabBtnActive: { backgroundColor: C.tealBg, borderColor: C.teal },
      tabTxt: { fontSize: 15, fontWeight: '500' as const, color: C.textMuted },
      tabTxtActive: { color: C.teal, fontWeight: '600' as const },

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
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
      },
      chipTxt: { fontSize: 14, fontWeight: '500' as const },

      sectionLabel: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: C.text,
        marginBottom: 8,
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
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 16,
        marginBottom: 8,
        minHeight: 52,
        gap: 10,
      },
      numberInput: { flex: 1, fontSize: 16, color: C.text, paddingVertical: 14 },
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
        paddingTop: 14,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: C.border,
        backgroundColor: C.pageBg,
      },
      btn: {
        backgroundColor: C.teal,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center' as const,
      },
      btnDim: { opacity: 0.4 },
      btnTxt: {
        color: C.tealFg,
        fontSize: 16,
        fontWeight: '700' as const,
      },
      skipBtn: { alignItems: 'center' as const, paddingVertical: 8 },
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
  isGuardian,
  s,
}: {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  isGuardian: boolean;
  s: S;
  colors: AppColors;
}) {
  const [focusedField, setFocusedField] = useState<'first' | 'last' | null>(null);

  return (
    <>
      <Text style={s.label}>First Name</Text>
      <View
        style={[
          s.inputWrap,
          focusedField === 'first' && s.inputWrapFocused,
          { marginBottom: 12 },
        ]}
      >
        <TextInput
          style={s.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
          onFocus={() => setFocusedField('first')}
          onBlur={() => setFocusedField(null)}
        />
      </View>
      <Text style={s.label}>Last Name</Text>
      <View style={[s.inputWrap, focusedField === 'last' && s.inputWrapFocused]}>
        <TextInput
          style={s.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="done"
          onFocus={() => setFocusedField('last')}
          onBlur={() => setFocusedField(null)}
        />
      </View>
    </>
  );
}

// ─── Phone helpers ─────────────────────────────────────────────────────────────

type PhoneCountry = { code: string; label: string; flag: string; dialCode: string };

const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'AF', label: 'Afghanistan', flag: '🇦🇫', dialCode: '93' },
  { code: 'AL', label: 'Albania', flag: '🇦🇱', dialCode: '355' },
  { code: 'DZ', label: 'Algeria', flag: '🇩🇿', dialCode: '213' },
  { code: 'AD', label: 'Andorra', flag: '🇦🇩', dialCode: '376' },
  { code: 'AO', label: 'Angola', flag: '🇦🇴', dialCode: '244' },
  { code: 'AG', label: 'Antigua and Barbuda', flag: '🇦🇬', dialCode: '1' },
  { code: 'AR', label: 'Argentina', flag: '🇦🇷', dialCode: '54' },
  { code: 'AM', label: 'Armenia', flag: '🇦🇲', dialCode: '374' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺', dialCode: '61' },
  { code: 'AT', label: 'Austria', flag: '🇦🇹', dialCode: '43' },
  { code: 'AZ', label: 'Azerbaijan', flag: '🇦🇿', dialCode: '994' },
  { code: 'BS', label: 'Bahamas', flag: '🇧🇸', dialCode: '1' },
  { code: 'BH', label: 'Bahrain', flag: '🇧🇭', dialCode: '973' },
  { code: 'BD', label: 'Bangladesh', flag: '🇧🇩', dialCode: '880' },
  { code: 'BB', label: 'Barbados', flag: '🇧🇧', dialCode: '1' },
  { code: 'BY', label: 'Belarus', flag: '🇧🇾', dialCode: '375' },
  { code: 'BE', label: 'Belgium', flag: '🇧🇪', dialCode: '32' },
  { code: 'BZ', label: 'Belize', flag: '🇧🇿', dialCode: '501' },
  { code: 'BJ', label: 'Benin', flag: '🇧🇯', dialCode: '229' },
  { code: 'BT', label: 'Bhutan', flag: '🇧🇹', dialCode: '975' },
  { code: 'BO', label: 'Bolivia', flag: '🇧🇴', dialCode: '591' },
  { code: 'BA', label: 'Bosnia and Herzegovina', flag: '🇧🇦', dialCode: '387' },
  { code: 'BW', label: 'Botswana', flag: '🇧🇼', dialCode: '267' },
  { code: 'BR', label: 'Brazil', flag: '🇧🇷', dialCode: '55' },
  { code: 'BN', label: 'Brunei', flag: '🇧🇳', dialCode: '673' },
  { code: 'BG', label: 'Bulgaria', flag: '🇧🇬', dialCode: '359' },
  { code: 'BF', label: 'Burkina Faso', flag: '🇧🇫', dialCode: '226' },
  { code: 'BI', label: 'Burundi', flag: '🇧🇮', dialCode: '257' },
  { code: 'CV', label: 'Cabo Verde', flag: '🇨🇻', dialCode: '238' },
  { code: 'KH', label: 'Cambodia', flag: '🇰🇭', dialCode: '855' },
  { code: 'CM', label: 'Cameroon', flag: '🇨🇲', dialCode: '237' },
  { code: 'CA', label: 'Canada', flag: '🇨🇦', dialCode: '1' },
  { code: 'CF', label: 'Central African Republic', flag: '🇨🇫', dialCode: '236' },
  { code: 'TD', label: 'Chad', flag: '🇹🇩', dialCode: '235' },
  { code: 'CL', label: 'Chile', flag: '🇨🇱', dialCode: '56' },
  { code: 'CN', label: 'China', flag: '🇨🇳', dialCode: '86' },
  { code: 'CO', label: 'Colombia', flag: '🇨🇴', dialCode: '57' },
  { code: 'KM', label: 'Comoros', flag: '🇰🇲', dialCode: '269' },
  { code: 'CD', label: 'Congo (DRC)', flag: '🇨🇩', dialCode: '243' },
  { code: 'CG', label: 'Congo (Republic)', flag: '🇨🇬', dialCode: '242' },
  { code: 'CR', label: 'Costa Rica', flag: '🇨🇷', dialCode: '506' },
  { code: 'HR', label: 'Croatia', flag: '🇭🇷', dialCode: '385' },
  { code: 'CU', label: 'Cuba', flag: '🇨🇺', dialCode: '53' },
  { code: 'CY', label: 'Cyprus', flag: '🇨🇾', dialCode: '357' },
  { code: 'CZ', label: 'Czech Republic', flag: '🇨🇿', dialCode: '420' },
  { code: 'DK', label: 'Denmark', flag: '🇩🇰', dialCode: '45' },
  { code: 'DJ', label: 'Djibouti', flag: '🇩🇯', dialCode: '253' },
  { code: 'DM', label: 'Dominica', flag: '🇩🇲', dialCode: '1' },
  { code: 'DO', label: 'Dominican Republic', flag: '🇩🇴', dialCode: '1' },
  { code: 'EC', label: 'Ecuador', flag: '🇪🇨', dialCode: '593' },
  { code: 'EG', label: 'Egypt', flag: '🇪🇬', dialCode: '20' },
  { code: 'SV', label: 'El Salvador', flag: '🇸🇻', dialCode: '503' },
  { code: 'GQ', label: 'Equatorial Guinea', flag: '🇬🇶', dialCode: '240' },
  { code: 'ER', label: 'Eritrea', flag: '🇪🇷', dialCode: '291' },
  { code: 'EE', label: 'Estonia', flag: '🇪🇪', dialCode: '372' },
  { code: 'SZ', label: 'Eswatini', flag: '🇸🇿', dialCode: '268' },
  { code: 'ET', label: 'Ethiopia', flag: '🇪🇹', dialCode: '251' },
  { code: 'FJ', label: 'Fiji', flag: '🇫🇯', dialCode: '679' },
  { code: 'FI', label: 'Finland', flag: '🇫🇮', dialCode: '358' },
  { code: 'FR', label: 'France', flag: '🇫🇷', dialCode: '33' },
  { code: 'GA', label: 'Gabon', flag: '🇬🇦', dialCode: '241' },
  { code: 'GM', label: 'Gambia', flag: '🇬🇲', dialCode: '220' },
  { code: 'GE', label: 'Georgia', flag: '🇬🇪', dialCode: '995' },
  { code: 'DE', label: 'Germany', flag: '🇩🇪', dialCode: '49' },
  { code: 'GH', label: 'Ghana', flag: '🇬🇭', dialCode: '233' },
  { code: 'GR', label: 'Greece', flag: '🇬🇷', dialCode: '30' },
  { code: 'GD', label: 'Grenada', flag: '🇬🇩', dialCode: '1' },
  { code: 'GT', label: 'Guatemala', flag: '🇬🇹', dialCode: '502' },
  { code: 'GN', label: 'Guinea', flag: '🇬🇳', dialCode: '224' },
  { code: 'GW', label: 'Guinea-Bissau', flag: '🇬🇼', dialCode: '245' },
  { code: 'GY', label: 'Guyana', flag: '🇬🇾', dialCode: '592' },
  { code: 'HT', label: 'Haiti', flag: '🇭🇹', dialCode: '509' },
  { code: 'HN', label: 'Honduras', flag: '🇭🇳', dialCode: '504' },
  { code: 'HU', label: 'Hungary', flag: '🇭🇺', dialCode: '36' },
  { code: 'IS', label: 'Iceland', flag: '🇮🇸', dialCode: '354' },
  { code: 'IN', label: 'India', flag: '🇮🇳', dialCode: '91' },
  { code: 'ID', label: 'Indonesia', flag: '🇮🇩', dialCode: '62' },
  { code: 'IR', label: 'Iran', flag: '🇮🇷', dialCode: '98' },
  { code: 'IQ', label: 'Iraq', flag: '🇮🇶', dialCode: '964' },
  { code: 'IE', label: 'Ireland', flag: '🇮🇪', dialCode: '353' },
  { code: 'IL', label: 'Israel', flag: '🇮🇱', dialCode: '972' },
  { code: 'IT', label: 'Italy', flag: '🇮🇹', dialCode: '39' },
  { code: 'JM', label: 'Jamaica', flag: '🇯🇲', dialCode: '1' },
  { code: 'JP', label: 'Japan', flag: '🇯🇵', dialCode: '81' },
  { code: 'JO', label: 'Jordan', flag: '🇯🇴', dialCode: '962' },
  { code: 'KZ', label: 'Kazakhstan', flag: '🇰🇿', dialCode: '7' },
  { code: 'KE', label: 'Kenya', flag: '🇰🇪', dialCode: '254' },
  { code: 'KI', label: 'Kiribati', flag: '🇰🇮', dialCode: '686' },
  { code: 'KW', label: 'Kuwait', flag: '🇰🇼', dialCode: '965' },
  { code: 'KG', label: 'Kyrgyzstan', flag: '🇰🇬', dialCode: '996' },
  { code: 'LA', label: 'Laos', flag: '🇱🇦', dialCode: '856' },
  { code: 'LV', label: 'Latvia', flag: '🇱🇻', dialCode: '371' },
  { code: 'LB', label: 'Lebanon', flag: '🇱🇧', dialCode: '961' },
  { code: 'LS', label: 'Lesotho', flag: '🇱🇸', dialCode: '266' },
  { code: 'LR', label: 'Liberia', flag: '🇱🇷', dialCode: '231' },
  { code: 'LY', label: 'Libya', flag: '🇱🇾', dialCode: '218' },
  { code: 'LI', label: 'Liechtenstein', flag: '🇱🇮', dialCode: '423' },
  { code: 'LT', label: 'Lithuania', flag: '🇱🇹', dialCode: '370' },
  { code: 'LU', label: 'Luxembourg', flag: '🇱🇺', dialCode: '352' },
  { code: 'MG', label: 'Madagascar', flag: '🇲🇬', dialCode: '261' },
  { code: 'MW', label: 'Malawi', flag: '🇲🇼', dialCode: '265' },
  { code: 'MY', label: 'Malaysia', flag: '🇲🇾', dialCode: '60' },
  { code: 'MV', label: 'Maldives', flag: '🇲🇻', dialCode: '960' },
  { code: 'ML', label: 'Mali', flag: '🇲🇱', dialCode: '223' },
  { code: 'MT', label: 'Malta', flag: '🇲🇹', dialCode: '356' },
  { code: 'MH', label: 'Marshall Islands', flag: '🇲🇭', dialCode: '692' },
  { code: 'MR', label: 'Mauritania', flag: '🇲🇷', dialCode: '222' },
  { code: 'MU', label: 'Mauritius', flag: '🇲🇺', dialCode: '230' },
  { code: 'MX', label: 'Mexico', flag: '🇲🇽', dialCode: '52' },
  { code: 'FM', label: 'Micronesia', flag: '🇫🇲', dialCode: '691' },
  { code: 'MD', label: 'Moldova', flag: '🇲🇩', dialCode: '373' },
  { code: 'MC', label: 'Monaco', flag: '🇲🇨', dialCode: '377' },
  { code: 'MN', label: 'Mongolia', flag: '🇲🇳', dialCode: '976' },
  { code: 'ME', label: 'Montenegro', flag: '🇲🇪', dialCode: '382' },
  { code: 'MA', label: 'Morocco', flag: '🇲🇦', dialCode: '212' },
  { code: 'MZ', label: 'Mozambique', flag: '🇲🇿', dialCode: '258' },
  { code: 'MM', label: 'Myanmar', flag: '🇲🇲', dialCode: '95' },
  { code: 'NA', label: 'Namibia', flag: '🇳🇦', dialCode: '264' },
  { code: 'NR', label: 'Nauru', flag: '🇳🇷', dialCode: '674' },
  { code: 'NP', label: 'Nepal', flag: '🇳🇵', dialCode: '977' },
  { code: 'NL', label: 'Netherlands', flag: '🇳🇱', dialCode: '31' },
  { code: 'NZ', label: 'New Zealand', flag: '🇳🇿', dialCode: '64' },
  { code: 'NI', label: 'Nicaragua', flag: '🇳🇮', dialCode: '505' },
  { code: 'NE', label: 'Niger', flag: '🇳🇪', dialCode: '227' },
  { code: 'NG', label: 'Nigeria', flag: '🇳🇬', dialCode: '234' },
  { code: 'KP', label: 'North Korea', flag: '🇰🇵', dialCode: '850' },
  { code: 'MK', label: 'North Macedonia', flag: '🇲🇰', dialCode: '389' },
  { code: 'NO', label: 'Norway', flag: '🇳🇴', dialCode: '47' },
  { code: 'OM', label: 'Oman', flag: '🇴🇲', dialCode: '968' },
  { code: 'PK', label: 'Pakistan', flag: '🇵🇰', dialCode: '92' },
  { code: 'PW', label: 'Palau', flag: '🇵🇼', dialCode: '680' },
  { code: 'PS', label: 'Palestine', flag: '🇵🇸', dialCode: '970' },
  { code: 'PA', label: 'Panama', flag: '🇵🇦', dialCode: '507' },
  { code: 'PG', label: 'Papua New Guinea', flag: '🇵🇬', dialCode: '675' },
  { code: 'PY', label: 'Paraguay', flag: '🇵🇾', dialCode: '595' },
  { code: 'PE', label: 'Peru', flag: '🇵🇪', dialCode: '51' },
  { code: 'PH', label: 'Philippines', flag: '🇵🇭', dialCode: '63' },
  { code: 'PL', label: 'Poland', flag: '🇵🇱', dialCode: '48' },
  { code: 'PT', label: 'Portugal', flag: '🇵🇹', dialCode: '351' },
  { code: 'QA', label: 'Qatar', flag: '🇶🇦', dialCode: '974' },
  { code: 'RO', label: 'Romania', flag: '🇷🇴', dialCode: '40' },
  { code: 'RU', label: 'Russia', flag: '🇷🇺', dialCode: '7' },
  { code: 'RW', label: 'Rwanda', flag: '🇷🇼', dialCode: '250' },
  { code: 'KN', label: 'Saint Kitts and Nevis', flag: '🇰🇳', dialCode: '1' },
  { code: 'LC', label: 'Saint Lucia', flag: '🇱🇨', dialCode: '1' },
  { code: 'VC', label: 'Saint Vincent and the Grenadines', flag: '🇻🇨', dialCode: '1' },
  { code: 'WS', label: 'Samoa', flag: '🇼🇸', dialCode: '685' },
  { code: 'SM', label: 'San Marino', flag: '🇸🇲', dialCode: '378' },
  { code: 'ST', label: 'Sao Tome and Principe', flag: '🇸🇹', dialCode: '239' },
  { code: 'SA', label: 'Saudi Arabia', flag: '🇸🇦', dialCode: '966' },
  { code: 'SN', label: 'Senegal', flag: '🇸🇳', dialCode: '221' },
  { code: 'RS', label: 'Serbia', flag: '🇷🇸', dialCode: '381' },
  { code: 'SC', label: 'Seychelles', flag: '🇸🇨', dialCode: '248' },
  { code: 'SL', label: 'Sierra Leone', flag: '🇸🇱', dialCode: '232' },
  { code: 'SG', label: 'Singapore', flag: '🇸🇬', dialCode: '65' },
  { code: 'SK', label: 'Slovakia', flag: '🇸🇰', dialCode: '421' },
  { code: 'SI', label: 'Slovenia', flag: '🇸🇮', dialCode: '386' },
  { code: 'SB', label: 'Solomon Islands', flag: '🇸🇧', dialCode: '677' },
  { code: 'SO', label: 'Somalia', flag: '🇸🇴', dialCode: '252' },
  { code: 'ZA', label: 'South Africa', flag: '🇿🇦', dialCode: '27' },
  { code: 'KR', label: 'South Korea', flag: '🇰🇷', dialCode: '82' },
  { code: 'SS', label: 'South Sudan', flag: '🇸🇸', dialCode: '211' },
  { code: 'ES', label: 'Spain', flag: '🇪🇸', dialCode: '34' },
  { code: 'LK', label: 'Sri Lanka', flag: '🇱🇰', dialCode: '94' },
  { code: 'SD', label: 'Sudan', flag: '🇸🇩', dialCode: '249' },
  { code: 'SR', label: 'Suriname', flag: '🇸🇷', dialCode: '597' },
  { code: 'SE', label: 'Sweden', flag: '🇸🇪', dialCode: '46' },
  { code: 'CH', label: 'Switzerland', flag: '🇨🇭', dialCode: '41' },
  { code: 'SY', label: 'Syria', flag: '🇸🇾', dialCode: '963' },
  { code: 'TW', label: 'Taiwan', flag: '🇹🇼', dialCode: '886' },
  { code: 'TJ', label: 'Tajikistan', flag: '🇹🇯', dialCode: '992' },
  { code: 'TZ', label: 'Tanzania', flag: '🇹🇿', dialCode: '255' },
  { code: 'TH', label: 'Thailand', flag: '🇹🇭', dialCode: '66' },
  { code: 'TL', label: 'Timor-Leste', flag: '🇹🇱', dialCode: '670' },
  { code: 'TG', label: 'Togo', flag: '🇹🇬', dialCode: '228' },
  { code: 'TO', label: 'Tonga', flag: '🇹🇴', dialCode: '676' },
  { code: 'TT', label: 'Trinidad and Tobago', flag: '🇹🇹', dialCode: '1' },
  { code: 'TN', label: 'Tunisia', flag: '🇹🇳', dialCode: '216' },
  { code: 'TR', label: 'Turkey', flag: '🇹🇷', dialCode: '90' },
  { code: 'TM', label: 'Turkmenistan', flag: '🇹🇲', dialCode: '993' },
  { code: 'TV', label: 'Tuvalu', flag: '🇹🇻', dialCode: '688' },
  { code: 'UG', label: 'Uganda', flag: '🇺🇬', dialCode: '256' },
  { code: 'UA', label: 'Ukraine', flag: '🇺🇦', dialCode: '380' },
  { code: 'AE', label: 'United Arab Emirates', flag: '🇦🇪', dialCode: '971' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧', dialCode: '44' },
  { code: 'US', label: 'United States', flag: '🇺🇸', dialCode: '1' },
  { code: 'UY', label: 'Uruguay', flag: '🇺🇾', dialCode: '598' },
  { code: 'UZ', label: 'Uzbekistan', flag: '🇺🇿', dialCode: '998' },
  { code: 'VU', label: 'Vanuatu', flag: '🇻🇺', dialCode: '678' },
  { code: 'VE', label: 'Venezuela', flag: '🇻🇪', dialCode: '58' },
  { code: 'VN', label: 'Vietnam', flag: '🇻🇳', dialCode: '84' },
  { code: 'YE', label: 'Yemen', flag: '🇾🇪', dialCode: '967' },
  { code: 'ZM', label: 'Zambia', flag: '🇿🇲', dialCode: '260' },
  { code: 'ZW', label: 'Zimbabwe', flag: '🇿🇼', dialCode: '263' },
];

// Reuse PHONE_COUNTRIES as the country list for LocationStep (strip dialCode)
COUNTRIES = PHONE_COUNTRIES.map(({ code, label, flag }) => ({ code, label, flag }));

function guessCountryCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Colombo') return 'LK';
    if (tz.startsWith('Asia/Kolkata') || tz === 'Asia/Calcutta') return 'IN';
    if (tz.startsWith('Australia/')) return 'AU';
    if (tz === 'Europe/London') return 'GB';
    if (tz.startsWith('Pacific/Auckland') || tz === 'Pacific/Chatham') return 'NZ';
    if (tz === 'Asia/Singapore') return 'SG';
    if (tz === 'Asia/Dubai') return 'AE';
    if (tz === 'Asia/Riyadh') return 'SA';
    if (tz === 'Asia/Karachi') return 'PK';
    if (tz === 'Asia/Dhaka') return 'BD';
    if (tz === 'Asia/Kuala_Lumpur' || tz === 'Asia/Kuching') return 'MY';
    if (tz === 'Africa/Nairobi') return 'KE';
    if (tz === 'Africa/Lagos') return 'NG';
    if (tz === 'Africa/Johannesburg') return 'ZA';
    if (tz === 'Europe/Berlin') return 'DE';
    if (tz === 'Europe/Istanbul') return 'TR';
    if (tz === 'America/Sao_Paulo') return 'BR';
    if (tz === 'Asia/Tokyo') return 'JP';
    if (tz.startsWith('Asia/Shanghai')) return 'CN';
    if (tz === 'Asia/Manila') return 'PH';
    if (tz === 'Asia/Muscat') return 'OM';
    if (tz === 'Asia/Qatar') return 'QA';
    if (
      tz === 'America/Toronto' ||
      tz === 'America/Vancouver' ||
      tz === 'America/Winnipeg' ||
      tz === 'America/Halifax'
    )
      return 'CA';
    if (tz.startsWith('America/')) return 'US';
  } catch {
    // ignore
  }
  return 'US';
}

function initPhoneState(phone: string): { code: string; national: string } {
  if (!phone?.startsWith('+')) {
    return { code: guessCountryCode(), national: phone?.replace(/\D/g, '') ?? '' };
  }
  const digits = phone.slice(1).replace(/\D/g, '');
  const sorted = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  );
  for (const c of sorted) {
    if (digits.startsWith(c.dialCode)) {
      return { code: c.code, national: digits.slice(c.dialCode.length) };
    }
  }
  return { code: guessCountryCode(), national: digits };
}

function PhoneStep({
  phone,
  setPhone,
  s,
  colors,
  isChild,
}: {
  phone: string;
  setPhone: (v: string) => void;
  s: S;
  colors: AppColors;
  isChild: boolean;
}) {
  const [selectedCode, setSelectedCode] = useState(() => initPhoneState(phone).code);
  const [nationalNumber, setNationalNumber] = useState(
    () => initPhoneState(phone).national,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const selectedCountry =
    PHONE_COUNTRIES.find((c) => c.code === selectedCode) ??
    PHONE_COUNTRIES.find((c) => c.code === 'US')!;

  const isValid = useMemo<boolean | null>(() => {
    if (!nationalNumber.trim()) return null;
    try {
      return isValidPhoneNumber(nationalNumber, selectedCode as CountryCode);
    } catch {
      return false;
    }
  }, [nationalNumber, selectedCode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return PHONE_COUNTRIES;
    const q = search.toLowerCase();
    return PHONE_COUNTRIES.filter(
      (c) => c.label.toLowerCase().includes(q) || c.dialCode.includes(q),
    );
  }, [search]);

  const syncPhone = useCallback(
    (dialCode: string, national: string, code: string) => {
      const digits = national.replace(/\D/g, '');
      if (!digits) {
        setPhone('');
        return;
      }
      try {
        if (isValidPhoneNumber(national, code as CountryCode)) {
          setPhone(`+${dialCode}${digits}`);
        } else {
          setPhone('');
        }
      } catch {
        setPhone('');
      }
    },
    [setPhone],
  );

  const handleNumberChange = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^\d\s\-()]/g, '');
      setNationalNumber(cleaned);
      setIsDirty(true);
      syncPhone(selectedCountry.dialCode, cleaned, selectedCode);
    },
    [selectedCountry.dialCode, selectedCode, syncPhone],
  );

  const handleCountrySelect = useCallback(
    (country: PhoneCountry) => {
      setSelectedCode(country.code);
      setShowPicker(false);
      setSearch('');
      syncPhone(country.dialCode, nationalNumber, country.code);
    },
    [nationalNumber, syncPhone],
  );

  if (showPicker) {
    return (
      <>
        <TouchableOpacity
          style={[s.listItem, { marginBottom: 12 }]}
          onPress={() => {
            setShowPicker(false);
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
            placeholder="Search countries…"
            placeholderTextColor={s.placeholderColor}
            autoFocus
            autoCapitalize="none"
          />
        </View>
        {filtered.map((c) => {
          const sel = c.code === selectedCode;
          return (
            <TouchableOpacity
              key={c.code}
              style={[s.listItem, sel && s.listItemSelected]}
              onPress={() => handleCountrySelect(c)}
            >
              <Text style={s.listFlag}>{c.flag}</Text>
              <Text style={[s.listItemTxt, sel && s.listItemSelectedTxt]}>{c.label}</Text>
              <Text style={{ fontSize: 14, color: sel ? colors.teal : colors.textFaint }}>
                +{c.dialCode}
              </Text>
              {sel && <Text style={[s.listCheck, { marginLeft: 6 }]}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </>
    );
  }

  return (
    <>
      <Text style={s.label}>
        Phone Number{isChild ? <Text style={s.labelOptional}> (optional)</Text> : null}
      </Text>
      <View
        style={[
          s.inputWrap,
          isDirty && isValid === false ? s.inputWrapError : focused && s.inputWrapFocused,
          isValid === true && s.inputWrapFocused,
          { paddingHorizontal: 0 },
        ]}
      >
        <TouchableOpacity
          style={{
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingHorizontal: 14,
            gap: 6,
          }}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 22 }}>{selectedCountry.flag}</Text>
          <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' as const }}>
            +{selectedCountry.dialCode}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textFaint }}>▾</Text>
        </TouchableOpacity>
        <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 12 }} />
        <TextInput
          style={[s.input, { paddingHorizontal: 14 }]}
          value={nationalNumber}
          onChangeText={handleNumberChange}
          placeholder="Phone number"
          placeholderTextColor={s.placeholderColor}
          keyboardType="phone-pad"
          autoFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isValid === true && (
          <Text style={{ fontSize: 18, color: colors.teal, paddingHorizontal: 12 }}>
            ✓
          </Text>
        )}
      </View>
      {isDirty && isValid === false ? (
        <Text
          style={{ fontSize: 13, color: '#ef4444', marginTop: -10, marginBottom: 12 }}
        >
          Enter a valid {selectedCountry.label} number
        </Text>
      ) : (
        <Text style={s.inputHint}>Tap the flag to change your country</Text>
      )}
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
      <TouchableOpacity
        style={[
          s.listItem,
          s.listItemSelected,
          { flexDirection: 'row', alignItems: 'center' },
        ]}
        onPress={() => {
          setShowManual(true);
          setDetectedLabel(null);
        }}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[s.listItemSelectedTxt, { fontWeight: '700', fontSize: 13 }]}>
            ✓ Time zone selected
          </Text>
          <Text style={[s.listItemSelectedTxt, { fontSize: 17 }]}>{label}</Text>
        </View>
        <Text style={{ fontSize: 13, color: colors.teal, fontWeight: '500' }}>Edit</Text>
      </TouchableOpacity>
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
      </>
    );
  }

  // Manual selection
  return (
    <>
      {!detectError && (
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
      )}
      {detectError ? (
        <Text style={[s.inputHint, { marginBottom: 12 }]}>{detectError}</Text>
      ) : null}
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
  const [focusedField, setFocusedField] = useState<'city' | 'region' | 'postal' | null>(
    null,
  );
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
      <View style={[s.inputWrap, focusedField === 'city' && s.inputWrapFocused]}>
        <TextInput
          style={s.input}
          value={city}
          onChangeText={setCity}
          placeholder={addrConfig.cityPlaceholder}
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="next"
          onFocus={() => setFocusedField('city')}
          onBlur={() => setFocusedField(null)}
        />
      </View>

      <Text style={s.label}>{addrConfig.regionLabel}</Text>
      <View style={[s.inputWrap, focusedField === 'region' && s.inputWrapFocused]}>
        <TextInput
          style={s.input}
          value={region}
          onChangeText={setRegion}
          placeholder={addrConfig.regionPlaceholder}
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="next"
          onFocus={() => setFocusedField('region')}
          onBlur={() => setFocusedField(null)}
        />
      </View>

      <Text style={s.label}>
        {addrConfig.postalLabel}
        {'  '}
        <Text style={s.labelOptional}>(optional)</Text>
      </Text>
      <View style={[s.inputWrap, focusedField === 'postal' && s.inputWrapFocused]}>
        <TextInput
          style={s.input}
          value={postalCode}
          onChangeText={setPostalCode}
          placeholder={addrConfig.postalPlaceholder}
          placeholderTextColor={s.placeholderColor}
          returnKeyType="done"
          onFocus={() => setFocusedField('postal')}
          onBlur={() => setFocusedField(null)}
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
  const [focused, setFocused] = useState(false);
  return (
    <>
      <Text style={s.label}>Year of Birth</Text>
      <View style={[s.inputWrap, focused && s.inputWrapFocused]}>
        <TextInput
          style={s.input}
          value={birthYear}
          onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
          placeholder={`e.g. ${BIRTH_YEARS[8]}`}
          placeholderTextColor={s.placeholderColor}
          keyboardType="number-pad"
          maxLength={4}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
  const [focusedField, setFocusedField] = useState<
    'firstName' | 'lastName' | 'birthYear' | null
  >(null);

  return (
    <>
      <Text style={s.label}>Child First Name</Text>
      <View style={[s.inputWrap, focusedField === 'firstName' && s.inputWrapFocused]}>
        <TextInput
          style={s.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="next"
          onFocus={() => setFocusedField('firstName')}
          onBlur={() => setFocusedField(null)}
        />
      </View>

      <Text style={s.label}>Child Last Name</Text>
      <View style={[s.inputWrap, focusedField === 'lastName' && s.inputWrapFocused]}>
        <TextInput
          style={s.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={s.placeholderColor}
          autoCapitalize="words"
          returnKeyType="next"
          onFocus={() => setFocusedField('lastName')}
          onBlur={() => setFocusedField(null)}
        />
      </View>

      <Text style={s.label}>Year of Birth</Text>
      <View style={[s.inputWrap, focusedField === 'birthYear' && s.inputWrapFocused]}>
        <TextInput
          style={s.input}
          value={birthYear}
          onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
          placeholder={`e.g. ${BIRTH_YEARS[8]}`}
          placeholderTextColor={s.placeholderColor}
          keyboardType="number-pad"
          maxLength={4}
          onFocus={() => setFocusedField('birthYear')}
          onBlur={() => setFocusedField(null)}
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
  const sessionUserId = session?.user.id ?? null;
  const onboardingStatusQueryKey = useMemo(
    () => (sessionUserId ? queryKeys.onboardingStatus(sessionUserId) : null),
    [sessionUserId],
  );
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
  const studentGradeOptions = useMemo(
    () => optionsForCountry(normalizeCountryCode(countryCode), false),
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

  const progressAnim = useRef(new Animated.Value(0)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;

  // Synchronously seed from the user-scoped TanStack Query cache.
  // If cache is cold this is null and statusLoading starts true.
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(
    () =>
      (onboardingStatusQueryKey
        ? queryClient.getQueryData<OnboardingStatus>(onboardingStatusQueryKey)
        : null) ?? null,
  );
  const [statusLoading, setStatusLoading] = useState(
    () =>
      !onboardingStatusQueryKey || !queryClient.getQueryData(onboardingStatusQueryKey),
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const roleClaimedRef = useRef(false);

  // Load onboarding status. If the account doesn't exist yet (new user arriving
  // via OAuth or OTP), create a parent account first then re-fetch.
  useEffect(() => {
    async function loadOnboarding() {
      setStatusError(null);
      if (!onboardingStatusQueryKey) return;
      try {
        let data: OnboardingStatus;
        try {
          data = await queryClient.fetchQuery({
            queryKey: onboardingStatusQueryKey,
            queryFn: fetchOnboardingStatus,
            staleTime: 5 * 60 * 1000,
          });
        } catch {
          // Account doesn't exist yet — create parent account first.
          if (!roleClaimedRef.current) {
            roleClaimedRef.current = true;
            await completeParentRole();
            queryClient.removeQueries({ queryKey: onboardingStatusQueryKey });
            queryClient.invalidateQueries({ queryKey: ['account-base', sessionUserId] });
          }
          data = await queryClient.fetchQuery({
            queryKey: onboardingStatusQueryKey,
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
  }, [
    onboardingStatusQueryKey,
    queryClient,
    retryCount,
    router,
    sessionUserId,
    setOnboardingCompletionStatus,
  ]);

  const kind = onboarding?.profileKind ?? onboarding?.primaryRole ?? null;

  const steps = useMemo(
    () => buildSteps(onboarding?.profileKind ?? null, onboarding?.primaryRole ?? null),
    [onboarding?.profileKind, onboarding?.primaryRole],
  );
  const currentStep = steps[stepIdx] as WizardStepId | undefined;
  const isLastStep = stepIdx === steps.length - 1;

  useEffect(() => {
    const target = steps.length > 0 ? (stepIdx + 1) / steps.length : 0;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [stepIdx, steps.length, progressAnim]);

  useEffect(() => {
    stepFadeAnim.setValue(0);
    Animated.timing(stepFadeAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [stepIdx, stepFadeAnim]);

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
        if (onboardingStatusQueryKey) {
          queryClient.invalidateQueries({ queryKey: onboardingStatusQueryKey });
        }
        queryClient.invalidateQueries({ queryKey: ['account-base', sessionUserId] });
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
                if (onboardingStatusQueryKey) {
                  queryClient.removeQueries({ queryKey: onboardingStatusQueryKey });
                }
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
          {stepIdx + 1} of {steps.length}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Animated progress bar */}
      <View style={s.progressTrack}>
        <Animated.View
          style={[
            s.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
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
          <Animated.View style={{ opacity: stepFadeAnim }}>
            {meta && (
              <>
                <View style={s.badge}>
                  <Text style={s.badgeEmoji}>{meta.emoji}</Text>
                </View>
                <Text style={s.heading}>{meta.title}</Text>
                <Text style={s.sub}>
                  {currentStep === 'name' && kind === 'guardian'
                    ? 'Your name as the parent or guardian on this account.'
                    : meta.subtitle}
                </Text>
              </>
            )}

            {currentStep === 'name' && (
              <NameStep
                firstName={firstName}
                setFirstName={setFirstName}
                lastName={lastName}
                setLastName={setLastName}
                isGuardian={kind === 'guardian'}
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
                gradeOptions={studentGradeOptions}
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
                gradeOptions={studentGradeOptions}
                s={s}
              />
            )}
          </Animated.View>

          {!!error && <Text style={s.errorTxt}>{error}</Text>}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btn, !canNext && s.btnDim]}
            onPress={handleNext}
            disabled={!canNext || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.tealFg} />
            ) : (
              <Text style={s.btnTxt}>{isLastStep ? 'Finish' : 'Continue'}</Text>
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
