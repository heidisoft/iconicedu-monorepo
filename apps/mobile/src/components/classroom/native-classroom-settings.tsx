import React from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import {
  X,
  Mic,
  Video,
  SlidersHorizontal,
  Check,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
export function NativeClassroomSettings({
  open,
  tab,
  onTab,
  onClose,
  audio,
  video,
  error,
  meeting,
}: {
  open: boolean;
  tab: 'audio' | 'video' | 'meeting';
  onTab: (tab: 'audio' | 'video' | 'meeting') => void;
  onClose: () => void;
  audio: React.ReactNode;
  video: React.ReactNode;
  error?: string | null;
  meeting?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            paddingHorizontal: 12,
            paddingTop: 12,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss settings"
            onPress={onClose}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          />
          <View
            accessibilityViewIsModal
            style={{
              alignSelf: 'center',
              width: '100%',
              maxWidth: 480,
              maxHeight: '70%',
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 12,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                accessibilityRole="header"
                style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}
              >
                Settings
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                onPress={onClose}
                style={{ padding: 12 }}
              >
                <X size={20} color={colors.text} />
              </Pressable>
            </View>
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: 'row',
                backgroundColor: colors.actionSubtle,
                borderRadius: 12,
                padding: 4,
              }}
            >
              {(meeting
                ? (['audio', 'video', 'meeting'] as const)
                : (['audio', 'video'] as const)
              ).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityLabel={`${value === 'audio' ? 'Audio' : value === 'video' ? 'Video' : 'Meeting'} settings tab`}
                  accessibilityState={{ selected: value === tab }}
                  onPress={() => onTab(value)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: value === tab ? colors.card : undefined,
                  }}
                >
                  {React.createElement(
                    value === 'audio'
                      ? Mic
                      : value === 'video'
                        ? Video
                        : SlidersHorizontal,
                    { size: 16, color: colors.text },
                  )}
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                    {value === 'audio'
                      ? 'Audio'
                      : value === 'video'
                        ? 'Video'
                        : 'Meeting'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            >
              {error && (
                <Text accessibilityRole="alert" style={{ color: colors.red }}>
                  {error}
                </Text>
              )}
              {tab === 'audio' ? audio : tab === 'video' ? video : meeting}
            </ScrollView>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** Compact classroom preference row, shared by the audio and video sections. */
export function ClassroomSettingRow({
  label,
  accessibilityLabel,
  testID,
  value,
  icon: Icon,
  selected,
  checked,
  onPress,
  onChange,
  disabled = false,
}: {
  label: string;
  accessibilityLabel?: string;
  testID?: string;
  value?: string;
  icon: LucideIcon;
  selected?: boolean;
  checked?: boolean;
  onPress?: () => void;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      <Icon size={18} color={colors.textMuted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
        {value && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{value}</Text>}
      </View>
      {onChange ? (
        <Switch
          accessibilityLabel={label}
          value={checked}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: colors.action }}
        />
      ) : selected ? (
        <Check size={18} color={colors.action} />
      ) : null}
    </>
  );
  const style = {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: selected ? colors.actionSubtle : colors.card,
    opacity: disabled ? 0.5 : 1,
  };
  return onPress ? (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : { checked: selected }),
      }}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
