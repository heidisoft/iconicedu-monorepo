import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchOrgSessions, queryKeys } from '@/lib/api/queries';
import { createHeaderSurface } from '@/lib/header-surface';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/providers/theme-provider';
import { ClassScheduleScreen } from '@/components/sessions/class-schedule-screen';
import type { AppColors } from '@/lib/theme';

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.pageBg },
    header: {
      ...createHeaderSurface(colors.pageBg, colors.border),
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
  });
}

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { data: account, refetch: refetchAccount } = useAccount();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileKind = ((profile as Record<string, unknown> | undefined)?.kind ??
    (account as Record<string, unknown> | undefined)?.primary_role) as string | undefined;

  const schedulesQuery = useQuery({
    queryKey: queryKeys.orgSessions(orgId ?? ''),
    queryFn: () => fetchOrgSessions(orgId!),
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  });

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([refetchAccount(), refetchProfile(), schedulesQuery.refetch()]).finally(
      () => setIsRefreshing(false),
    );
  }, [refetchAccount, refetchProfile, schedulesQuery]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Schedule</Text>
      </View>
      <ClassScheduleScreen
        schedules={schedulesQuery.data ?? []}
        isLoading={schedulesQuery.isLoading}
        error={
          schedulesQuery.error
            ? schedulesQuery.error instanceof Error
              ? schedulesQuery.error.message
              : 'Failed to load schedule'
            : null
        }
        orgId={orgId ?? ''}
        profileKind={profileKind ?? null}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
    </SafeAreaView>
  );
}
