import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronDown, MapPin } from 'lucide-react-native';
import { getTimezoneLocationHint } from '@iconicedu/utils';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchableSelectionSheet } from '@iconicedu/ui-native/components/searchable-selection-sheet';
import type { AppColors } from '@/lib/theme';
import { timezoneCity, timezoneIds, timezoneOption } from './timezone-options';

type DetectedLocation = {
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
};
type Props = {
  timezone: string;
  setTimezone: (value: string) => void;
  onLocationDetected?: (location: DetectedLocation) => void;
  onTimezoneSelected?: (timezone: string) => void;
  colors: AppColors;
};

export function TimezoneStep({
  timezone,
  setTimezone,
  onLocationDetected,
  onTimezoneSelected,
  colors,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showPicker, setShowPicker] = useState(false);
  const detectionGeneration = useRef(0);
  const [detecting, setDetecting] = useState(false);
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const options = useMemo(() => {
    const ids = new Set(timezoneIds());
    if (timezone) ids.add(timezone);
    return [...ids].map((id) => timezoneOption(id));
  }, [timezone]);
  const selected = options.find((option) => option.id === timezone);

  const runDetect = useCallback(async () => {
    const generation = ++detectionGeneration.current;
    setDetecting(true);
    setShowPicker(false);
    setCanOpenSettings(false);
    setDetectError(null);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (generation !== detectionGeneration.current) return;
      if (status !== 'granted') {
        setCanOpenSettings(canAskAgain === false);
        setDetectError(
          canAskAgain === false
            ? 'Location access is off. Enable it in Settings, or choose a city in your time zone.'
            : 'Location access is off. Choose a city in your time zone.',
        );
        setShowPicker(true);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });
      if (generation !== detectionGeneration.current) return;
      let geo: Location.LocationGeocodedAddress | undefined;
      try {
        [geo] = await Location.reverseGeocodeAsync(position.coords);
      } catch {
        // Address lookup is optional and must not discard a usable device timezone.
      }
      if (generation !== detectionGeneration.current) return;
      const detected = geo?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!detected) throw new Error('Time zone unavailable');
      setTimezone(detected);
      if (!geo)
        setDetectError(
          'Time zone detected. Address details are unavailable; you can enter them on the next step.',
        );
      onLocationDetected?.({
        city: geo?.city ?? '',
        region: geo?.region ?? '',
        postalCode: geo?.postalCode ?? '',
        countryCode: geo?.isoCountryCode ?? '',
      });
    } catch {
      if (generation !== detectionGeneration.current) return;
      let deviceTimezone: string | undefined;
      try {
        deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        /* Manual selection remains available. */
      }
      if (deviceTimezone) {
        setTimezone(deviceTimezone);
        setDetectError(
          'Using your device time zone. Current location is unavailable; you can enter your address on the next step.',
        );
      } else {
        setDetectError('Location unavailable. Choose a city in your time zone.');
        setShowPicker(true);
      }
    } finally {
      if (generation === detectionGeneration.current) setDetecting(false);
    }
  }, [setTimezone, onLocationDetected]);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const generation = detectionGeneration.current;
    void (async () => {
      try {
        const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
        if (generation !== detectionGeneration.current) return;
        if (status === 'denied') {
          setCanOpenSettings(canAskAgain === false);
          setDetectError(
            canAskAgain === false
              ? 'Location access is off. Enable it in Settings, or choose a city in your time zone.'
              : 'Location access is off. Choose a city in your time zone.',
          );
          setShowPicker(true);
        } else if (
          status === 'granted' &&
          (!timezone ||
            timezone === 'UTC' ||
            timezone === Intl.DateTimeFormat().resolvedOptions().timeZone)
        ) {
          void runDetect();
        }
      } catch {
        /* Manual selection remains available. */
      }
    })();
  }, [runDetect, timezone]);

  return (
    <View style={styles.container}>
      {showPicker && (
        <SearchableSelectionSheet
          visible
          options={options}
          selectedId={timezone}
          colors={colors}
          bottomInset={insets.bottom}
          title="Choose time zone"
          searchPlaceholder="Search city or time zone"
          closeLabel="Close time zone picker"
          emptyMessage="No time zones found. Try a nearby city or region."
          onClose={() => setShowPicker(false)}
          onSelect={(option) => {
            detectionGeneration.current += 1;
            setDetecting(false);
            setTimezone(option.id);
            if (onTimezoneSelected) onTimezoneSelected(option.id);
            else {
              const hint = getTimezoneLocationHint(option.id);
              if (hint) onLocationDetected?.({ ...hint, region: '', postalCode: '' });
            }
            setShowPicker(false);
          }}
        />
      )}
      <Text style={[styles.label, { color: colors.textMuted }]}>Time zone</Text>
      <Pressable
        testID="onboarding-timezone-select"
        accessibilityRole="button"
        accessibilityLabel={`Time zone: ${timezone ? timezoneCity(timezone) : 'Choose city'}. Change time zone`}
        accessibilityState={{ expanded: showPicker }}
        onPress={() => {
          Keyboard.dismiss();
          setShowPicker(true);
        }}
        style={[
          styles.selector,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
      >
        <View style={styles.selected}>
          <Text style={[styles.city, { color: colors.text }]}>
            {selected?.label ?? 'Choose city'}
          </Text>
          {!!selected && (
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              {[selected.subtitle, selected.detail].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {detectError ?? 'Choose your city or a nearby city in the same time zone.'}
      </Text>
      {canOpenSettings && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open location settings"
          onPress={() => void Linking.openSettings()}
          style={styles.detect}
        >
          <Text style={[styles.detectLabel, { color: colors.action }]}>
            Open location settings
          </Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        disabled={detecting}
        accessibilityState={{ disabled: detecting, busy: detecting }}
        onPress={runDetect}
        style={[styles.detect, { backgroundColor: colors.actionSubtle }]}
      >
        {detecting ? (
          <ActivityIndicator color={colors.action} />
        ) : (
          <>
            <MapPin size={20} color={colors.action} />
            <Text style={[styles.detectLabel, { color: colors.action }]}>
              Use my current location
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  label: { fontSize: 15, fontWeight: '500' },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 60,
    gap: 12,
  },
  selected: { flex: 1, gap: 4 },
  city: { fontSize: 17 },
  detail: { fontSize: 14 },
  hint: { fontSize: 14, lineHeight: 20 },
  detect: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 16,
    minHeight: 52,
  },
  detectLabel: { fontSize: 16, fontWeight: '600' },
});
