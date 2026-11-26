import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { SettingsRow } from '@iconicedu/ui-native';
import type { ProfileSettingsSectionInput } from '@iconicedu/shared-types';
import { useAuth } from '@/providers/auth-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { useTheme } from '@/providers/theme-provider';
import { fetchProfileSettings } from '@/lib/api/profile-settings';
import { createChildProfile } from '@/lib/api/queries';
import { ProfileDetails } from './profile-details';
import { ProfileSectionForm } from './profile-section-form';

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
  const [draft, setDraft] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    birth_year: undefined as number | undefined,
    grade_level: undefined as string | undefined,
  });
  const [email, setEmail] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [editing, setEditing] = useState<'identity' | 'child' | 'email' | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
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
      <Pressable onPress={() => void parent.refetch()}>
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
  const profile = {
    ...draft,
    id: 'new-child',
    org_id: p.org_id,
    kind: 'child',
    country_code: p.country_code,
    ui_theme_key: themeKey,
  };
  function saveDraft(input: ProfileSettingsSectionInput) {
    if (input.section === 'identity')
      setDraft((previous) => ({
        ...previous,
        first_name: input.values.firstName,
        last_name: input.values.lastName,
        display_name: input.values.displayName,
      }));
    if (input.section === 'child')
      setDraft((previous) => ({
        ...previous,
        birth_year: input.values.birthYear,
        grade_level: input.values.gradeLevel,
      }));
  }
  function saveEmail() {
    const normalized = emailDraft.trim().toLowerCase();
    if (
      normalized &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254)
    ) {
      Alert.alert('Check email', 'Enter a valid child email address.');
      return;
    }
    if (normalized && normalized === user?.email?.trim().toLowerCase()) {
      Alert.alert('Check email', 'Child email cannot match the parent email.');
      return;
    }
    setEmail(normalized);
    setEditing(null);
  }
  async function create() {
    setBusy(true);
    try {
      const child = await createChildProfile({
        orgId: String(p.org_id),
        firstName: draft.first_name,
        lastName: draft.last_name,
        displayName: draft.display_name,
        birthYear: draft.birth_year!,
        gradeLevel: draft.grade_level!,
        ...(email ? { email } : {}),
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
      setBusy(false);
    }
  }
  function confirm() {
    if (busy || reviewing) return;
    if (
      !draft.first_name ||
      !draft.last_name ||
      !draft.birth_year ||
      !draft.grade_level
    ) {
      Alert.alert(
        'Complete child details',
        'Edit Identity and Learning Details to add the required first name, last name, grade and birth year.',
      );
      return;
    }
    setReviewing(true);
    Alert.alert(
      'Add child profile?',
      `${draft.first_name} ${draft.last_name}\nBirth year: ${draft.birth_year}\nGrade: ${draft.grade_level}${email ? `\nEmail: ${email}` : ''}\n\nLocation and time zone are inherited from your profile.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setReviewing(false) },
        {
          text: 'Add child',
          onPress: () => {
            setReviewing(false);
            void create();
          },
        },
      ],
      { cancelable: true, onDismiss: () => setReviewing(false) },
    );
  }
  return (
    <>
      <ProfileDetails
        draft
        data={{
          profile,
          canEdit: true,
          canRemove: false,
          removalBlocked: false,
          childDetails: { birth_year: draft.birth_year },
          gradeLevel: draft.grade_level,
        }}
        child
        onEdit={(section) => {
          if (section === 'identity' || section === 'child') setEditing(section);
        }}
        onRemove={() => {}}
        busy={busy || reviewing}
        header={
          <Text style={{ color: colors.textMuted, paddingTop: 12 }}>
            Add the required details below. Email is optional; location and time zone are
            inherited from your profile.
          </Text>
        }
        extraSections={
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  color: colors.textFaint,
                  fontSize: 13,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                }}
              >
                Contact
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit child email"
                disabled={busy || reviewing}
                onPress={() => {
                  setEmailDraft(email);
                  setEditing('email');
                }}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.teal, fontWeight: '600' }}>Edit</Text>
              </Pressable>
            </View>
            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                overflow: 'hidden',
              }}
            >
              <SettingsRow
                icon={<Mail size={20} color={colors.textMuted} />}
                label="Email (optional)"
                labelColor={colors.text}
                hideChevron
                trailing={
                  <Text style={{ color: colors.textMuted, maxWidth: 160 }}>
                    {email || 'Not set'}
                  </Text>
                }
              />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Time zone: {inherited('timezone') || 'UTC'}
              {inherited('city') ? ` · ${inherited('city')}` : ''}
            </Text>
          </>
        }
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={busy || reviewing}
            onPress={confirm}
            style={{
              backgroundColor: colors.teal,
              borderRadius: 12,
              padding: 16,
              marginTop: 16,
            }}
          >
            <Text
              style={{ color: colors.tealFg, textAlign: 'center', fontWeight: '700' }}
            >
              {busy ? 'Adding…' : 'Add child'}
            </Text>
          </Pressable>
        }
      />
      {editing && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditing(null)}
        >
          <SheetContent backgroundColor={colors.pageBg}>
            {editing === 'email' ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                  }}
                >
                  <Pressable
                    onPress={() => setEditing(null)}
                    style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.teal }}>Cancel</Text>
                  </Pressable>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    Child email
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save child email"
                    onPress={saveEmail}
                    style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.teal, fontWeight: '600' }}>Save</Text>
                  </Pressable>
                </View>
                <View style={{ padding: 20, gap: 12 }}>
                  <Text style={{ color: colors.text }}>Email (optional)</Text>
                  <TextInput
                    accessibilityLabel="Child email"
                    value={emailDraft}
                    onChangeText={setEmailDraft}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    maxLength={254}
                    style={{
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                      borderRadius: 10,
                    }}
                  />
                  <Text style={{ color: colors.textMuted }}>
                    Add an email if your child will sign in independently. You can send an
                    invitation after creating their profile.
                  </Text>
                </View>
              </>
            ) : (
              <ProfileSectionForm
                profile={profile}
                section={editing}
                onDraftSave={saveDraft}
                onClose={() => setEditing(null)}
              />
            )}
          </SheetContent>
        </Modal>
      )}
    </>
  );
}
