import React, { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import {
  SearchableSelectionSheet,
  type SelectionOption,
} from '@iconicedu/ui-native/components/searchable-selection-sheet';
import {
  PROFILE_COUNTRIES,
  getCountryRegions,
  findCountryRegion,
  optionsForCountry,
  normalizeCountryCode,
  type ProfileSettingsSectionInput,
} from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import {
  fetchProfileSettings,
  saveProfileSettings,
  type ProfileSettingsResult,
} from '@/lib/api/profile-settings';
import { timezoneIds, timezoneOption } from '@/components/auth/timezone-options';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import type { ThemeMode } from '@/lib/theme';
import { ProfileTextInput, profileFieldStyles } from './profile-text-input';
import { MODE_OPTIONS } from './theme-mode-options';
import { ProfileSectionForm } from './profile-section-form';

export const itemLabels = {
  first_name: 'First Name',
  last_name: 'Last Name',
  display_name: 'Display Name',
  bio: 'Bio',
  birth_year: 'Birth Year',
  grade_level: 'Grade',
  country_code: 'Country',
  city: 'City',
  region: 'Region / State',
  postal_code: 'Postal Code',
  timezone: 'Timezone',
  locale: 'Locale',
  languages_spoken: 'Languages',
  ui_theme_key: 'Accent Color',
  mode: 'Theme',
} as const;
export type ProfileItem = keyof typeof itemLabels;
const accents = [
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

/** Opens one field directly from its existing data row. API authorization and audit are unchanged. */
export function ProfileItemEditor({
  data,
  field,
  onClose,
}: {
  data: ProfileSettingsResult;
  field: ProfileItem;
  onClose: () => void;
}) {
  const { colors, mode, setMode } = useTheme();
  const family = useFamilyView();
  const client = useQueryClient();
  const p = data.profile;
  const str = (key: string, fallback = '') =>
    typeof p[key] === 'string' ? (p[key] as string) : fallback;
  const initial =
    field === 'mode'
      ? mode
      : field === 'birth_year'
        ? String(data.childDetails?.birth_year ?? '')
        : field === 'grade_level'
          ? (data.gradeLevel ?? '')
          : field === 'languages_spoken'
            ? Array.isArray(p.languages_spoken)
              ? p.languages_spoken.join(', ')
              : ''
            : str(field);
  const [draft, setDraft] = useState(initial);
  const [countryDraft, setCountryDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const closed = useRef(false);
  const label = itemLabels[field];
  React.useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
    };
  }, []);
  function close() {
    if (!locked.current) {
      closed.current = true;
      onClose();
    }
  }

  function payload(value: string): ProfileSettingsSectionInput {
    if (['first_name', 'last_name', 'display_name'].includes(field))
      return {
        section: 'identity',
        values: {
          firstName: field === 'first_name' ? value : str('first_name'),
          lastName: field === 'last_name' ? value : str('last_name'),
          displayName: field === 'display_name' ? value : str('display_name'),
        },
      };
    if (field === 'bio') return { section: 'about', values: { bio: value } };
    if (field === 'ui_theme_key')
      return { section: 'appearance', values: { themeKey: value } };
    if (field === 'birth_year' || field === 'grade_level')
      return {
        section: 'child',
        values: {
          birthYear:
            field === 'birth_year'
              ? Number(value)
              : Number(data.childDetails?.birth_year),
          gradeLevel: field === 'grade_level' ? value : (data.gradeLevel ?? ''),
        },
      };
    if (['city', 'region', 'postal_code'].includes(field))
      return {
        section: 'location',
        values: {
          location: {
            countryCode: str('country_code'),
            city: field === 'city' ? value : str('city'),
            region: field === 'region' ? value : str('region'),
            postalCode: field === 'postal_code' ? value : str('postal_code'),
          },
        },
      };
    return {
      section: 'regional',
      values: {
        timezone: field === 'timezone' ? value : str('timezone', 'UTC'),
        locale: field === 'locale' ? value : str('locale', 'en-US'),
        ...(field === 'languages_spoken'
          ? {
              languagesSpoken: value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
            }
          : {}),
      },
    };
  }
  async function save(value: string) {
    if (closed.current) return;
    setBusy(true);
    try {
      if (field === 'mode') setMode(value as ThemeMode);
      else {
        await saveProfileSettings(String(p.id), payload(value));
        await client.invalidateQueries();
        await family.refresh();
      }
      if (!closed.current) onClose();
    } catch (error) {
      Alert.alert(
        'Unable to save',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function review(value: string, display = value) {
    if (locked.current || closed.current || !data.canEdit) return;
    if (
      ['first_name', 'last_name', 'display_name'].includes(field) &&
      (!value.trim() || value.trim().length > 100)
    ) {
      Alert.alert('Check name', 'Enter 1–100 characters.');
      return;
    }
    if (value === initial) {
      close();
      return;
    }
    locked.current = true;
    const unlock = () => {
      locked.current = false;
    };
    Alert.alert(
      `Save ${label.toLowerCase()}?`,
      display.trim() || 'Clear this value?',
      [
        { text: 'Cancel', style: 'cancel', onPress: unlock },
        {
          text: 'Save',
          onPress: () => {
            void save(value);
          },
        },
      ],
      { cancelable: true, onDismiss: unlock },
    );
  }
  if (!data.canEdit) return null;
  if (countryDraft)
    return (
      <Modal
        visible
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={close}
      >
        <SheetContent backgroundColor={colors.pageBg}>
          <ProfileSectionForm
            profile={{
              ...p,
              country_code: countryDraft,
              ...(countryDraft !== initial
                ? { city: '', region: '', postal_code: '' }
                : {}),
            }}
            section="location"
            onClose={onClose}
          />
        </SheetContent>
      </Modal>
    );

  let options: SelectionOption[] | null = null;
  if (field === 'country_code')
    options = PROFILE_COUNTRIES.map((c) => ({ id: c.code, label: c.label }));
  if (field === 'region' && getCountryRegions(str('country_code')).length)
    options = getCountryRegions(str('country_code')).map((r) => ({
      id: r.label,
      label: r.label,
      searchText: [r.code, ...r.aliases].join(' '),
    }));
  if (field === 'birth_year')
    options = Array.from({ length: 121 }, (_, i) => {
      const id = String(new Date().getFullYear() - i);
      return { id, label: id };
    });
  if (field === 'grade_level')
    options = optionsForCountry(normalizeCountryCode(str('country_code'))).map((g) => ({
      id: g.value,
      label: g.label,
    }));
  if (field === 'timezone')
    options = [...new Set([...timezoneIds(), initial])]
      .filter(Boolean)
      .map((id) => timezoneOption(id));
  if (field === 'locale') {
    const names =
      typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames(['en'], { type: 'language' })
        : null;
    options = [
      ...new Set([
        initial,
        'en-US',
        'en-GB',
        'en-AU',
        'en-CA',
        'en-IN',
        'si-LK',
        'ta-LK',
        'ta-IN',
        'hi-IN',
        'ar-AE',
        'fr-FR',
        'de-DE',
        'es-ES',
        'pt-BR',
        'zh-CN',
        'ja-JP',
      ]),
    ]
      .filter(Boolean)
      .map((id) => ({ id, label: names?.of(id) ?? id, searchText: id }));
  }
  if (field === 'mode')
    options = MODE_OPTIONS.map((o) => ({ id: o.value, label: o.label, subtitle: o.sub }));
  if (options)
    return (
      <SearchableSelectionSheet
        visible
        title={`Choose ${label.toLowerCase()}`}
        options={options}
        selectedId={
          field === 'region'
            ? (findCountryRegion(str('country_code'), initial)?.label ?? initial)
            : initial
        }
        preserveOrder={
          field === 'birth_year' || field === 'grade_level' || field === 'mode'
        }
        colors={colors}
        searchPlaceholder="Search"
        closeLabel={`Close ${label} editor`}
        emptyMessage="No matching options"
        onClose={close}
        onSelect={(option) => {
          if (locked.current || busy) return;
          if (field === 'country_code') {
            setCountryDraft(option.id);
          } else review(option.id, option.label);
        }}
      />
    );
  return (
    <Modal
      visible
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={close}
    >
      <SheetContent backgroundColor={colors.pageBg}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingBottom: 16,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${label} editor`}
              disabled={busy}
              onPress={close}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <X size={22} color={colors.text} />
            </Pressable>
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                color: colors.text,
                textAlign: 'center',
                fontSize: 20,
                fontWeight: '600',
              }}
            >
              {label}
            </Text>
            {field !== 'ui_theme_key' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Save ${label}`}
                disabled={busy}
                onPress={() => review(draft)}
                style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.teal }}>{busy ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={profileFieldStyles(colors).content}
          >
            {field === 'ui_theme_key' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {accents.map((theme) => {
                  const accent = profileAvatarColors({
                    themeKey: theme,
                    seed: String(p.id),
                  });
                  return (
                    <Pressable
                      key={theme}
                      accessibilityRole="radio"
                      accessibilityLabel={theme}
                      accessibilityState={{ selected: initial === theme, disabled: busy }}
                      disabled={busy}
                      onPress={() => review(theme)}
                      style={{ width: 76, alignItems: 'center', gap: 6 }}
                    >
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor: accent.bg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: initial === theme ? colors.teal : 'transparent',
                        }}
                      >
                        <Text
                          style={{ color: accent.fg, fontSize: 26, fontWeight: '800' }}
                        >
                          {str('display_name', 'P')[0]?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: colors.text, textTransform: 'capitalize' }}>
                        {theme}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
                <Text style={profileFieldStyles(colors).label}>{label}</Text>
                <ProfileTextInput
                  accessibilityLabel={label}
                  value={draft}
                  onChangeText={setDraft}
                  editable={!busy}
                  autoFocus
                  autoComplete={
                    field === 'first_name'
                      ? 'given-name'
                      : field === 'last_name'
                        ? 'family-name'
                        : field === 'postal_code'
                          ? 'postal-code'
                          : 'off'
                  }
                  textContentType={field === 'postal_code' ? 'postalCode' : undefined}
                  multiline={field === 'bio'}
                  maxLength={
                    field === 'bio'
                      ? 2000
                      : field === 'languages_spoken'
                        ? 500
                        : field === 'postal_code'
                          ? 32
                          : ['city', 'region'].includes(field)
                            ? 160
                            : 100
                  }
                  autoCapitalize={field === 'postal_code' ? 'characters' : 'words'}
                  autoCorrect={field === 'bio'}
                  placeholder={label}
                  returnKeyType={field === 'bio' ? 'default' : 'done'}
                  onSubmitEditing={field === 'bio' ? undefined : () => review(draft)}
                />
                {field === 'languages_spoken' && (
                  <Text style={{ color: colors.textMuted }}>
                    Separate languages with commas.
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SheetContent>
    </Modal>
  );
}

/** Connect existing settings rows to the same authorized per-item editor. */
export function useProfileItemEditor(id?: string | null) {
  const [field, setField] = useState<ProfileItem | null>(null);
  const query = useQuery({
    queryKey: ['profile-settings', id],
    queryFn: () => fetchProfileSettings(id!),
    enabled: !!id,
  });
  return {
    edit: query.data?.canEdit ? (item: ProfileItem) => setField(item) : undefined,
    editor:
      field && query.data?.canEdit ? (
        <ProfileItemEditor
          key={`${id}:${field}`}
          data={query.data}
          field={field}
          onClose={() => setField(null)}
        />
      ) : null,
  };
}
