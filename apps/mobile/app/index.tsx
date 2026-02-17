import React, { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StyledView } from '@iconicedu/ui-native';
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
    <StyledView className="flex-1 items-center justify-center bg-slate-950">
      <ActivityIndicator size="large" color="#4a65e8" />
    </StyledView>
  );
}
