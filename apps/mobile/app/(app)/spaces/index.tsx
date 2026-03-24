import React, { useMemo, useState } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Typography,
  SearchBar,
  ListItem,
  EmptyState,
  Separator,
  Chip,
  NAV_THEME,
} from '@iconicedu/ui-native';
import { BookOpenCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useLearningSpaces } from '@/hooks/use-learning-spaces';
import { LearningSpaceIconBadge } from '@/lib/learning-space-icons';

export default function SpacesListScreen() {
  const [search, setSearch] = useState('');
  const { data: account } = useAccount();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV_THEME.dark.background }}>
      <View className="gap-3 px-4 pb-2 pt-2">
        <Typography variant="h3">Classs</Typography>
        <SearchBar value={search} onChangeText={setSearch} />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={NAV_THEME.dark.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSpaces}
          keyExtractor={(item: Record<string, unknown>) => item.id as string}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          ItemSeparatorComponent={() => <Separator className="ml-14" />}
          ListEmptyComponent={
            <EmptyState
              icon={<BookOpenCheck size={32} color={NAV_THEME.dark.primary} />}
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
                    backgroundColor={NAV_THEME.dark.card}
                    color={NAV_THEME.dark.primary}
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
