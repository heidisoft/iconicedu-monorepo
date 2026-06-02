import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Shield, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { deleteCurrentAccount } from '@/lib/api/account/queries';
import { useAuth } from '@/providers/auth-provider';
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
    notice: {
      padding: 16,
      gap: 8,
    },
    noticeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    noticeTitle: {
      color: C.text,
      fontSize: 16,
      fontWeight: '700',
    },
    noticeText: {
      color: C.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    dangerText: {
      color: C.red,
      fontWeight: '700',
    },
  });
}

export default function PrivacyDataScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [deleting, setDeleting] = useState(false);

  const runDeletion = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteCurrentAccount();
      await signOut();
    } catch (error) {
      Alert.alert(
        'Unable to delete account',
        error instanceof Error ? error.message : 'Please try again.',
      );
      setDeleting(false);
    }
  }, [signOut]);

  const confirmFinalDeletion = useCallback(() => {
    Alert.alert(
      'Permanently delete account?',
      'This will remove your sign-in and delete or anonymize your profile and contact data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void runDeletion();
          },
        },
      ],
    );
  }, [runDeletion]);

  const startDeletion = useCallback(() => {
    Alert.alert(
      'Delete your account?',
      'Your account sign-in will be removed, and your profile and contact data will be deleted or anonymized. You cannot undo this action.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: confirmFinalDeletion,
        },
      ],
    );
  }, [confirmFinalDeletion]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Privacy & Data</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>Account Data</Text>
        <View style={s.card}>
          <View style={s.notice}>
            <View style={s.noticeTitleRow}>
              <Shield size={20} color={colors.textMuted} />
              <Text style={s.noticeTitle}>Your account</Text>
            </View>
            <Text style={s.noticeText}>
              You can permanently delete your account from this app. This removes your
              sign-in and deletes or anonymizes profile, contact, and location details
              associated with your account.
            </Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>Danger Zone</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<Trash2 size={20} color={colors.red} />}
            label="Delete account"
            labelColor={colors.red}
            hideChevron
            onPress={deleting ? undefined : startDeletion}
            trailing={
              deleting ? <ActivityIndicator size="small" color={colors.red} /> : undefined
            }
          />
        </View>
        <Text style={[s.noticeText, s.dangerText]}>This action cannot be undone.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
