import React, { useMemo, useState } from 'react';
import { FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Typography,
  SearchBar,
  StyledView,
  StyledText,
  Avatar,
  ListItem,
  EmptyState,
  Separator,
  Chip,
} from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useLearningSpaces } from '@/hooks/use-learning-spaces';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <StyledView className="gap-3 px-4 pb-2 pt-2">
        <Typography variant="h3">Learning Spaces</Typography>
        <SearchBar value={search} onChangeText={setSearch} />
      </StyledView>

      {isLoading ? (
        <StyledView className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4a65e8" />
        </StyledView>
      ) : (
        <FlatList
          data={filteredSpaces}
          keyExtractor={(item: Record<string, unknown>) =>
            item.id as string
          }
          contentContainerStyle={{ paddingHorizontal: 8 }}
          ItemSeparatorComponent={() => <Separator className="ml-14" />}
          ListEmptyComponent={
            <EmptyState
              icon={<StyledText className="text-4xl">📚</StyledText>}
              title="No learning spaces"
              description="Your learning spaces will appear here"
            />
          }
          renderItem={({ item }: { item: Record<string, unknown> }) => {
            const title = (item.title as string) ?? 'Learning Space';
            const subject = (item.subject as string) ?? '';
            const status = (item.status as string) ?? 'active';
            const primaryChannel = item.primary_channel as
              | Record<string, unknown>
              | undefined;
            const channelId = primaryChannel?.id as string | undefined;

            return (
              <ListItem
                leading={<Avatar name={title} size="md" />}
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
