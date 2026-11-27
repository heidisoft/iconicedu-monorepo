import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { normalizeCountryCode, optionsForCountry } from '@iconicedu/shared-types';
import { useAuth } from '@/providers/auth-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { useTheme } from '@/providers/theme-provider';
import { fetchProfileSettings } from '@/lib/api/profile-settings';
import { createChildProfile } from '@/lib/api/queries';
import { BirthYearSelect } from '@/components/auth/birth-year-select';
import { GradeLevelSelect } from '@/components/auth/grade-level-select';
import { ProfileDetails } from './profile-details';

export function AddChildDraft() {
  const { colors } = useTheme();
  const family = useFamilyView();
  const { user } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const parent = useQuery({
    queryKey: ['profile-settings', family.guardianProfileId],
    queryFn: () => fetchProfileSettings(family.guardianProfileId),
    enabled: !!family.guardianProfileId,
  });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [grade, setGrade] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const submitting = useRef(false);
  const lastNameInput = useRef<TextInput>(null);
  const displayNameInput = useRef<TextInput>(null);
  const disabled = busy || reviewing;

  if (!family.guardianProfileId)
    return (
      <Text style={{ color: colors.text, padding: 20 }}>
        Only parents can add child profiles.
      </Text>
    );
  if (parent.isPending)
    return (
      <Text style={{ color: colors.text, padding: 20 }}>Loading family details…</Text>
    );
  if (parent.isError || !parent.data)
    return (
      <Pressable accessibilityRole="button" onPress={() => void parent.refetch()}>
        <Text style={{ color: colors.text, padding: 20 }}>
          Unable to load family details. Tap to retry.
        </Text>
      </Pressable>
    );

  const p = parent.data.profile;
  const inherited = (key: string) =>
    typeof p[key] === 'string' ? (p[key] as string) : '';
  const themeKey = ['teal', 'blue', 'purple', 'orange', 'pink'][
    Math.max(0, family.familySwitchOptions.length - 1) % 5
  ]!;
  const suggestedDisplayName =
    `${firstName.trim().slice(0, 98)} ${lastName.trim().charAt(0).toUpperCase()}`.trim();
  const labelStyle = {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500' as const,
  };
  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    fontSize: 16,
  };

  async function create(values: {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
    birthYear: number;
    gradeLevel: string;
  }) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const { email: childEmail, ...details } = values;
      const child = await createChildProfile({
        orgId: String(p.org_id),
        ...details,
        ...(childEmail ? { email: childEmail } : {}),
        timezone: inherited('timezone') || 'UTC',
        locale: inherited('locale') || 'en-US',
        countryCode: inherited('country_code') || null,
        city: inherited('city') || null,
        region: inherited('region') || null,
        postalCode: inherited('postal_code') || null,
        themeKey,
      });
      await client.invalidateQueries();
      await family.refresh();
      router.replace({ pathname: '/(app)/settings/child', params: { id: child.ids.id } });
    } catch (error) {
      Alert.alert(
        'Unable to add child',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function confirm() {
    if (disabled || submitting.current) return;
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last || !birthYear || !grade) {
      Alert.alert(
        'Complete child details',
        'Enter a first name and last name, then select a grade and birth year.',
      );
      return;
    }
    if ([first, last, displayName.trim()].some((value) => value.length > 100)) {
      Alert.alert('Check names', 'Use no more than 100 characters for each name.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedEmail &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        normalizedEmail.length > 254)
    ) {
      Alert.alert('Check email', 'Enter a valid child email address.');
      return;
    }
    if (normalizedEmail && normalizedEmail === user?.email?.trim().toLowerCase()) {
      Alert.alert('Check email', 'Child email cannot match the parent email.');
      return;
    }
    const values = {
      firstName: first,
      lastName: last,
      displayName: displayName.trim() || suggestedDisplayName,
      birthYear: Number(birthYear),
      gradeLevel: grade,
      email: normalizedEmail,
    };
    Keyboard.dismiss();
    setReviewing(true);
    Alert.alert(
      'Add child profile?',
      `${first} ${last}\nDisplay name: ${values.displayName}\nBirth year: ${birthYear}\nGrade: ${optionsForCountry(normalizeCountryCode(inherited('country_code'))).find((option) => option.value === grade)?.label ?? grade}${normalizedEmail ? `\nEmail: ${normalizedEmail}` : ''}\n\nLocation and time zone are inherited from your profile.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setReviewing(false) },
        {
          text: 'Add child',
          onPress: () => {
            setReviewing(false);
            void create(values);
          },
        },
      ],
      { cancelable: true, onDismiss: () => setReviewing(false) },
    );
  }

  function section(title: string, fields: React.ReactNode) {
    return (
      <View style={{ marginTop: 8 }}>
        <View style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 4 }}>
          <Text
            style={{
              color: colors.textFaint,
              fontSize: 13,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {title}
          </Text>
        </View>
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 16,
            gap: 18,
          }}
        >
          {fields}
        </View>
      </View>
    );
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ProfileDetails
        draft
        child
        data={{
          profile: {
            id: 'new-child',
            org_id: p.org_id,
            kind: 'child',
            ui_theme_key: themeKey,
            country_code: p.country_code,
            first_name: firstName,
            last_name: lastName,
            display_name: displayName.trim() || suggestedDisplayName,
          },
          canEdit: true,
          canRemove: false,
          removalBlocked: false,
        }}
        onEdit={() => {}}
        onRemove={() => {}}
        busy={disabled}
        header={
          <Text style={{ color: colors.textMuted, paddingTop: 12, lineHeight: 22 }}>
            Add the required details below. Fields marked with * are required; location
            and time zone are inherited from your profile.
          </Text>
        }
        sectionsContent={
          <>
            {section(
              'Identity',
              <>
                <View style={{ gap: 8 }}>
                  <Text style={labelStyle} nativeID="child-first-name-label">
                    First name *
                  </Text>
                  <TextInput
                    accessibilityLabel="First name"
                    accessibilityLabelledBy="child-first-name-label"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Child first name"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    textContentType="givenName"
                    autoCorrect={false}
                    maxLength={100}
                    editable={!disabled}
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameInput.current?.focus()}
                    blurOnSubmit={false}
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                    style={[
                      inputStyle,
                      focusedField === 'firstName' && { borderColor: colors.teal },
                    ]}
                  />
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={labelStyle} nativeID="child-last-name-label">
                    Last name *
                  </Text>
                  <TextInput
                    ref={lastNameInput}
                    accessibilityLabel="Last name"
                    accessibilityLabelledBy="child-last-name-label"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Child last name"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    textContentType="familyName"
                    autoCorrect={false}
                    maxLength={100}
                    editable={!disabled}
                    returnKeyType="next"
                    onSubmitEditing={() => displayNameInput.current?.focus()}
                    blurOnSubmit={false}
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField(null)}
                    style={[
                      inputStyle,
                      focusedField === 'lastName' && { borderColor: colors.teal },
                    ]}
                  />
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={labelStyle} nativeID="child-display-name-label">
                    Display name (optional)
                  </Text>
                  <TextInput
                    ref={displayNameInput}
                    accessibilityLabel="Display name"
                    accessibilityLabelledBy="child-display-name-label"
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={suggestedDisplayName || 'Child display name'}
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={100}
                    editable={!disabled}
                    returnKeyType="done"
                    onFocus={() => setFocusedField('displayName')}
                    onBlur={() => setFocusedField(null)}
                    style={[
                      inputStyle,
                      focusedField === 'displayName' && { borderColor: colors.teal },
                    ]}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    Leave blank to use their first name and last initial.
                  </Text>
                </View>
              </>,
            )}
            {section(
              'Learning Details',
              <>
                <View
                  style={{ gap: 8 }}
                  accessibilityElementsHidden={disabled}
                  importantForAccessibility={disabled ? 'no-hide-descendants' : 'auto'}
                  pointerEvents={disabled ? 'none' : 'auto'}
                >
                  <Text style={labelStyle}>Birth year *</Text>
                  <BirthYearSelect value={birthYear} onChange={setBirthYear} />
                </View>
                <View
                  style={{ gap: 8 }}
                  accessibilityElementsHidden={disabled}
                  importantForAccessibility={disabled ? 'no-hide-descendants' : 'auto'}
                  pointerEvents={disabled ? 'none' : 'auto'}
                >
                  <Text style={labelStyle}>Grade level *</Text>
                  <GradeLevelSelect
                    value={grade}
                    onChange={setGrade}
                    options={optionsForCountry(
                      normalizeCountryCode(inherited('country_code')),
                    )}
                  />
                </View>
              </>,
            )}
          </>
        }
        extraSections={
          <>
            {section(
              'Contact',
              <>
                <View style={{ gap: 8 }}>
                  <Text style={labelStyle} nativeID="child-email-label">
                    Email (optional)
                  </Text>
                  <TextInput
                    accessibilityLabel="Child email"
                    accessibilityLabelledBy="child-email-label"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Child email address"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    maxLength={254}
                    editable={!disabled}
                    returnKeyType="done"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    style={[
                      inputStyle,
                      focusedField === 'email' && { borderColor: colors.teal },
                    ]}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
                    Add an email if your child will sign in independently. You can send an
                    invitation after creating their profile.
                  </Text>
                </View>{' '}
              </>,
            )}
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
              Time zone: {inherited('timezone') || 'UTC'}
              {inherited('city') ? ` · ${inherited('city')}` : ''}
            </Text>
          </>
        }
        footer={
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, busy }}
            disabled={disabled}
            onPress={confirm}
            style={{
              backgroundColor: colors.teal,
              borderRadius: 12,
              padding: 16,
              minHeight: 52,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                color: colors.tealFg,
                textAlign: 'center',
                fontWeight: '700',
                fontSize: 16,
              }}
            >
              {busy ? 'Adding…' : 'Add child'}
            </Text>
          </Pressable>
        }
      />
    </KeyboardAvoidingView>
  );
}
