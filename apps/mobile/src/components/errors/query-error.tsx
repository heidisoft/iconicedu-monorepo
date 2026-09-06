import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function QueryError({
  message = 'Could not load data. Check your connection and try again.',
  onRetry,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: colors.inputBg }]}>
        <WifiOff size={28} color={colors.textFaint} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Unable to connect</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.action }]}
          onPress={onRetry}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnTxt, { color: colors.actionForeground }]}>
            Try again
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  btnTxt: { fontSize: 15, fontWeight: '700' },
});
