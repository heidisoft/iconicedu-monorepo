import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  EllipsisVertical,
  Hand,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { NativeParticipant } from '@/lib/classroom/meeting-controller';

/** Matches the web People row: avatar, identity, media state, then contextual actions. */
export function NativeParticipantRow({
  user,
  isYou,
  handRaised,
  canManage,
  children,
}: {
  user: NativeParticipant;
  isYou: boolean;
  handRaised: boolean;
  canManage: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ padding: 12, borderRadius: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          accessibilityElementsHidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.actionSubtle,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {user.name
              .trim()
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '500' }}>
            {user.name}
            {isYou ? ' (You)' : ''}
          </Text>
          {(user.host || user.cohost) && (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {user.host ? 'Meeting host' : 'Co-host'}
            </Text>
          )}
        </View>
        {handRaised && (
          <View accessibilityLabel={`${user.name} raised their hand`}>
            <Hand size={18} color={colors.text} />
          </View>
        )}
        <View accessibilityLabel={user.muted ? 'Microphone off' : 'Microphone on'}>
          {user.muted ? (
            <MicOff size={18} color={colors.textMuted} />
          ) : (
            <Mic size={18} color={colors.text} />
          )}
        </View>
        <View accessibilityLabel={user.video ? 'Camera on' : 'Camera off'}>
          {user.video ? (
            <Video size={18} color={colors.text} />
          ) : (
            <VideoOff size={18} color={colors.textMuted} />
          )}
        </View>
        {canManage && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${user.name}`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 22,
            }}
          >
            <EllipsisVertical size={20} color={colors.text} />
          </Pressable>
        )}
      </View>
      {expanded && (
        <View
          style={{
            padding: 8,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
