import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CirclePlus, Mail, Users } from 'lucide-react-native';
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
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginRight: 40,
    },
    scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
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
    valueText: { fontSize: 13, color: C.textMuted, maxWidth: 140, textAlign: 'right' },
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
    emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    emptyDesc: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
    childAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    childInitial: { fontSize: 15, fontWeight: '700', color: C.teal },
    hint: { fontSize: 12, color: C.textFaint, paddingHorizontal: 4 },
  });
}

export default function FamilyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { links, childProfiles, isLoading } = useFamilyLinks();
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

  function handleInvite() {
    Alert.alert(
      'Invite Child',
      'Inviting a child by email or phone will be available soon.',
      [{ text: 'OK' }],
    );
  }

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
              Invite a child using their email or phone number to link them to your
              account.
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
                        <View style={s.childAvatar}>
                          <Text style={s.childInitial}>{childInitial}</Text>
                        </View>
                      )
                    }
                    label={childName}
                    labelColor={colors.text}
                    hideChevron
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

        {/* Actions */}
        <Text style={s.sectionLabel}>Actions</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<Mail size={20} color={colors.teal} />}
            label="Invite child by email"
            labelColor={colors.teal}
            chevronColor={colors.textFaint}
            onPress={handleInvite}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<CirclePlus size={20} color={colors.teal} />}
            label="Invite child by phone"
            labelColor={colors.teal}
            chevronColor={colors.textFaint}
            onPress={handleInvite}
          />
        </View>

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
