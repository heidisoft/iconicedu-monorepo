import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchableSelectionSheet } from '@iconicedu/ui-native/components/searchable-selection-sheet';
import { timezoneIds, timezoneOption } from '@/components/auth/timezone-options';
import { useTheme } from '@/providers/theme-provider';
import { profileFieldStyles } from './profile-text-input';
import { ProfileTextField } from './profile-field-editor';

export function RegionalFields({
  timezone,
  locale,
  setTimezone,
  setLocale,
  disabled,
  languages,
  setLanguages,
}: {
  timezone: string;
  locale: string;
  setTimezone: (value: string) => void;
  setLocale: (value: string) => void;
  disabled: boolean;
  languages: string;
  setLanguages: (value: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [picker, setPicker] = useState<'timezone' | 'locale' | null>(null);
  const zones = useMemo(
    () =>
      [...new Set([...timezoneIds(), timezone])]
        .filter(Boolean)
        .map((id) => timezoneOption(id)),
    [timezone],
  );
  const locales = useMemo(() => {
    const names =
      typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames(['en'], { type: 'language' })
        : null;
    return [
      ...new Set([
        locale,
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
      .map((code) => ({ id: code, label: names?.of(code) ?? code, searchText: code }));
  }, [locale]);
  return (
    <View style={{ gap: 20 }}>
      {(['timezone', 'locale'] as const).map((key) => {
        const label = key === 'timezone' ? 'Time Zone' : 'Language / Region';
        const selected =
          key === 'timezone'
            ? zones.find((zone) => zone.id === timezone)?.label
            : locales.find((item) => item.id === locale)?.label;
        return (
          <View key={key} style={{ gap: 8 }}>
            <Text style={profileFieldStyles(colors).label}>{label}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose ${label}`}
              accessibilityState={{ disabled, expanded: picker === key }}
              accessibilityValue={{
                text:
                  selected ??
                  (key === 'timezone' ? 'Select time zone' : 'Select language / region'),
              }}
              disabled={disabled}
              onPress={() => {
                Keyboard.dismiss();
                setPicker(key);
              }}
              style={{
                ...profileFieldStyles(colors).selector,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  color: selected ? colors.text : colors.textMuted,
                  flex: 1,
                  fontSize: 17,
                }}
              >
                {selected ??
                  (key === 'timezone' ? 'Select time zone' : 'Select language / region')}
              </Text>
              <ChevronDown size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        );
      })}
      <ProfileTextField
        label="Languages spoken"
        value={languages}
        onChange={setLanguages}
        disabled={disabled}
        placeholder="English, Sinhala"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={500}
        hint="Separate languages with commas."
      />
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        These preferences apply to your profile. They do not change the app’s display
        language.
      </Text>
      {picker && (
        <SearchableSelectionSheet
          visible
          title={picker === 'timezone' ? 'Choose time zone' : 'Choose language / region'}
          options={picker === 'timezone' ? zones : locales}
          selectedId={picker === 'timezone' ? timezone : locale}
          onSelect={(option) => {
            if (picker === 'timezone') setTimezone(option.id);
            else setLocale(option.id);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
          colors={colors}
          bottomInset={insets.bottom}
          emptyMessage="No matching options"
          searchPlaceholder="Search"
          closeLabel="Close regional picker"
        />
      )}
    </View>
  );
}
