import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

type ConversationHeaderProps = {
  title: string;
  kind: 'dm' | 'channel' | 'space';
  memberCount?: number;
  onBack: () => void;
  onInfo?: () => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.bg,
      gap: 4,
    },
    backBtn: {
      width: 44, height: 44,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 22,
    },
    backArrow: { fontSize: 22, color: C.teal },

    center: { flex: 1, alignItems: 'center', gap: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    prefix:   { fontSize: 17, color: C.textMuted },
    title:    { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
    subtitle: { fontSize: 12, color: C.textMuted },

    actionBtn: {
      width: 40, height: 40,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 20,
    },
    actionIcon: { fontSize: 18, color: C.textMuted },
  });
}

export function ConversationHeader({
  title,
  kind,
  memberCount,
  onBack,
  onInfo,
}: ConversationHeaderProps) {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const prefix = kind === 'channel' ? '#' : kind === 'space' ? '🚀' : null;

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={8}>
        <Text style={s.backArrow}>‹</Text>
      </TouchableOpacity>

      <View style={s.center}>
        <View style={s.titleRow}>
          {!!prefix && <Text style={s.prefix}>{prefix}</Text>}
          <Text style={s.title} numberOfLines={1}>{title}</Text>
        </View>
        {memberCount != null && (
          <Text style={s.subtitle}>{memberCount} Member{memberCount !== 1 ? 's' : ''}</Text>
        )}
      </View>

      {onInfo ? (
        <TouchableOpacity style={s.actionBtn} onPress={onInfo} hitSlop={8}>
          <Text style={s.actionIcon}>ⓘ</Text>
        </TouchableOpacity>
      ) : (
        // Spacer to keep title centered
        <View style={s.actionBtn} />
      )}
    </View>
  );
}
