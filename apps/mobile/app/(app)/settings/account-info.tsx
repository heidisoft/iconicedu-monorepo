import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 4L12 14.01L9 11.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
function PhoneIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92V19.92C22.0011 20.4833 21.7552 21.0217 21.3235 21.4012C20.8919 21.7808 20.3186 21.9652 19.76 21.91C16.4916 21.5529 13.3531 20.4494 10.59 18.7C8.01467 17.1 5.83268 14.918 4.23 12.34C2.49494 9.56411 1.39097 6.41006 1.04 3.13C0.984892 2.57306 1.1679 2.00122 1.54491 1.57019C1.92191 1.13915 2.4574 0.954265 3.02 0.960002H6.02C7.01449 0.949931 7.85701 1.6507 8 2.63C8.12663 3.53945 8.35144 4.43141 8.67 5.29C8.93449 5.99765 8.75337 6.79313 8.21 7.32L6.94 8.59C8.47762 11.2547 10.7453 13.5224 13.41 15.06L14.68 13.79C15.2069 13.2466 16.0024 13.0655 16.71 13.33C17.5686 13.6486 18.4606 13.8734 19.37 14C20.3604 14.1448 21.0725 15.0062 21.05 16V16.92H22Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ShieldIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IdCardIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M20 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V6C22 4.89543 21.1046 4 20 4Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9} cy={11} r={3} stroke={color} strokeWidth={1.8} />
      <Path d="M14 10H18M14 14H16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const ROLE_LABELS: Record<string, string> = {
  educator: 'Educator',
  guardian: 'Parent / Guardian',
  child:    'Student',
  staff:    'Staff',
  admin:    'Admin',
  owner:    'Owner',
};

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
    valueText:    { fontSize: 13, color: C.textMuted, maxWidth: 160, textAlign: 'right' },
    verifiedRow:  { alignItems: 'flex-end', gap: 3 },
    verifiedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
    verifiedTxt:  { fontSize: 11, fontWeight: '600', color: '#16a34a' },
    unverifiedTxt:{ fontSize: 11, color: C.textFaint },
  });
}

function VerifiedBadge({ verified, s }: { verified?: boolean | null; s: ReturnType<typeof makeStyles> }) {
  if (verified) {
    return (
      <View style={s.verifiedBadge}>
        <CheckCircleIcon color="#16a34a" />
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
          <ChevronLeftIcon color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Contact & Security</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Contact */}
        <Text style={s.sectionLabel}>Contact</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<MailIcon color={colors.textMuted} />}
            label="Email"
            labelColor={colors.text}
            hideChevron
            trailing={
              <View style={s.verifiedRow}>
                <Text style={s.valueText} numberOfLines={1}>{acc?.email as string ?? '—'}</Text>
                <VerifiedBadge verified={acc?.email_verified as boolean} s={s} />
              </View>
            }
          />
          {!!(acc?.phone_e164) && (
            <>
              <View style={s.divider} />
              <SettingsRow
                icon={<PhoneIcon color={colors.textMuted} />}
                label="Phone"
                labelColor={colors.text}
                hideChevron
                trailing={
                  <View style={s.verifiedRow}>
                    <Text style={s.valueText} numberOfLines={1}>{acc.phone_e164 as string}</Text>
                    <VerifiedBadge verified={acc?.phone_verified as boolean} s={s} />
                  </View>
                }
              />
            </>
          )}
          {!!(acc?.whatsapp_e164) && (
            <>
              <View style={s.divider} />
              <SettingsRow
                icon={<PhoneIcon color={colors.textMuted} />}
                label="WhatsApp"
                labelColor={colors.text}
                hideChevron
                trailing={
                  <View style={s.verifiedRow}>
                    <Text style={s.valueText} numberOfLines={1}>{acc.whatsapp_e164 as string}</Text>
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
            icon={<IdCardIcon color={colors.textMuted} />}
            label="Role"
            labelColor={colors.text}
            hideChevron
            trailing={
              <Text style={s.valueText}>{ROLE_LABELS[profileKind ?? ''] ?? profileKind ?? '—'}</Text>
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<ShieldIcon color={colors.textMuted} />}
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
