import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  type ViewStyle,
} from 'react-native';
import { Video, Clock3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/theme-provider';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ClassSession = {
  id: string;
  label: string;
  time: string;
  dayName: string;
  dayNum: string;
  isToday: boolean;
  /** True while startAt <= now <= endAt — mirrors web isEventLive() */
  isLive: boolean;
  isPast: boolean;
  status: ClassScheduleVM['status'];
  meetingLink?: string | null;
  /** Source channel ID — used to navigate to the class */
  channelId?: string | null;
  /** Child participants with optional theme color */
  students?: { name: string; themeKey?: string | null }[];
  variant: 'default' | 'exception' | 'override';
  disabled: boolean;
  reason?: string | null;
  originalTime?: string | null;
  originalDate?: string | null;
  startAt: string;
  endAt: string;
};

// ─── Format helpers ─────────────────────────────────────────────────────────────

export function formatWeekTitle(startAt: string): string {
  const start = new Date(startAt);
  const weekNumber = Math.min(5, Math.floor((start.getDate() - 1) / 7) + 1);
  const month = start.toLocaleDateString('en-US', { month: 'short' });
  return `${month} · Week ${weekNumber}`;
}

export function formatTimeBadge(startAt: string): string {
  return new Date(startAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatOriginalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatOriginalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Theme color helper ─────────────────────────────────────────────────────────

const THEME_COLORS: Record<string, string> = {
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#ca8a04',
  lime: '#65a30d',
  green: '#16a34a',
  emerald: '#059669',
  teal: '#0d9488',
  cyan: '#0891b2',
  sky: '#0284c7',
  blue: '#2563eb',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  purple: '#9333ea',
  fuchsia: '#c026d3',
  pink: '#db2777',
  rose: '#e11d48',
};

function themeKeyColor(themeKey?: string | null, fallback?: string): string {
  return (themeKey && THEME_COLORS[themeKey]) || fallback || '#64748b';
}

// ─── SessionCard ────────────────────────────────────────────────────────────────

const hairline = StyleSheet.hairlineWidth;

export function SessionCard({
  session,
  style,
}: {
  session: ClassSession;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  const { isLive, isPast } = session;
  const isDisabled = session.disabled;

  const badgeBg = isDisabled
    ? colors.inputBg
    : isLive
      ? colors.teal
      : isPast
        ? colors.inputBg
        : colors.card;
  const badgeTxt = isLive
    ? '#fff'
    : isPast || isDisabled
      ? colors.textMuted
      : colors.text;

  const cardBorderColor = isLive ? colors.teal : colors.border;
  const cardBorderWidth = isLive ? 1.5 : hairline;
  const cardBg = isLive ? colors.tealBg : isPast ? colors.inputBg : colors.card;

  const handlePress = session.channelId
    ? () =>
        router.push({
          pathname: '/(app)/spaces/[channelId]',
          params: { channelId: session.channelId!, tab: 'sessions' },
        } as never)
    : undefined;

  return (
    <TouchableOpacity
      style={[
        s.sessionCard,
        {
          backgroundColor: cardBg,
          borderColor: cardBorderColor,
          borderWidth: cardBorderWidth,
        },
        isPast && s.sessionCardPast,
        style,
      ]}
      onPress={handlePress}
      disabled={!session.channelId}
      activeOpacity={0.75}
    >
      {/* Day badge */}
      <View style={[s.sessionDayBadge, { backgroundColor: badgeBg }]}>
        {isLive && <Text style={[s.sessionDayExtra, { color: '#fff' }]}>Today</Text>}
        <Text style={[s.sessionDayName, { color: badgeTxt }]}>{session.dayName}</Text>
        <Text style={[s.sessionDayNum, { color: badgeTxt }]}>{session.dayNum}</Text>
      </View>

      {/* Info */}
      <View style={s.sessionInfo}>
        <View style={s.sessionTitleRow}>
          <Text
            style={[
              s.sessionLabel,
              { color: colors.text },
              (isDisabled || isPast) && { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {session.label}
          </Text>
          {isLive && (
            <View style={[s.liveBadge, { backgroundColor: colors.teal }]}>
              <Text style={s.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {session.variant === 'exception' && (
            <View style={[s.variantBadge, { backgroundColor: colors.inputBg }]}>
              <Text style={[s.variantBadgeText, { color: colors.textMuted }]}>
                Skipped
              </Text>
            </View>
          )}
          {session.variant === 'override' && (
            <View
              style={[
                s.variantBadge,
                s.variantBadgeOutline,
                { borderColor: colors.border },
              ]}
            >
              <Text style={[s.variantBadgeText, { color: colors.textMuted }]}>
                Changed
              </Text>
            </View>
          )}
          {isPast && session.variant !== 'exception' && (
            <View style={[s.variantBadge, { backgroundColor: colors.inputBg }]}>
              <Text style={[s.variantBadgeText, { color: colors.textMuted }]}>
                Completed
              </Text>
            </View>
          )}
        </View>

        <View style={s.sessionTimeRow}>
          <Clock3 size={11} color={colors.textMuted} />
          <Text style={[s.sessionTimeTxt, { color: colors.textMuted }]}>
            {session.time}
          </Text>
          {session.students && session.students.length > 0 && (
            <>
              <Text style={[s.sessionTimeTxt, { color: colors.textFaint }]}>·</Text>
              <Text style={s.sessionTimeTxt} numberOfLines={1}>
                {session.students.map((student, i) => (
                  <Text key={student.name + i}>
                    {i > 0 && <Text style={{ color: colors.textFaint }}>, </Text>}
                    <Text
                      style={{ color: themeKeyColor(student.themeKey, colors.textMuted) }}
                    >
                      {student.name}
                    </Text>
                  </Text>
                ))}
              </Text>
            </>
          )}
        </View>

        {session.variant === 'override' && session.originalTime && (
          <Text style={[s.sessionOriginalTimeTxt, { color: colors.textMuted }]}>
            Was {session.originalDate ? `${session.originalDate} ` : ''}
            <Text style={s.sessionOriginalTimeStrike}>{session.originalTime}</Text>
          </Text>
        )}

        {session.variant === 'exception' && session.reason && (
          <Text style={[s.sessionReasonTxt, { color: colors.textMuted }]}>
            {session.reason}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={s.sessionActions}>
        {!isPast && !isDisabled ? (
          <TouchableOpacity
            style={[
              s.joinBtn,
              isLive
                ? { backgroundColor: colors.teal }
                : { backgroundColor: colors.tealBg },
            ]}
            onPress={
              session.meetingLink
                ? () => void Linking.openURL(session.meetingLink!)
                : undefined
            }
            disabled={!session.meetingLink}
            activeOpacity={0.7}
          >
            <Video size={11} color={isLive ? '#fff' : colors.teal} />
            <Text style={[s.joinBtnTxt, { color: isLive ? '#fff' : colors.teal }]}>
              {isLive ? 'Join Now' : 'Join'}
            </Text>
          </TouchableOpacity>
        ) : isDisabled ? (
          <View style={[s.joinBtn, { backgroundColor: colors.inputBg, opacity: 0.5 }]}>
            <Video size={11} color={colors.textMuted} />
            <Text style={[s.joinBtnTxt, { color: colors.textMuted }]}>Unavailable</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.joinBtn, { backgroundColor: colors.inputBg }]}
            activeOpacity={0.7}
          >
            <Video size={11} color={colors.textMuted} />
            <Text style={[s.joinBtnTxt, { color: colors.textMuted }]}>Recording</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sessionCardPast: {
    opacity: 0.85,
  },
  sessionDayBadge: {
    minWidth: 44,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionDayExtra: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sessionDayName: {
    fontSize: 10,
    fontWeight: '600',
  },
  sessionDayNum: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sessionInfo: {
    flex: 1,
    gap: 3,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  sessionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  sessionTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sessionTimeTxt: {
    fontSize: 11,
  },
  sessionOriginalTimeTxt: {
    fontSize: 11,
  },
  sessionOriginalTimeStrike: {
    textDecorationLine: 'line-through',
  },
  sessionReasonTxt: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  liveBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  variantBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  variantBadgeOutline: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
  },
  variantBadgeText: {
    fontSize: 9,
    fontWeight: '500',
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },
  joinBtnTxt: {
    fontSize: 11,
    fontWeight: '600',
  },
  calBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
});
