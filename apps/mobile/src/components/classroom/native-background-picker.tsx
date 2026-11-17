import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Blend, Check, CircleOff, ImagePlus } from 'lucide-react-native';
import type { MeetingBackgroundPreset } from '@iconicedu/utils';
import { BACKGROUND_PHOTOS } from '@/lib/classroom/background-catalog';
import { useTheme } from '@/providers/theme-provider';

export function NativeBackgroundPicker({
  value,
  preview,
  onSelect,
  onUpload,
}: {
  value: MeetingBackgroundPreset;
  preview: boolean;
  onSelect: (value: MeetingBackgroundPreset) => void;
  onUpload: () => void;
}) {
  const { colors } = useTheme();
  const [columns, setColumns] = useState(4);
  const choices = [
    {
      value: 'none' as const,
      label: 'None',
      accessibleLabel: 'No background effect',
      icon: CircleOff,
      source: undefined,
    },
    {
      value: 'blur' as const,
      label: 'Blur',
      accessibleLabel: 'Blur background',
      icon: Blend,
      source: undefined,
    },
    ...BACKGROUND_PHOTOS.map((photo) => ({
      ...photo,
      accessibleLabel: `Background photo: ${photo.label}`,
      icon: undefined,
    })),
  ];
  const rows = Array.from({ length: Math.ceil(choices.length / columns) }, (_, row) =>
    choices.slice(row * columns, (row + 1) * columns),
  );
  return (
    <View
      style={{ gap: 12, paddingTop: 8 }}
      onLayout={({ nativeEvent }) => setColumns(nativeEvent.layout.width < 320 ? 2 : 4)}
    >
      <View style={{ gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}
        >
          Background
        </Text>
        {preview && (
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
            Your background is applied when you join the class.
          </Text>
        )}
      </View>
      <View accessibilityLabel="Backgrounds" style={{ gap: 12 }}>
        {rows.map((row, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: 10 }}>
            {row.map((choice) => {
              const selected = value === choice.value;
              const Icon = choice.icon;
              return (
                <Pressable
                  key={choice.value}
                  accessibilityRole="button"
                  accessibilityLabel={choice.accessibleLabel}
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(choice.value)}
                  style={{ flex: 1, minHeight: 44, gap: 6 }}
                >
                  <View
                    style={{
                      aspectRatio: 1.3,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: selected ? colors.action : colors.border,
                      backgroundColor: colors.actionSubtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {choice.source ? (
                      <Image
                        source={choice.source}
                        resizeMode="cover"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      Icon && <Icon size={26} color={colors.textMuted} />
                    )}
                    {selected && (
                      <View
                        style={{
                          position: 'absolute',
                          right: 4,
                          top: 4,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: colors.action,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={13} color={colors.actionForeground} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      color: selected ? colors.text : colors.textMuted,
                      textAlign: 'center',
                      fontSize: 12,
                      lineHeight: 16,
                      fontWeight: selected ? '600' : '400',
                    }}
                  >
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
            {Array.from({ length: columns - row.length }, (_, spacer) => (
              <View key={`spacer-${spacer}`} style={{ flex: 1 }} />
            ))}
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose background image"
        onPress={onUpload}
        style={{
          minHeight: 44,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <ImagePlus size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 14, flexShrink: 1 }}>
          Upload a photo
        </Text>
      </Pressable>
    </View>
  );
}
