import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Phone, PhoneOff, Users } from 'lucide-react-native';
import type { ClassroomRosterVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
export function NativeClassRoster({
  roster,
  error,
  pending,
  call,
  cancel,
}: {
  roster: ClassroomRosterVM | null;
  error: string | null;
  pending: string | null;
  call: (profileId: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  if (!roster?.enabled) return null;
  const absent = roster.members.filter((member) => !member.joined);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Users size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: '600' }}>
          Not in meeting ({absent.length})
        </Text>
      </View>
      {roster.callingUnavailableReason && (
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {roster.callingUnavailableReason}
        </Text>
      )}
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {error}
        </Text>
      )}
      {absent.map((member) => {
        const ringing =
          member.call?.status === 'ringing' &&
          Date.parse(member.call.expiresAt) > Date.now();
        const status = member.joined
          ? 'In meeting'
          : ringing
            ? 'Ringing…'
            : member.call?.status === 'accepted'
              ? 'Joining…'
              : member.call?.status === 'declined'
                ? 'Declined'
                : member.call?.status === 'expired'
                  ? 'No answer'
                  : 'Not in meeting';
        return (
          <View
            key={member.profileId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '500' }}>
                {member.displayName}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{status}</Text>
            </View>
            {member.canCall && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${ringing ? 'Cancel call to' : 'Call'} ${member.displayName}`}
                disabled={pending !== null}
                onPress={() => {
                  void (ringing && member.call
                    ? cancel(member.call.id)
                    : call(member.profileId));
                }}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 10,
                  backgroundColor: colors.actionSubtle,
                  opacity: pending ? 0.5 : 1,
                }}
              >
                {ringing ? (
                  <PhoneOff size={20} color={colors.text} />
                ) : (
                  <Phone size={20} color={colors.text} />
                )}
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}
