import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { NAV_THEME } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';

export default function Index() {
  const { session, loading } = useAuth();
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
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color={NAV_THEME.dark.primary} />
    </View>
  );
}
