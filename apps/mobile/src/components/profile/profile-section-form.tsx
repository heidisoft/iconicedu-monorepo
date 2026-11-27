import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { useQueryClient } from '@tanstack/react-query';
import {
  PROFILE_COUNTRIES,
  optionsForCountry,
  normalizeCountryCode,
  type ProfileSettingsInput,
  type ProfileSettingsSectionInput,
  type ProfileSettingsSection,
} from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { supabase } from '@/lib/supabase/client';
import { chooseProfilePhoto } from '@/lib/profile-photo-picker';
import { saveProfileSettings } from '@/lib/api/profile-settings';
import { LocationCountryField } from '@/components/auth/location-country-field';
import { LocationAddressFields } from '@/components/auth/location-address-fields';
import { GradeLevelSelect } from '@/components/auth/grade-level-select';
import { BirthYearSelect } from '@/components/auth/birth-year-select';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import { RegionalFields } from './regional-fields';
import { ThemeModePicker } from './theme-mode-options';
import { ProfileTextInput, profileFieldStyles } from './profile-text-input';
export const sectionTitles: Record<ProfileSettingsSection, string> = {
  identity: 'Identity',
  photo: 'Photo',
  appearance: 'Appearance',
  location: 'Location',
  regional: 'Regional',
  visibility: 'Visibility',
  child: 'Learning Details',
  about: 'About',
};
const THEMES = [
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'rose',
  'orange',
  'amber',
  'slate',
];

export function ProfileSectionForm({
  profile,
  section,
  initialPhoto = null,
  onClose,
  onDraftSave,
}: {
  profile: Record<string, unknown>;
  section: ProfileSettingsSection;
  initialPhoto?: string | null;
  onClose?: () => void;
  onDraftSave?: (input: ProfileSettingsSectionInput) => void;
}) {
  const { colors, mode, setMode } = useTheme();
  const [draftMode, setDraftMode] = useState(mode);
  const client = useQueryClient();
  const family = useFamilyView();
  const value = (key: string, fallback = '') =>
    typeof profile[key] === 'string' ? (profile[key] as string) : fallback;
  const identityInputs = useRef<Record<string, TextInput | null>>({});
  const [firstName, setFirst] = useState(value('first_name'));
  const [lastName, setLast] = useState(value('last_name'));
  const [displayName, setDisplay] = useState(value('display_name'));
  const [themeKey, setTheme] = useState(value('ui_theme_key', 'green'));
  const [timezone, setTimezone] = useState(
    value('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  const [locale, setLocale] = useState(value('locale', 'en-US'));
  const [countryCode, setCountry] = useState(value('country_code'));
  const [city, setCity] = useState(value('city'));
  const [region, setRegion] = useState(value('region'));
  const [postalCode, setPostal] = useState(value('postal_code'));
  const [hideRole, setHideRole] = useState(profile.hide_role === true);
  const [hideStatus, setHideStatus] = useState(profile.hide_status === true);
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [grade, setGrade] = useState<string | null>(value('grade_level') || null);
  const [year, setYear] = useState(profile.birth_year ? String(profile.birth_year) : '');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const disabled = busy || reviewing;
  const [bio, setBio] = useState(value('bio'));
  const [languages, setLanguages] = useState(
    Array.isArray(profile.languages_spoken) ? profile.languages_spoken.join(', ') : '',
  );
  const show = (key: ProfileSettingsSection) => section === key;
  const text = { color: colors.text };
  const fieldStyles = {
    label: { ...profileFieldStyles(colors).label, marginBottom: 6 },
    labelOptional: { color: colors.textMuted, fontSize: 13 },
    inputWrap: {
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 56,
      paddingHorizontal: 16,
      marginBottom: 16,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    inputWrapFocused: { borderColor: colors.teal },
    input: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      paddingVertical: 16,
      includeFontPadding: false,
    },
    placeholderColor: colors.textFaint,
  };
  const error = (e: unknown) =>
    Alert.alert('Unable to save', e instanceof Error ? e.message : 'Please try again.');

  async function pickPhoto() {
    if (disabled) return;
    const selected = await chooseProfilePhoto();
    if (selected) setPhoto(selected);
  }

  async function save(input: ProfileSettingsSectionInput) {
    setBusy(true);
    try {
      if (photo && section === 'photo') {
        const converted = await manipulateAsync(photo, [{ resize: { width: 512 } }], {
          compress: 0.8,
          format: SaveFormat.JPEG,
        });
        const bytes = await new File(converted.uri).arrayBuffer();
        if (bytes.byteLength > 5 * 1024 * 1024)
          throw new Error('Choose a photo smaller than 5 MB.');
        const path = `${profile.org_id}/${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('public-avatars')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw new Error('Photo upload failed. Please try again.');
        const avatarUrl = supabase.storage.from('public-avatars').getPublicUrl(path)
          .data.publicUrl;
        if ('section' in input && input.section === 'photo')
          input.values.avatarUrl = avatarUrl;
      }
      await saveProfileSettings(String(profile.id), input);
      if (section === 'appearance') setMode(draftMode);
      await client.invalidateQueries();
      await family.refresh();
      onClose?.();
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  }

  function review() {
    if (disabled) return;
    if (section === 'photo' && !photo) return;
    if (
      show('identity') &&
      (onDraftSave ? [firstName, lastName] : [firstName, lastName, displayName]).some(
        (v) => !v.trim() || v.trim().length > 100,
      )
    ) {
      Alert.alert(
        'Check names',
        onDraftSave
          ? 'Enter first and last names using 1–100 characters each.'
          : 'Enter first, last and display names using 1–100 characters each.',
      );
      return;
    }
    try {
      if (show('regional')) new Intl.DateTimeFormat(locale, { timeZone: timezone });
    } catch {
      Alert.alert(
        'Check regional settings',
        'Enter a valid language/region code and timezone.',
      );
      return;
    }
    if (show('child') && (!grade || !year)) {
      Alert.alert('Child details', 'Select a grade and birth year.');
      return;
    }
    const input: ProfileSettingsInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      displayName: onDraftSave
        ? `${firstName.trim()} ${lastName.trim().charAt(0).toUpperCase()}`.trim()
        : displayName.trim(),
      themeKey,
      timezone,
      locale,
      hideRole,
      hideStatus,
      ...(show('child') ? { birthYear: Number(year), gradeLevel: grade! } : {}),
      ...(countryCode ? { location: { countryCode, city, region, postalCode } } : {}),
    };
    const changes: ProfileSettingsSectionInput =
      section === 'photo'
        ? { section, values: { avatarUrl: '' } }
        : section === 'identity'
          ? {
              section,
              values: {
                firstName: input.firstName,
                lastName: input.lastName,
                displayName: input.displayName,
              },
            }
          : section === 'appearance'
            ? { section, values: { themeKey } }
            : section === 'location'
              ? {
                  section,
                  values: { location: { countryCode, city, region, postalCode } },
                }
              : section === 'regional'
                ? {
                    section,
                    values: {
                      timezone,
                      locale,
                      languagesSpoken: languages
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
                    },
                  }
                : section === 'visibility'
                  ? { section, values: { hideRole, hideStatus } }
                  : section === 'about'
                    ? { section, values: { bio } }
                    : {
                        section: 'child',
                        values: { birthYear: Number(year), gradeLevel: grade! },
                      };
    if (onDraftSave) {
      onDraftSave(changes);
      onClose?.();
      return;
    }
    const summary =
      section === 'photo'
        ? 'Use this photo for your profile?'
        : section === 'identity'
          ? `${input.firstName} ${input.lastName}\nDisplay name: ${input.displayName}`
          : section === 'appearance'
            ? `Theme: ${draftMode === 'system' ? 'Use device setting' : draftMode}\nAccent: ${themeKey}`
            : section === 'location'
              ? [city, region, postalCode, countryCode].filter(Boolean).join(', ')
              : section === 'regional'
                ? `Time zone: ${timezone}\nLanguage / region: ${locale}`
                : section === 'visibility'
                  ? `Account role: ${hideRole ? 'Hidden' : 'Visible'}\nAccount status: ${hideStatus ? 'Hidden' : 'Visible'}`
                  : section === 'about'
                    ? bio.trim() || 'Clear bio'
                    : section === 'child'
                      ? `Birth year: ${year}\nGrade: ${grade}`
                      : `${input.firstName} ${input.lastName}\nBirth year: ${year}\nGrade: ${grade}`;
    setReviewing(true);
    Alert.alert(
      `Save ${sectionTitles[section].toLowerCase()} changes?`,
      summary,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setReviewing(false) },
        {
          text: 'Save',
          onPress: () => {
            setReviewing(false);
            void save(changes);
          },
        },
      ],
      { cancelable: true, onDismiss: () => setReviewing(false) },
    );
  }

  const hasFields = ['identity', 'child', 'location', 'regional', 'about'].includes(
    section,
  );
  const avatar = photo ?? value('avatar_url');
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {section && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            minHeight: 56,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            disabled={busy || reviewing}
            onPress={onClose}
            style={{
              minWidth: 44,
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: colors.teal, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}
          >
            {sectionTitles[section]}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save section changes"
            disabled={disabled || (section === 'photo' && !photo)}
            onPress={review}
            style={{
              minWidth: 44,
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: colors.teal, fontSize: 16, fontWeight: '600' }}>
              {busy ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={profileFieldStyles(colors).content}
      >
        <View style={hasFields ? profileFieldStyles(colors).card : { gap: 12 }}>
          {show('photo') && avatar ? (
            <Image
              accessibilityLabel="Profile photo preview"
              source={{ uri: avatar }}
              style={{ width: 80, height: 80, borderRadius: 40 }}
            />
          ) : null}
          {show('photo') && (
            <Pressable
              disabled={disabled}
              onPress={() => void pickPhoto()}
              accessibilityRole="button"
              accessibilityLabel="Change photo"
            >
              <Text style={{ color: colors.teal }}>Change photo</Text>
            </Pressable>
          )}
          {show('identity') &&
            (
              [
                ['First name', firstName, setFirst],
                ['Last name', lastName, setLast],
                ['Display name', displayName, setDisplay],
              ] as const
            )
              .filter(([label]) => !onDraftSave || label !== 'Display name')
              .map(([label, val, setter], index, fields) => (
                <View key={label} style={{ gap: 8 }}>
                  <Text style={profileFieldStyles(colors).label}>{label}</Text>
                  <ProfileTextInput
                    accessibilityLabel={label}
                    value={val}
                    editable={!disabled}
                    maxLength={100}
                    onChangeText={setter}
                    ref={(input) => {
                      identityInputs.current[label] = input;
                    }}
                    placeholder={label}
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoComplete={
                      index === 0 ? 'given-name' : index === 1 ? 'family-name' : 'off'
                    }
                    returnKeyType={index < fields.length - 1 ? 'next' : 'done'}
                    blurOnSubmit={index === fields.length - 1}
                    onSubmitEditing={() => {
                      const next = fields[index + 1];
                      if (next) identityInputs.current[next[0]]?.focus();
                      else Keyboard.dismiss();
                    }}
                  />
                </View>
              ))}
          {show('appearance') && (
            <>
              <Text style={text}>Theme</Text>
              <ThemeModePicker
                value={draftMode}
                onChange={setDraftMode}
                disabled={disabled}
              />
              <Text style={text}>Accent color</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {THEMES.map((theme) => {
                  const accent = profileAvatarColors({
                    themeKey: theme,
                    seed: String(profile.id),
                  });
                  const selected = themeKey === theme;
                  return (
                    <Pressable
                      key={theme}
                      accessibilityRole="radio"
                      accessibilityLabel={theme}
                      accessibilityState={{ selected, disabled }}
                      disabled={disabled}
                      onPress={() => setTheme(theme)}
                      style={{
                        width: 76,
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 36,
                          borderWidth: 2,
                          borderColor: selected ? colors.teal : 'transparent',
                          padding: 4,
                        }}
                      >
                        <View
                          testID={`accent-avatar-${theme}`}
                          style={{
                            flex: 1,
                            borderRadius: 30,
                            backgroundColor: accent.bg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{ color: accent.fg, fontSize: 26, fontWeight: '800' }}
                          >
                            {(displayName || firstName || 'Profile')[0]?.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 14,
                          textTransform: 'capitalize',
                        }}
                      >
                        {theme}
                      </Text>
                      {selected && (
                        <Text style={{ color: colors.teal, fontSize: 12 }}>Selected</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          {(show('location') || show('child')) && (
            <View
              pointerEvents={disabled ? 'none' : 'auto'}
              accessibilityElementsHidden={false}
            >
              {show('location') && (
                <LocationCountryField
                  countries={PROFILE_COUNTRIES}
                  countryCode={countryCode}
                  onChange={(code) => {
                    setCountry(code);
                    setCity('');
                    setRegion('');
                    setPostal('');
                  }}
                  colors={colors}
                  disabled={disabled}
                />
              )}
              {show('location') && countryCode ? (
                <LocationAddressFields
                  countryCode={countryCode}
                  city={city}
                  region={region}
                  postalCode={postalCode}
                  setCity={setCity}
                  setRegion={setRegion}
                  setPostalCode={setPostal}
                  s={fieldStyles}
                  disabled={disabled}
                />
              ) : null}
              {show('child') && (
                <>
                  <View style={{ gap: 8 }}>
                    <Text style={profileFieldStyles(colors).label}>Birth year</Text>
                    <BirthYearSelect
                      disabled={disabled}
                      value={year}
                      onChange={setYear}
                    />
                  </View>
                  <View style={{ gap: 8 }}>
                    <Text style={profileFieldStyles(colors).label}>Grade</Text>
                    <GradeLevelSelect
                      disabled={disabled}
                      value={grade}
                      onChange={setGrade}
                      options={optionsForCountry(normalizeCountryCode(countryCode))}
                    />
                  </View>
                </>
              )}
            </View>
          )}
          {show('regional') && (
            <RegionalFields
              timezone={timezone}
              locale={locale}
              setTimezone={setTimezone}
              setLocale={setLocale}
              languages={languages}
              setLanguages={setLanguages}
              disabled={disabled}
            />
          )}
          {show('visibility') && (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={text}>Hide account role</Text>
                <Switch
                  accessibilityLabel="Hide account role"
                  disabled={disabled}
                  value={hideRole}
                  onValueChange={setHideRole}
                />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={text}>Hide account status</Text>
                <Switch
                  accessibilityLabel="Hide account status"
                  disabled={disabled}
                  value={hideStatus}
                  onValueChange={setHideStatus}
                />
              </View>
              <Text style={{ color: colors.textMuted }}>
                Display preferences do not change account permissions.
              </Text>
            </>
          )}
          {section === 'about' && (
            <>
              <Text style={profileFieldStyles(colors).label}>Bio</Text>
              <ProfileTextInput
                accessibilityLabel="Bio"
                value={bio}
                onChangeText={setBio}
                editable={!disabled}
                multiline
                maxLength={2000}
              />
              <Text style={{ color: colors.textMuted }}>{bio.length} / 2,000</Text>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
