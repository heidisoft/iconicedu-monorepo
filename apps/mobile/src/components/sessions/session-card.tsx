import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Modal,
  Pressable,
  Share,
  type ViewStyle,
} from 'react-native';
import {
  Video,
  Clock3,
  Share2,
  X,
  Presentation,
  ShieldUser,
  User,
  BriefcaseBusiness,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { usePushConsent } from '@/providers/push-consent-provider';
import { fetchSpaceChannelMetaByChannelId } from '@/lib/api/queries';
import {
  MESSAGE_TITLE_FONT_SIZE,
  MESSAGE_TITLE_FONT_WEIGHT,
} from '@/lib/message-title-typography';
import type { ClassScheduleVM, ParticipantRoleVM } from '@iconicedu/shared-types';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ClassSession = {
  id: string;
  scheduleId?: string;
  recurrenceId?: string | null;
  occurrenceKey?: string | null;
  canCancel?: boolean;
  label: string;
  time: string;
  participantLabel?: string | null;
  participants?: Array<{
    name: string;
    kind: Extract<ParticipantRoleVM, 'educator' | 'guardian' | 'child' | 'staff'>;
    themeKey?: string | null;
  }>;
  dayName: string;
  dayNum: string;
  isToday: boolean;
  /** True while startAt <= now <= endAt — mirrors web isEventLive() */
  isLive: boolean;
  isPast: boolean;
  status: ClassScheduleVM['status'];
  meetingLink?: string | null;
  /** Classroom accent selected in learning-space settings. */
  themeKey?: string | null;
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
  const firstDayOfMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const firstWeekdayOffset = firstDayOfMonth.getDay();
  const weekNumber = Math.floor((start.getDate() + firstWeekdayOffset - 1) / 7) + 1;
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

const SESSION_PARTICIPANT_GROUP_ORDER: Array<
  Extract<ParticipantRoleVM, 'educator' | 'guardian' | 'child' | 'staff'>
> = ['educator', 'guardian', 'child', 'staff'];

const SESSION_PARTICIPANT_ICON_MAP: Record<
  Extract<ParticipantRoleVM, 'educator' | 'guardian' | 'child' | 'staff'>,
  typeof Presentation
> = {
  educator: Presentation,
  guardian: ShieldUser,
  child: User,
  staff: BriefcaseBusiness,
};

function themeKeyColor(themeKey?: string | null, fallback?: string): string {
  return themeKey
    ? profileAvatarColors({ themeKey, seed: themeKey }).bg
    : (fallback ?? '#64748b');
}

function buildParticipantGroups(
  participants: NonNullable<ClassSession['participants']>,
): Array<{
  kind: Extract<ParticipantRoleVM, 'educator' | 'guardian' | 'child' | 'staff'>;
  participants: NonNullable<ClassSession['participants']>;
}> {
  return SESSION_PARTICIPANT_GROUP_ORDER.map((kind) => ({
    kind,
    participants: participants.filter((participant) => participant.kind === kind),
  })).filter((group) => group.participants.length > 0);
}

function isExternalJoinHref(joinHref?: string | null): boolean {
  return Boolean(joinHref && /^https?:\/\//i.test(joinHref));
}

function resolveExternalJoinProviderLabel(joinHref?: string | null) {
  if (!joinHref || !isExternalJoinHref(joinHref)) {
    return null;
  }

  try {
    const hostname = new URL(joinHref).hostname.toLowerCase();
    if (hostname.includes('zoom')) return 'Zoom';
    if (hostname.includes('jitsi')) return 'Jitsi';
    if (hostname.includes('meet.google')) return 'Google Meet';
    if (hostname.includes('teams.microsoft')) return 'Microsoft Teams';
  } catch {
    return null;
  }

  return null;
}

function resolveJoinHrefForMobile(joinHref: string): string {
  if (isExternalJoinHref(joinHref)) {
    return joinHref;
  }

  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'http://localhost:3000';

  try {
    return new URL(joinHref, webBaseUrl).toString();
  } catch {
    return joinHref;
  }
}

// ─── SessionCard ────────────────────────────────────────────────────────────────

export function SessionCard({
  session,
  style,
  titleVariant = 'default',
  showJoinButton = true,
  joinEnabled = true,
  pressTarget = 'sessions',
  enableCardPress = true,
  cancelAction,
}: {
  session: ClassSession;
  style?: ViewStyle;
  titleVariant?: 'default' | 'message-list';
  showJoinButton?: boolean;
  joinEnabled?: boolean;
  pressTarget?: 'sessions' | 'messages';
  enableCardPress?: boolean;
  cancelAction?: {
    label?: string;
    onPress: () => void;
    disabled?: boolean;
    accessibilityLabel?: string;
  } | null;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { requestPushConsent } = usePushConsent();
  const router = useRouter();
  const [externalJoinTarget, setExternalJoinTarget] = useState<{
    joinHref: string;
    providerLabel: string | null;
  } | null>(null);
  const [isResolvingJoin, setIsResolvingJoin] = useState(false);

  const { isLive, isPast } = session;
  const isDisabled = session.disabled;
  const participantLabel = session.participantLabel?.trim() || null;
  const students = session.students?.filter((student) => student.name.trim()) ?? [];
  const participants =
    session.participants?.filter((participant) => participant.name.trim()) ?? [];
  const participantGroups = buildParticipantGroups(participants);
  // Date chip — a filled pale-green block by default (matches the theme's tile
  // language); solid primary when live.
  const badgeBg = isLive
    ? colors.primary
    : isPast || isDisabled
      ? colors.card
      : colors.inkSubtle;
  const badgeTxt = isLive
    ? colors.primaryForeground
    : isPast || isDisabled
      ? colors.textMuted
      : colors.text;
  const badgeBorderColor = 'transparent';

  // Card — a clean, soft floating surface. No left accent bar, no border unless live.
  const cardBorderColor = isLive ? colors.primary : 'transparent';
  const cardBorderWidth = isLive ? 1 : 0;
  const cardBg = isLive
    ? colors.primarySubtle
    : isPast || isDisabled
      ? colors.inkSubtle
      : colors.card;

  const handlePress =
    session.channelId && enableCardPress
      ? () =>
          router.push({
            pathname: '/(app)/spaces/[channelId]',
            params: { channelId: session.channelId!, tab: pressTarget },
          } as never)
      : undefined;
  const handleOpenJoinHref = useCallback((joinHref: string) => {
    void Linking.openURL(resolveJoinHrefForMobile(joinHref));
  }, []);
  const handleShareJoinHref = useCallback(async () => {
    if (!externalJoinTarget?.joinHref) return;
    try {
      await Share.share({
        message: externalJoinTarget.joinHref,
        url: externalJoinTarget.joinHref,
      });
    } catch {
      // best effort share
    }
  }, [externalJoinTarget?.joinHref]);
  const handleJoin =
    !isPast && !isDisabled
      ? async () => {
          if (isResolvingJoin) {
            return;
          }

          if (session.meetingLink) {
            if (isExternalJoinHref(session.meetingLink)) {
              setExternalJoinTarget({
                joinHref: session.meetingLink,
                providerLabel: resolveExternalJoinProviderLabel(session.meetingLink),
              });
              return;
            }
            void requestPushConsent();
            handleOpenJoinHref(session.meetingLink);
            return;
          }

          if (session.channelId) {
            setIsResolvingJoin(true);
            try {
              const channelMeta = await fetchSpaceChannelMetaByChannelId(
                session.channelId,
              );
              const joinHref = channelMeta?.liveSession?.joinUrl?.trim() || null;

              if (joinHref) {
                if (isExternalJoinHref(joinHref)) {
                  setExternalJoinTarget({
                    joinHref,
                    providerLabel: resolveExternalJoinProviderLabel(joinHref),
                  });
                  return;
                }

                void requestPushConsent();
                handleOpenJoinHref(joinHref);
                return;
              }
            } catch {
              // Best effort join resolution. Fall back to the classroom if the lookup fails.
            } finally {
              setIsResolvingJoin(false);
            }

            void requestPushConsent();
            router.push({
              pathname: '/(app)/spaces/[channelId]',
              params: { channelId: session.channelId, tab: 'sessions' },
            } as never);
          }
        }
      : undefined;
  const canJoin =
    !isPast && !isDisabled && (!!session.meetingLink || !!session.channelId);
  const joinIsActive = canJoin && joinEnabled && !isResolvingJoin;
  return (
    <>
      <TouchableOpacity
        testID="session-card"
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
        accessibilityRole="button"
        accessibilityLabel="Open session details"
        onPress={handlePress}
        disabled={!session.channelId || !enableCardPress}
        activeOpacity={0.75}
      >
        {/* Day badge */}
        <View
          testID="session-date-block"
          style={[
            s.sessionDayBadge,
            { backgroundColor: badgeBg, borderColor: badgeBorderColor },
          ]}
        >
          {isLive && (
            <Text style={[s.sessionDayExtra, { color: colors.primaryForeground }]}>
              Today
            </Text>
          )}
          <Text style={[s.sessionDayName, { color: badgeTxt }]}>{session.dayName}</Text>
          <Text style={[s.sessionDayNum, { color: badgeTxt }]}>{session.dayNum}</Text>
        </View>

        {/* Info */}
        <View style={s.sessionInfo}>
          <View
            style={[
              s.sessionTitleRow,
              titleVariant === 'message-list' && s.sessionTitleRowMessageList,
            ]}
          >
            <Text
              style={[
                s.sessionLabel,
                titleVariant === 'message-list' && s.sessionLabelMessageList,
                { color: colors.text },
                (isDisabled || isPast) && { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {session.label}
            </Text>
            {isLive && (
              <View style={[s.statusPill, { backgroundColor: colors.primarySubtle }]}>
                <View style={[s.statusDot, { backgroundColor: colors.primary }]} />
                <Text style={[s.statusPillText, { color: colors.primary }]}>Live</Text>
              </View>
            )}
            {(session.status === 'cancelled' || session.variant === 'exception') && (
              <View style={[s.statusPill, { backgroundColor: colors.inkSubtle }]}>
                <Text style={[s.statusPillText, { color: colors.textMuted }]}>
                  Canceled
                </Text>
              </View>
            )}
            {(session.status === 'rescheduled' || session.variant === 'override') && (
              <View style={[s.statusPill, { backgroundColor: colors.inkSubtle }]}>
                <Text style={[s.statusPillText, { color: colors.textMuted }]}>
                  Rescheduled
                </Text>
              </View>
            )}
          </View>

          <View style={s.sessionTimeRow}>
            <Clock3 size={11} color={colors.textMuted} />
            <Text style={[s.sessionTimeTxt, { color: colors.textMuted }]}>
              {session.time}
            </Text>
            {participantGroups.length > 0 ? (
              <>
                <Text style={[s.sessionTimeTxt, { color: colors.textFaint }]}>·</Text>
                <View style={s.sessionParticipantWrap}>
                  {participantGroups.map((group) => {
                    const GroupIcon = SESSION_PARTICIPANT_ICON_MAP[group.kind];

                    return (
                      <View key={group.kind} style={s.sessionParticipantGroup}>
                        <GroupIcon size={12} color={colors.textMuted} strokeWidth={2} />
                        <View style={s.sessionParticipantNames}>
                          {group.participants.map((participant, index) => (
                            <React.Fragment
                              key={`${participant.kind}-${participant.name}`}
                            >
                              {index > 0 ? (
                                <Text
                                  style={[
                                    s.sessionParticipantName,
                                    { color: colors.textFaint },
                                  ]}
                                >
                                  {', '}
                                </Text>
                              ) : null}
                              <Text
                                style={[
                                  s.sessionParticipantName,
                                  participant.kind === 'child'
                                    ? {
                                        color: themeKeyColor(
                                          participant.themeKey,
                                          colors.textMuted,
                                        ),
                                      }
                                    : null,
                                ]}
                              >
                                {participant.name}
                              </Text>
                            </React.Fragment>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : students.length > 0 ? (
              <>
                <Text style={[s.sessionTimeTxt, { color: colors.textFaint }]}>·</Text>
                <Text style={s.sessionTimeTxt} numberOfLines={1}>
                  {students.map((student, i) => (
                    <Text key={student.name + i}>
                      {i > 0 && <Text style={{ color: colors.textFaint }}>, </Text>}
                      <Text
                        style={{
                          color: themeKeyColor(student.themeKey, colors.textMuted),
                        }}
                      >
                        {student.name}
                      </Text>
                    </Text>
                  ))}
                </Text>
              </>
            ) : participantLabel ? (
              <>
                <Text style={[s.sessionTimeTxt, { color: colors.textFaint }]}>·</Text>
                <Text
                  style={[s.sessionTimeTxt, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {participantLabel}
                </Text>
              </>
            ) : null}
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
          {showJoinButton && !isPast && !isDisabled ? (
            <TouchableOpacity
              style={[
                s.joinBtn,
                {
                  backgroundColor: joinIsActive ? colors.action : colors.inputBg,
                  borderColor: joinIsActive ? colors.action : colors.border,
                  opacity: joinIsActive ? 1 : 0.6,
                },
              ]}
              onPress={handleJoin}
              disabled={!joinIsActive}
              activeOpacity={0.7}
              accessibilityLabel={isLive ? 'Join live session' : 'Join session'}
            >
              <Video
                size={11}
                color={joinIsActive ? colors.actionForeground : colors.textMuted}
              />
              <Text
                style={[
                  s.joinBtnTxt,
                  {
                    color: joinIsActive ? colors.actionForeground : colors.textMuted,
                  },
                ]}
              >
                {isLive ? 'Join Now' : 'Join'}
              </Text>
            </TouchableOpacity>
          ) : showJoinButton && isDisabled ? (
            <View
              style={[
                s.joinBtn,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  opacity: 0.5,
                },
              ]}
            >
              <Video size={11} color={colors.textMuted} />
              <Text style={[s.joinBtnTxt, { color: colors.textMuted }]}>Unavailable</Text>
            </View>
          ) : showJoinButton ? (
            <View
              style={[
                s.joinBtn,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Video size={11} color={colors.textMuted} />
              <Text style={[s.joinBtnTxt, { color: colors.textMuted }]}>Recording</Text>
            </View>
          ) : null}
          {cancelAction ? (
            <TouchableOpacity
              style={[
                s.cancelBtn,
                {
                  backgroundColor: cancelAction.disabled ? colors.inputBg : colors.card,
                  borderColor: colors.red,
                  opacity: cancelAction.disabled ? 0.6 : 1,
                },
              ]}
              onPress={cancelAction.onPress}
              disabled={cancelAction.disabled}
              activeOpacity={0.7}
              accessibilityLabel={cancelAction.accessibilityLabel ?? 'Cancel session'}
            >
              <Text style={[s.cancelBtnTxt, { color: colors.red }]}>
                {cancelAction.label ?? 'Cancel'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
      <Modal
        animationType="fade"
        transparent={true}
        visible={Boolean(externalJoinTarget)}
        onRequestClose={() => setExternalJoinTarget(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setExternalJoinTarget(null)}>
          <Pressable
            style={[
              s.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={s.modalHeading}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                Session ready to join
              </Text>
              <Text style={[s.modalDescription, { color: colors.textMuted }]}>
                This session opens in an external provider. Stay here until you are ready,
                then use the link below to join.
              </Text>
            </View>
            <View
              style={[
                s.modalLinkBox,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Text style={[s.modalLinkLabel, { color: colors.textMuted }]}>
                Join link
              </Text>
              <Text style={[s.modalLinkValue, { color: colors.text }]}>
                {externalJoinTarget?.joinHref}
              </Text>
            </View>
            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[
                  s.modalButton,
                  s.modalButtonSecondary,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => void handleShareJoinHref()}
                activeOpacity={0.85}
                accessibilityLabel="Share join link"
              >
                <Share2 size={16} color={colors.text} />
                <Text style={[s.modalButtonSecondaryText, { color: colors.text }]}>
                  Share
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, { backgroundColor: colors.action }]}
                onPress={() => {
                  if (externalJoinTarget?.joinHref) {
                    void requestPushConsent();
                    handleOpenJoinHref(externalJoinTarget.joinHref);
                  }
                  setExternalJoinTarget(null);
                }}
                activeOpacity={0.85}
                accessibilityLabel={
                  externalJoinTarget?.providerLabel
                    ? `Open ${externalJoinTarget.providerLabel}`
                    : 'Open session'
                }
              >
                <Video size={16} color={colors.actionForeground} />
                <Text
                  style={[s.modalButtonPrimaryText, { color: colors.actionForeground }]}
                >
                  {externalJoinTarget?.providerLabel
                    ? `Join ${externalJoinTarget.providerLabel}`
                    : 'Join session'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modalCloseIconButton,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => setExternalJoinTarget(null)}
                activeOpacity={0.85}
                accessibilityLabel="Close join dialog"
              >
                <X size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    sessionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 20,
      shadowColor: '#1f2a26',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    sessionCardPast: {
      opacity: 0.85,
      shadowOpacity: 0,
      elevation: 0,
    },
    sessionDayBadge: {
      minWidth: 48,
      minHeight: 58,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    sessionDayExtra: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    sessionDayName: {
      fontSize: 11,
      fontWeight: '600',
    },
    sessionDayNum: {
      fontSize: 17,
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
    sessionTitleRowMessageList: {
      marginBottom: 2,
    },
    sessionLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    sessionLabelMessageList: {
      fontSize: MESSAGE_TITLE_FONT_SIZE,
      fontWeight: MESSAGE_TITLE_FONT_WEIGHT,
    },
    sessionTimeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: 3,
    },
    sessionTimeTxt: {
      fontSize: 12,
    },
    sessionParticipantWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      flexShrink: 1,
      minWidth: 0,
    },
    sessionParticipantGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 0,
    },
    sessionParticipantNames: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      minWidth: 0,
    },
    sessionParticipantName: {
      fontSize: 12,
      lineHeight: 17,
      color: C.textMuted,
      fontWeight: '600',
    },
    sessionOriginalTimeTxt: {
      fontSize: 12,
    },
    sessionOriginalTimeStrike: {
      textDecorationLine: 'line-through',
    },
    sessionReasonTxt: {
      fontSize: 12,
      fontStyle: 'italic',
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    sessionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    iconBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    cancelBtn: {
      minHeight: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 10,
    },
    cancelBtnTxt: {
      fontSize: 12,
      fontWeight: '700',
    },
    joinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
    },
    joinBtnTxt: {
      fontSize: 12,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: C.modalOverlay,
    },
    modalCard: {
      gap: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      padding: 20,
    },
    modalHeading: { gap: 8 },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
    },
    modalDescription: {
      fontSize: 15,
      lineHeight: 20,
      color: C.textMuted,
    },
    modalLinkBox: {
      gap: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
      padding: 14,
    },
    modalLinkLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: C.textMuted,
    },
    modalLinkValue: {
      fontSize: 14,
      lineHeight: 19,
      color: C.text,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 10,
    },
    modalButton: {
      minWidth: 104,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    modalButtonSecondary: {
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
    },
    modalButtonSecondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
    },
    modalButtonPrimaryText: {
      fontSize: 15,
      fontWeight: '700',
    },
    modalCloseIconButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
    },
  });
}
