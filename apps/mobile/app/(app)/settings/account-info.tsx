import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  CheckCircle,
  Mail,
  Phone,
  Shield,
  CreditCard,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

const ROLE_LABELS: Record<string, string> = {
  educator: 'Educator',
  guardian: 'Parent / Guardian',
  child: 'Student',
  staff: 'Staff',
  admin: 'Admin',
  owner: 'Owner',
};

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
    valueText: { fontSize: 14, color: C.textMuted, maxWidth: 160, textAlign: 'right' },
    verifiedRow: { alignItems: 'flex-end', gap: 3 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    verifiedTxt: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
    unverifiedTxt: { fontSize: 12, color: C.textFaint },
  });
}

function VerifiedBadge({
  verified,
  s,
}: {
  verified?: boolean | null;
  s: ReturnType<typeof makeStyles>;
}) {
  if (verified) {
    return (
      <View style={s.verifiedBadge}>
        <CheckCircle size={14} color="#16a34a" />
        <Text style={s.verifiedTxt}>Verified</Text>
      </View>
    );
  }
  return <Text style={s.unverifiedTxt}>Unverified</Text>;
}

export default function AccountInfoScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const acc = account as Record<string, unknown> | undefined;
  const prof = profile as Record<string, unknown> | undefined;
  const profileKind = (prof?.kind as string) ?? (acc?.primary_role as string);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Contact & Security</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Contact */}
        <Text style={s.sectionLabel}>Contact</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<Mail size={20} color={colors.textMuted} />}
            label="Email"
            labelColor={colors.text}
            hideChevron
            trailing={
              <View style={s.verifiedRow}>
                <Text style={s.valueText} numberOfLines={1}>
                  {(acc?.email as string) ?? '—'}
                </Text>
                <VerifiedBadge verified={acc?.email_verified as boolean} s={s} />
              </View>
            }
          />
          {!!acc?.phone_e164 && (
            <>
              <View style={s.divider} />
              <SettingsRow
                icon={<Phone size={20} color={colors.textMuted} />}
                label="Phone"
                labelColor={colors.text}
                hideChevron
                trailing={
                  <View style={s.verifiedRow}>
                    <Text style={s.valueText} numberOfLines={1}>
                      {acc.phone_e164 as string}
                    </Text>
                    <VerifiedBadge verified={acc?.phone_verified as boolean} s={s} />
                  </View>
                }
              />
            </>
          )}
          {!!acc?.whatsapp_e164 && (
            <>
              <View style={s.divider} />
              <SettingsRow
                icon={<Phone size={20} color={colors.textMuted} />}
                label="WhatsApp"
                labelColor={colors.text}
                hideChevron
                trailing={
                  <View style={s.verifiedRow}>
                    <Text style={s.valueText} numberOfLines={1}>
                      {acc.whatsapp_e164 as string}
                    </Text>
                    <VerifiedBadge verified={acc?.whatsapp_verified as boolean} s={s} />
                  </View>
                }
              />
            </>
          )}
        </View>

        {/* Account */}
        <Text style={s.sectionLabel}>Account</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<CreditCard size={20} color={colors.textMuted} />}
            label="Role"
            labelColor={colors.text}
            hideChevron
            trailing={
              <Text style={s.valueText}>
                {ROLE_LABELS[profileKind ?? ''] ?? profileKind ?? '—'}
              </Text>
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<Shield size={20} color={colors.textMuted} />}
            label="Status"
            labelColor={colors.text}
            hideChevron
            trailing={
              <Text style={s.valueText}>
                {((acc?.status as string) ?? '—').replace(/_/g, ' ')}
              </Text>
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
