import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LifeBuoy } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function getSupportPalette(C: AppColors) {
  const isDark = C.bg === C.pageBg && C.text === '#FFFFFF';
  return {
    bg: isDark ? '#f59e0b22' : '#fff7ed',
    border: isDark ? '#f59e0b55' : '#fdba74',
    text: isDark ? '#fbbf24' : '#c2410c',
  };
}

function makeStyles(C: AppColors) {
  const supportPalette = getSupportPalette(C);

  return StyleSheet.create({
    card: {
      overflow: 'hidden',
      borderRadius: 24,
      backgroundColor: 'transparent',
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 14,
      justifyContent: 'center',
    },
    patternRing: {
      position: 'absolute',
      top: 10,
      right: 24,
      width: 72,
      height: 72,
      borderRadius: 999,
      borderWidth: 14,
      borderColor: C.teal + '33',
    },
    patternCluster: {
      position: 'absolute',
      top: 18,
      left: 20,
      width: 72,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    patternCircle: {
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: C.teal + '1f',
    },
    patternCircleMuted: {
      backgroundColor: C.textFaint + '14',
    },
    patternCircleSoft: {
      backgroundColor: C.teal + '12',
    },
    patternDiamond: {
      position: 'absolute',
      right: 82,
      bottom: 14,
      width: 28,
      height: 28,
      transform: [{ rotate: '45deg' }],
      borderWidth: 6,
      borderColor: '#f59e0b22',
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 10,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    ctaRow: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    supportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 14,
      height: 38,
      borderRadius: 999,
      backgroundColor: supportPalette.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: supportPalette.border,
    },
    supportBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: supportPalette.text,
    },
  });
}

export function SupportFooter({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const supportPalette = React.useMemo(() => getSupportPalette(colors), [colors]);

  return (
    <View style={s.card}>
      <View pointerEvents="none" style={s.patternRing} />
      <View pointerEvents="none" style={s.patternCluster}>
        <View style={s.patternCircle} />
        <View style={[s.patternCircle, s.patternCircleSoft]} />
        <View style={[s.patternCircle, s.patternCircleMuted]} />
        <View style={[s.patternCircle, s.patternCircleSoft]} />
      </View>
      <View pointerEvents="none" style={s.patternDiamond} />

      <View style={s.eyebrowRow}>
        <Text style={s.eyebrow}>Need help?</Text>
      </View>

      {onPress ? (
        <View style={s.ctaRow}>
          <TouchableOpacity
            style={s.supportBtn}
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityLabel="Open live support"
          >
            <LifeBuoy size={16} color={supportPalette.text} />
            <Text style={s.supportBtnText}>Live Support</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
