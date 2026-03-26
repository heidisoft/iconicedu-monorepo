import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';

export default function Index() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (session) {
      router.replace('/(app)/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [session, loading, router]);

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: colors.pageBg }}
    >
      <ActivityIndicator size="large" color={colors.teal} />
    </View>
  );
}
