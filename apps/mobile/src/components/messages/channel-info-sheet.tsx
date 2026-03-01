import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, CalendarDays, Bookmark, Users } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

const AVATAR_COLORS = ['#5B8DEF', '#E07B54', '#6CC070', '#A86CC1', '#E0A854', '#54B8C4', '#E06C8A'];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name[0]?.toUpperCase() ?? '?';
}

type ChannelTab = 'files' | 'sessions' | 'saved' | 'members';

export type ChannelInfoSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  kind: 'dm' | 'channel' | 'space';
  avatarSeed?: string | null;
  iconEmoji?: string | null;
  memberCount?: number | null;
  description?: string | null;
  members?: Array<{ id: string; name: string; avatarSeed?: string | null }> | null;
  onClose: () => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 12,
      overflow: 'hidden',
    },
    handle: {
      alignSelf: 'center',
      width: 36, height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      marginBottom: 16,
    },

    // ── Hero section ──────────────────────────────────────────────────────────
    hero: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 24,
      gap: 10,
    },
    avatarCircle: {
      width: 72, height: 72,
      borderRadius: 36,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarTxt:  { color: '#fff', fontWeight: '700', fontSize: 28 },
    iconBox: {
      width: 72, height: 72,
      borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    iconEmojiTxt: { fontSize: 36 },
    heroName:   { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
    heroSub:    { fontSize: 14, color: C.textMuted, textAlign: 'center' },

    // ── Info rows (DM only) ───────────────────────────────────────────────────
    section: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowSep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 16 },
    rowIcon:  { fontSize: 18, width: 24, textAlign: 'center' },
    rowLabel: { flex: 1, fontSize: 14, color: C.textMuted },
    rowValue: { fontSize: 14, fontWeight: '600', color: C.text, maxWidth: 200, textAlign: 'right' },

    // ── Tab bar ───────────────────────────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 4,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabItemActive: {
      borderBottomColor: C.teal,
    },
    tabLabel: {
      fontSize: 11,
      color: C.textMuted,
      fontWeight: '500',
    },
    tabLabelActive: {
      color: C.teal,
    },

    // ── Tab content area ──────────────────────────────────────────────────────
    tabContent: {
      height: 240,
    },

    // ── Empty state ───────────────────────────────────────────────────────────
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: C.textMuted,
      textAlign: 'center',
    },

    // ── Members list ──────────────────────────────────────────────────────────
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 12,
    },
    memberAvatar: {
      width: 36, height: 36,
      borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    memberAvatarTxt: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    memberName: {
      fontSize: 14,
      color: C.text,
      flex: 1,
    },

    // ── Close button ──────────────────────────────────────────────────────────
    closeBtn: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
      borderRadius: 12,
      backgroundColor: C.inputBg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    closeTxt: { fontSize: 15, fontWeight: '600', color: C.text },
  });
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: Array<{ key: ChannelTab; label: string }> = [
  { key: 'files',    label: 'Files' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'saved',    label: 'Saved' },
  { key: 'members',  label: 'Members' },
];

// ─── Tab content renderers ────────────────────────────────────────────────────

type TabContentProps = {
  tab: ChannelTab;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
  memberCount?: number | null;
  members?: Array<{ id: string; name: string; avatarSeed?: string | null }> | null;
};

function TabContent({ tab, colors, s, memberCount, members }: TabContentProps) {
  if (tab === 'files') {
    return (
      <View style={s.emptyState}>
        <FileText size={40} color={colors.teal} />
        <Text style={s.emptyTitle}>No files yet</Text>
        <Text style={s.emptySubtitle}>Shared files will appear here</Text>
      </View>
    );
  }

  if (tab === 'sessions') {
    return (
      <View style={s.emptyState}>
        <CalendarDays size={40} color={colors.teal} />
        <Text style={s.emptyTitle}>No sessions</Text>
        <Text style={s.emptySubtitle}>Scheduled sessions will appear here</Text>
      </View>
    );
  }

  if (tab === 'saved') {
    return (
      <View style={s.emptyState}>
        <Bookmark size={40} color={colors.teal} />
        <Text style={s.emptyTitle}>No saved messages</Text>
        <Text style={s.emptySubtitle}>Save important messages to find them here</Text>
      </View>
    );
  }

  // Members tab
  if (members && members.length > 0) {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {members.map((member) => {
          const seed = member.avatarSeed ?? member.name;
          return (
            <View key={member.id} style={s.memberRow}>
              <View style={[s.memberAvatar, { backgroundColor: avatarColor(seed) }]}>
                <Text style={s.memberAvatarTxt}>{getInitials(member.name)}</Text>
              </View>
              <Text style={s.memberName}>{member.name}</Text>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={s.emptyState}>
      <Users size={40} color={colors.teal} />
      <Text style={s.emptyTitle}>Members{memberCount != null ? ` (${memberCount})` : ''}</Text>
      <Text style={s.emptySubtitle}>Channel members will appear here</Text>
    </View>
  );
}

// ─── Tab icon renderer ────────────────────────────────────────────────────────

function TabIcon({ tabKey, color }: { tabKey: ChannelTab; color: string }) {
  const size = 16;
  if (tabKey === 'files')    return <FileText    size={size} color={color} />;
  if (tabKey === 'sessions') return <CalendarDays size={size} color={color} />;
  if (tabKey === 'saved')    return <Bookmark    size={size} color={color} />;
  return <Users size={size} color={color} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChannelInfoSheet({
  visible,
  title,
  subtitle,
  kind,
  avatarSeed,
  iconEmoji,
  memberCount,
  description,
  members,
  onClose,
}: ChannelInfoSheetProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<ChannelTab>('files');

  // Reset to first tab whenever the sheet opens
  useEffect(() => {
    if (visible) {
      setActiveTab('files');
    }
  }, [visible]);

  const isDm = kind === 'dm';
  const seed = avatarSeed ?? title;
  const typeLabel = isDm ? 'Direct Message' : kind === 'space' ? 'Learning Space' : 'Channel';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={s.handle} />

              {/* Hero */}
              <View style={s.hero}>
                {isDm ? (
                  <View style={[s.avatarCircle, { backgroundColor: avatarColor(seed) }]}>
                    <Text style={s.avatarTxt}>{getInitials(title)}</Text>
                  </View>
                ) : (
                  <View style={[s.iconBox, { backgroundColor: colors.tealBg }]}>
                    <Text style={s.iconEmojiTxt}>{iconEmoji ?? '📚'}</Text>
                  </View>
                )}
                <Text style={s.heroName}>{title}</Text>
                {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
              </View>

              {isDm ? (
                /* ── DM: static info rows (unchanged) ── */
                <View style={s.section}>
                  <View style={s.row}>
                    <Text style={s.rowIcon}>💬</Text>
                    <Text style={s.rowLabel}>Type</Text>
                    <Text style={s.rowValue}>{typeLabel}</Text>
                  </View>
                  {memberCount != null && (
                    <>
                      <View style={s.rowSep} />
                      <View style={s.row}>
                        <Text style={s.rowIcon}>👥</Text>
                        <Text style={s.rowLabel}>Members</Text>
                        <Text style={s.rowValue}>{memberCount}</Text>
                      </View>
                    </>
                  )}
                  {!!description && (
                    <>
                      <View style={s.rowSep} />
                      <View style={s.row}>
                        <Text style={s.rowIcon}>📝</Text>
                        <Text style={s.rowLabel}>Description</Text>
                        <Text style={s.rowValue} numberOfLines={2}>{description}</Text>
                      </View>
                    </>
                  )}
                </View>
              ) : (
                /* ── Channel / Space: tab bar + tab content ── */
                <>
                  {/* Tab bar */}
                  <View style={s.tabBar}>
                    {TABS.map((tab) => {
                      const isActive = activeTab === tab.key;
                      const tabColor = isActive ? colors.teal : colors.textMuted;
                      return (
                        <TouchableOpacity
                          key={tab.key}
                          style={[s.tabItem, isActive && s.tabItemActive]}
                          onPress={() => setActiveTab(tab.key)}
                          activeOpacity={0.7}
                        >
                          <TabIcon tabKey={tab.key} color={tabColor} />
                          <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>
                            {tab.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Tab content */}
                  <View style={s.tabContent}>
                    <TabContent
                      tab={activeTab}
                      colors={colors}
                      s={s}
                      memberCount={memberCount}
                      members={members}
                    />
                  </View>
                </>
              )}

              {/* Close */}
              <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={s.closeTxt}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
