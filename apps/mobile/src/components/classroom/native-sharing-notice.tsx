import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MonitorUp, Presentation, Square } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** Keep the outbound share and its stop action visible, including expanded boards. */
export function NativeSharingNotice({
  whiteboard,
  onStop,
}: {
  whiteboard: boolean;
  onStop: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const Icon = whiteboard ? Presentation : MonitorUp;
  const stop = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await onStop();
    } catch {
      setError('Unable to stop sharing. Please retry.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <View
      style={{
        backgroundColor: colors.actionSubtle,
        borderRadius: 16,
        padding: 8,
        gap: 4,
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
      >
        <Icon size={20} color={colors.text} />
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, flex: 1, minWidth: 120 }}
        >
          {whiteboard ? 'You are sharing the whiteboard' : 'You are sharing your screen'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            whiteboard ? 'Stop whiteboard sharing' : 'Stop screen sharing'
          }
          accessibilityState={{ disabled: pending }}
          disabled={pending}
          onPress={() => {
            void stop();
          }}
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Square size={18} color={colors.text} />
          <Text style={{ color: colors.text }}>
            {pending ? 'Stopping…' : 'Stop sharing'}
          </Text>
        </Pressable>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {error}
        </Text>
      )}
    </View>
  );
}
