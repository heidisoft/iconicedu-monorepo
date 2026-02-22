import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useFamilyLinks } from '@/hooks/use-family-links';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function UsersIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9} cy={7} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PlusCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} />
      <Path d="M12 8V16M8 12H16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function MailIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 6L12 13L2 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: C.pageBg },
    nav:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    navBack:      { padding: 8, borderRadius: 8 },
    navTitle:     { flex: 1, fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center', marginRight: 40 },
    scroll:       { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6 },
    card:         { borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, overflow: 'hidden' },
    divider:      { height: 1, backgroundColor: C.border, marginLeft: 60 },
    valueText:    { fontSize: 13, color: C.textMuted, maxWidth: 140, textAlign: 'right' },
    loading:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyCard:    { padding: 28, alignItems: 'center', gap: 10 },
    emptyEmoji:   { fontSize: 40 },
    emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
    emptyDesc:    { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
    childAvatar:  { width: 36, height: 36, borderRadius: 18, backgroundColor: C.tealBg, alignItems: 'center', justifyContent: 'center' },
    childInitial: { fontSize: 15, fontWeight: '700', color: C.teal },
    hint:         { fontSize: 12, color: C.textFaint, paddingHorizontal: 4 },
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
            <ChevronLeftIcon color={colors.text} />
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
          <ChevronLeftIcon color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Family</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Children */}
        <Text style={s.sectionLabel}>Children</Text>

        {links.length === 0 ? (
          <View style={[s.card, s.emptyCard]}>
            <Text style={s.emptyEmoji}>👨‍👩‍👧</Text>
            <Text style={s.emptyTitle}>No family links yet</Text>
            <Text style={s.emptyDesc}>
              Invite a child using their email or phone number to link them to your account.
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
              const relation = (link.relation as string)?.replace(/_/g, ' ') ?? 'child';

              return (
                <React.Fragment key={link.id as string}>
                  {i > 0 && <View style={s.divider} />}
                  <SettingsRow
                    icon={
                      <View style={s.childAvatar}>
                        <Text style={s.childInitial}>{childInitial}</Text>
                      </View>
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
            icon={<MailIcon color={colors.teal} />}
            label="Invite child by email"
            labelColor={colors.teal}
            chevronColor={colors.textFaint}
            onPress={handleInvite}
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<PlusCircleIcon color={colors.teal} />}
            label="Invite child by phone"
            labelColor={colors.teal}
            chevronColor={colors.textFaint}
            onPress={handleInvite}
          />
        </View>

        {links.length > 0 && (
          <Text style={s.hint}>
            {links.length} {links.length === 1 ? 'child' : 'children'} linked to your account.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
