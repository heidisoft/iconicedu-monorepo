import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

// ─── AI-assist badge (issue #264) ──────────────────────────────────────────
//
// A small, unmistakable label used anywhere AI-generated or AI-modified text
// is shown — on the "Refine with AI" trigger, in the refine preview, and on
// the suggested-replies section — so refined/suggested text never looks
// indistinguishable from what the user typed until they explicitly accept it.

type AiBadgeProps = {
  label?: string;
};

function makeStyles(colors: { tealBg: string; teal: string }) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: colors.tealBg,
      alignSelf: 'flex-start',
    },
    text: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: colors.teal,
    },
  });
}

export const AiBadge: React.FC<AiBadgeProps> = ({ label = 'AI' }) => {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.badge} accessibilityLabel={`${label}-generated content`}>
      <Sparkles size={10} color={colors.teal} />
      <Text style={s.text}>{label}</Text>
    </View>
  );
};
