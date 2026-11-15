import React from 'react';
import { View, Text, TouchableOpacity, Share } from 'react-native';

export function MeetingPasscode({
  passcode,
  color,
  mutedColor,
}: {
  passcode?: string | null;
  color: string;
  mutedColor: string;
}) {
  if (!passcode) return null;
  return (
    <View style={{ gap: 8, paddingVertical: 12 }}>
      <Text style={{ color: mutedColor }}>Session passcode</Text>
      <Text selectable style={{ color }}>
        {passcode}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Share passcode"
        onPress={() => {
          void Share.share({ message: passcode }).catch(() => undefined);
        }}
      >
        <Text style={{ color }}>Share passcode</Text>
      </TouchableOpacity>
    </View>
  );
}
