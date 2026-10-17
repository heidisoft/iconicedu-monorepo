import { NativeFloatingReaction } from './native-meeting-motion';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Hand, MicOff } from 'lucide-react-native';
import type { NativeParticipant } from '@/lib/classroom/meeting-controller';
import { useTheme } from '@/providers/theme-provider';
import { NativeVideoView } from './native-video-view';

/**
 * Web's gallery: one person fills the stage, two share it (stacked in portrait,
 * side by side in landscape), and three or four use a 2×2 grid.
 */
export function galleryGrid(count: number, width: number, height: number) {
  if (count <= 1) return { columns: 1, rows: 1 };
  if (count === 2)
    return width > height ? { columns: 2, rows: 1 } : { columns: 1, rows: 2 };
  return { columns: 2, rows: 2 };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function NativeParticipantTile({
  user,
  self,
  speaking,
  handRaised,
  reaction,
  showVideo,
  compact = false,
  onPress,
}: {
  user: NativeParticipant;
  self: boolean;
  speaking: boolean;
  handRaised: boolean;
  reaction?: string;
  showVideo: boolean;
  compact?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const label = `${user.name}${self ? ' (You)' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Focus ${user.name}`}
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: compact ? 12 : 20,
        overflow: 'hidden',
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: speaking ? colors.success : 'transparent',
      }}
    >
      {showVideo && user.video ? (
        <View pointerEvents="none" style={{ flex: 1 }}>
          <NativeVideoView userId={user.id} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: compact ? 40 : 88,
              height: compact ? 40 : 88,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primarySubtle,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: compact ? 16 : 32,
                fontWeight: '600',
              }}
            >
              {initials(user.name)}
            </Text>
          </View>
        </View>
      )}
      {reaction && <NativeFloatingReaction key={reaction} emoji={reaction} />}
      {reaction && (
        <Text
          accessibilityLabel={`${user.name} reacted ${reaction}`}
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', top: 8, right: 8, fontSize: compact ? 20 : 32 }}
        >
          {reaction}
        </Text>
      )}
      {handRaised && (
        <View
          accessibilityLabel={`${user.name} raised a hand`}
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: 6,
            borderRadius: 999,
            backgroundColor: colors.warning,
          }}
        >
          <Hand size={compact ? 14 : 18} color={colors.warningForeground} />
        </View>
      )}
      <View
        accessibilityLabel={`${label} status`}
        style={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          maxWidth: '90%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: colors.modalOverlay,
        }}
      >
        {user.muted && <MicOff size={14} color="#fff" />}
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: compact ? 11 : 13 }}>
          {label}
          {user.host ? ' · Host' : user.cohost ? ' · Co-host' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

/** Fills the stage like web's gallery, paging four people at a time. */
export function NativeParticipantGallery({
  participants,
  selfId,
  speaking,
  raisedHands,
  reactionFor,
  hiddenVideoId,
  onFocus,
}: {
  participants: NativeParticipant[];
  selfId: string | null;
  speaking: string[];
  raisedHands: string[];
  reactionFor: (userId: string) => string | undefined;
  hiddenVideoId?: string;
  onFocus: (userId: string) => void;
}) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(participants.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = participants.slice(current * pageSize, (current + 1) * pageSize);
  const { columns, rows } = galleryGrid(visible.length, size.width, size.height);
  const cells = Array.from({ length: rows }, (_, row) =>
    visible.slice(row * columns, (row + 1) * columns),
  );
  const pager = (
    label: string,
    next: number,
    disabled: boolean,
    icon: React.ReactNode,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => setPage(next)}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.actionSubtle,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {icon}
    </Pressable>
  );
  return (
    <View
      style={{ flex: 1, gap: 8 }}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
    >
      {cells.map((row, index) => (
        <View key={index} style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
          {row.map((user) => (
            <NativeParticipantTile
              key={user.id}
              user={user}
              self={user.id === selfId}
              speaking={speaking.includes(user.id) && !user.muted}
              handRaised={raisedHands.includes(user.id)}
              reaction={reactionFor(user.id)}
              showVideo={hiddenVideoId !== user.id}
              onPress={() => onFocus(user.id)}
            />
          ))}
        </View>
      ))}
      {pageCount > 1 && (
        <View
          accessibilityLabel="Gallery pages"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {pager(
            'Previous participants',
            current - 1,
            current === 0,
            <ChevronLeft size={20} color={colors.text} />,
          )}
          <Text style={{ color: colors.text, fontVariant: ['tabular-nums'] }}>
            {current + 1} / {pageCount}
          </Text>
          {pager(
            'Next participants',
            current + 1,
            current >= pageCount - 1,
            <ChevronRight size={20} color={colors.text} />,
          )}
        </View>
      )}
    </View>
  );
}

/** Web keeps faces visible beside a presentation as a small filmstrip. */
export function NativeParticipantFilmstrip({
  vertical = false,
  participants,
  selfId,
  speaking,
  raisedHands,
  reactionFor,
  onFocus,
}: {
  vertical?: boolean;
  participants: NativeParticipant[];
  selfId: string | null;
  speaking: string[];
  raisedHands: string[];
  reactionFor: (userId: string) => string | undefined;
  onFocus: (userId: string) => void;
}) {
  return (
    <ScrollView
      accessibilityLabel="Meeting participants"
      horizontal={!vertical}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={
        vertical
          ? { width: 132, flexGrow: 0, flexShrink: 0 }
          : { height: 96, flexGrow: 0 }
      }
      contentContainerStyle={{ flexDirection: vertical ? 'column' : 'row', gap: 8 }}
    >
      {participants.map((user) => (
        <View
          key={user.id}
          style={vertical ? { width: 132, height: 96 } : { width: 140, height: 96 }}
        >
          <NativeParticipantTile
            compact
            user={user}
            self={user.id === selfId}
            speaking={speaking.includes(user.id) && !user.muted}
            handRaised={raisedHands.includes(user.id)}
            reaction={reactionFor(user.id)}
            showVideo
            onPress={() => onFocus(user.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}
