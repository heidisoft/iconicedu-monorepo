import React, { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  findNodeHandle,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ChevronDown, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import { NativeClassroomError } from './native-classroom-error';
import type { NativeMediaDevice } from '@/lib/classroom/meeting-controller';

function deviceLabel(device: NativeMediaDevice) {
  return device.label === 'MicrophoneBuiltIn' ? 'Built-in audio' : device.label;
}

/** The SDK owns selection; the operating system owns the device-choice popup. */
export function NativeSettingDeviceSelect({
  label,
  icon: Icon,
  devices,
  onSelect,
}: {
  label: string;
  icon: LucideIcon;
  devices: NativeMediaDevice[];
  onSelect: (id: string) => Promise<void>;
}) {
  const { colors, isDark } = useTheme();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const trigger = useRef<View>(null);
  const picker = useRef<Picker<string>>(null);
  const sheetOpen = useRef(false);
  const currentDevices = useRef(devices);
  currentDevices.current = devices;
  const [error, setError] = useState<string | null>(null);
  const selected = devices.find((device) => device.selected);
  const disabled = pending || devices.length === 0;
  useEffect(
    () => () => {
      if (sheetOpen.current) ActionSheetIOS.dismissActionSheet();
    },
    [],
  );
  const choose = (id: string) => {
    if (
      busy.current ||
      currentDevices.current.find((device) => device.id === id)?.selected
    )
      return;
    if (!currentDevices.current.some((device) => device.id === id)) {
      setError('This device disconnected. Choose another device.');
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        await onSelect(id);
      } catch {
        setError(
          `Unable to change ${label.toLowerCase()}. Reconnect the device and try again.`,
        );
      } finally {
        busy.current = false;
        setPending(false);
      }
    })();
  };
  const open = () => {
    if (disabled || busy.current || sheetOpen.current) return;
    if (Platform.OS === 'android') {
      picker.current?.focus();
      return;
    }
    const choices = [...devices];
    sheetOpen.current = true;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: label,
        options: [
          ...choices.map(
            (device) => `${deviceLabel(device)}${device.selected ? ' (Current)' : ''}`,
          ),
          'Cancel',
        ],
        cancelButtonIndex: choices.length,
        anchor: findNodeHandle(trigger.current) ?? undefined,
        userInterfaceStyle: isDark ? 'dark' : 'light',
      },
      (index) => {
        sheetOpen.current = false;
        if (index >= 0 && index < choices.length) choose(choices[index].id);
      },
    );
  };
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
          paddingHorizontal: 10,
        }}
      >
        {label}
      </Text>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? deviceLabel(selected) : 'System default'}`}
        accessibilityHint="Show available devices"
        accessibilityState={{ disabled, busy: pending }}
        disabled={disabled}
        onPress={open}
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Icon size={18} color={colors.textMuted} />
        <Text style={{ flex: 1, color: colors.text }}>
          {selected ? deviceLabel(selected) : 'System default'}
        </Text>
        {pending ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <ChevronDown size={18} color={colors.textMuted} />
        )}
      </Pressable>
      {Platform.OS === 'android' && (
        <Picker
          ref={picker}
          mode="dialog"
          prompt={label}
          enabled={!disabled}
          selectedValue={selected?.id ?? ''}
          onValueChange={(id) => {
            if (id) choose(id);
          }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        >
          {!selected && <Picker.Item label="System default" value="" enabled={false} />}
          {devices.map((device) => (
            <Picker.Item key={device.id} label={deviceLabel(device)} value={device.id} />
          ))}
        </Picker>
      )}
      {devices.length === 0 && (
        <Text style={{ paddingHorizontal: 10, color: colors.textMuted }}>
          No selectable devices. Your device is using its system default.
        </Text>
      )}
      {error && <NativeClassroomError message={error} />}
    </View>
  );
}
