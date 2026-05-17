import React, { useMemo, useState } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SearchBar, ListItem, EmptyState, Separator, Chip } from '@iconicedu/ui-native';
import { BookOpenCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useLearningSpaces } from '@/hooks/use-learning-spaces';
import { LearningSpaceIconBadge } from '@/lib/learning-space-icons';
import { useTheme } from '@/providers/theme-provider';
import { createHeaderSurface } from '@/lib/header-surface';
import type { AppColors } from '@/lib/theme';

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    header: {
      ...createHeaderSurface(C.pageBg, C.border),
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
      gap: 12,
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 32,
    },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
}

export default function SpacesListScreen() {
  const [search, setSearch] = useState('');
  const { data: account } = useAccount();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const orgId = account?.org_id ?? '';
  const { data: spaces, isLoading } = useLearningSpaces(orgId);

  const filteredSpaces = useMemo(() => {
    if (!spaces) return [];
    if (!search) return spaces;
    return spaces.filter((space: Record<string, unknown>) => {
      const title = (space.title as string) ?? '';
      const subject = (space.subject as string) ?? '';
      return (
        title.toLowerCase().includes(search.toLowerCase()) ||
        subject.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [spaces, search]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Classes</Text>
        <SearchBar value={search} onChangeText={setSearch} />
      </View>

      {isLoading ? (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      ) : (
        <FlatList
          data={filteredSpaces}
          keyExtractor={(item: Record<string, unknown>) => item.id as string}
          contentContainerStyle={s.listContent}
          ItemSeparatorComponent={() => <Separator className="ml-14" />}
          ListEmptyComponent={
            <EmptyState
              icon={<BookOpenCheck size={32} color={colors.teal} />}
              title="No classes"
              description="Your classes will appear here"
            />
          }
          renderItem={({ item }: { item: Record<string, unknown> }) => {
            const title = (item.title as string) ?? 'Class';
            const subject = (item.subject as string) ?? '';
            const status = (item.status as string) ?? 'active';
            const primaryChannel = item.primary_channel as
              | Record<string, unknown>
              | undefined;
            const channelId = primaryChannel?.id as string | undefined;

            return (
              <ListItem
                leading={
                  <LearningSpaceIconBadge
                    iconKey={(item.icon_key as string | null | undefined) ?? null}
                    size={40}
                    iconSize={20}
                    borderRadius={12}
                    backgroundColor={colors.card}
                    color={colors.teal}
                  />
                }
                title={title}
                subtitle={subject}
                trailing={
                  <Chip
                    label={status}
                    variant={status === 'active' ? 'active' : 'default'}
                  />
                }
                onPress={() => {
                  if (channelId) {
                    router.push(`/(app)/spaces/${channelId}`);
                  }
                }}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
