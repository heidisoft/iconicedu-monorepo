import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:       { flex: 1, backgroundColor: C.bg },
    header:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    title:      { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
    iconWrap:   { width: 80, height: 80, borderRadius: 40, backgroundColor: C.inputBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    emptyDesc:  { fontSize: 14, color: C.textMuted, textAlign: 'center', paddingHorizontal: 40, lineHeight: 21 },
  });
}

export default function InboxScreen() {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Inbox</Text>
      </View>
      <View style={s.center}>
        <View style={s.iconWrap}>
          <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 8C18 6.4 17.37 4.87 16.24 3.76C15.13 2.63 13.6 2 12 2C10.4 2 8.87 2.63 7.76 3.76C6.63 4.87 6 6.4 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
              stroke={colors.textFaint}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M13.73 21C13.55 21.3 13.3 21.55 13 21.72C12.7 21.89 12.35 21.97 12 21.97C11.65 21.97 11.3 21.89 11 21.72C10.7 21.55 10.45 21.3 10.27 21"
              stroke={colors.textFaint}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <Text style={s.emptyTitle}>All caught up</Text>
        <Text style={s.emptyDesc}>Notifications and activity will appear here.</Text>
      </View>
    </SafeAreaView>
  );
}
