import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchFamilyChildInvites,
  revokeFamilyChildInvite,
} from '@/lib/api/family-invites';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import { useFamilyView } from '@/providers/family-view-provider';
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CirclePlus, Users, Mail } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useFamilyLinks } from '@/hooks/use-family-links';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    navBack: { padding: 8, borderRadius: 8 },
    navTitle: {
      flex: 1,
      fontSize: 19,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginRight: 40,
    },
    scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 4,
      paddingTop: 14,
      paddingBottom: 6,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      overflow: 'hidden',
    },
    divider: { height: 1, backgroundColor: C.border, marginLeft: 60 },
    valueText: { fontSize: 14, color: C.textMuted, maxWidth: 140, textAlign: 'right' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyCard: { padding: 28, alignItems: 'center', gap: 10 },
    emptyIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.inputBg,
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
    emptyDesc: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
    childAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    childInitial: { fontSize: 16, fontWeight: '700', color: C.teal },
    hint: { fontSize: 13, color: C.textFaint, paddingHorizontal: 4 },
  });
}

export default function FamilyScreen() {
  const router = useRouter();
  const { guardianProfileId, guardianAccountId } = useFamilyView();
  const { colors } = useTheme();
  const { links, childProfiles, isLoading } = useFamilyLinks();
  const client = useQueryClient();
  const invites = useQuery({
    queryKey: ['family-child-invites', guardianAccountId],
    queryFn: fetchFamilyChildInvites,
    enabled: !!guardianProfileId,
  });
  const [revoking, setRevoking] = useState<string | null>(null);
  function revoke(id: string) {
    if (revoking) return;
    Alert.alert(
      'Cancel invitation?',
      'The child will no longer be able to join through this invitation.',
      [
        { text: 'Keep invite', style: 'cancel' },
        {
          text: 'Cancel invitation',
          style: 'destructive',
          onPress: async () => {
            setRevoking(id);
            try {
              await revokeFamilyChildInvite(id);
              await client.invalidateQueries({
                queryKey: ['family-child-invites', guardianAccountId],
              });
            } catch (error) {
              Alert.alert(
                'Unable to cancel invitation',
                error instanceof Error ? error.message : 'Please try again.',
              );
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
    );
  }
  const s = useMemo(() => makeStyles(colors), [colors]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.navTitle}>Family</Text>
        </View>
        <View style={s.loading}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const profileByAccountId = Object.fromEntries(
    childProfiles.map((p) => [p.account_id as string, p]),
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Family</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Children */}
        <Text style={s.sectionLabel}>Children</Text>

        {links.length === 0 ? (
          <View style={[s.card, s.emptyCard]}>
            <View style={s.emptyIconWrap}>
              <Users size={30} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No family links yet</Text>
            <Text style={s.emptyDesc}>
              Add a child to manage their profile and learning details.
            </Text>
          </View>
        ) : (
          <View style={s.card}>
            {links.map((link, i) => {
              const childAccountId = link.child_account_id as string;
              const childProf = profileByAccountId[childAccountId];
              const childName =
                (childProf?.display_name as string) ??
                ((childProf?.first_name as string)
                  ? `${childProf.first_name} ${childProf.last_name ?? ''}`.trim()
                  : null) ??
                'Child';
              const childInitial = childName[0]?.toUpperCase() ?? 'C';
              const childAvatarUrl = childProf?.avatar_url as string | null | undefined;
              const relation = (link.relation as string)?.replace(/_/g, ' ') ?? 'child';

              return (
                <React.Fragment key={link.id as string}>
                  {i > 0 && <View style={s.divider} />}
                  <SettingsRow
                    icon={
                      childAvatarUrl ? (
                        <Image source={{ uri: childAvatarUrl }} style={s.childAvatar} />
                      ) : (
                        <View
                          style={[
                            s.childAvatar,
                            {
                              backgroundColor: profileAvatarColors({
                                seed: childAccountId,
                                themeKey: childProf?.ui_theme_key as string,
                              }).bg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.childInitial,
                              {
                                color: profileAvatarColors({
                                  seed: childAccountId,
                                  themeKey: childProf?.ui_theme_key as string,
                                }).fg,
                              },
                            ]}
                          >
                            {childInitial}
                          </Text>
                        </View>
                      )
                    }
                    label={childName}
                    labelColor={colors.text}
                    onPress={() =>
                      childProf?.id &&
                      router.push({
                        pathname: '/(app)/settings/child',
                        params: { id: String(childProf?.id ?? '') },
                      })
                    }
                    trailing={
                      <Text style={s.valueText} numberOfLines={1}>
                        {relation.charAt(0).toUpperCase() + relation.slice(1)}
                      </Text>
                    }
                  />
                </React.Fragment>
              );
            })}
          </View>
        )}

        {!!guardianProfileId && invites.isError && (
          <Pressable onPress={() => void invites.refetch()}>
            <Text style={s.hint}>Unable to load invitations. Tap to retry.</Text>
          </Pressable>
        )}
        {!!guardianProfileId && !!invites.data?.length && (
          <>
            <Text style={s.sectionLabel}>Pending invitations</Text>
            <View style={s.card}>
              {invites.data.map((invite, index) => (
                <React.Fragment key={invite.id}>
                  {index > 0 && <View style={s.divider} />}
                  <SettingsRow
                    icon={<Mail size={20} color={colors.textMuted} />}
                    label={invite.invitedEmail ?? 'Child invitation'}
                    labelColor={colors.text}
                    hideChevron
                    trailing={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Cancel child invitation"
                        disabled={!!revoking}
                        onPress={() => revoke(invite.id)}
                        style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
                      >
                        <Text style={{ color: colors.red }}>
                          {revoking === invite.id ? 'Cancelling…' : 'Cancel'}
                        </Text>
                      </Pressable>
                    }
                  />
                  <Text style={[s.hint, { paddingHorizontal: 16, paddingBottom: 12 }]}>
                    {invite.expiresAt
                      ? `${new Date(invite.expiresAt).getTime() < Date.now() ? 'Expired' : 'Expires'} ${new Date(invite.expiresAt).toLocaleDateString()}`
                      : 'Pending'}
                  </Text>
                </React.Fragment>
              ))}
            </View>
          </>
        )}
        {/* Actions */}
        {!!guardianProfileId && (
          <>
            <Text style={s.sectionLabel}>Actions</Text>
            <View style={s.card}>
              <SettingsRow
                icon={<Mail size={20} color={colors.teal} />}
                label="Invite child by email"
                labelColor={colors.teal}
                chevronColor={colors.textFaint}
                onPress={() => router.push('/(app)/settings/invite-child')}
              />
              <View style={s.divider} />
              <SettingsRow
                icon={<CirclePlus size={20} color={colors.teal} />}
                label="Add new child"
                labelColor={colors.teal}
                chevronColor={colors.textFaint}
                onPress={() => router.push('/(app)/settings/child')}
              />
            </View>
          </>
        )}
        {links.length > 0 && (
          <Text style={s.hint}>
            {links.length} {links.length === 1 ? 'child' : 'children'} linked to your
            account.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
