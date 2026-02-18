import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Typography,
  SearchBar,
  ListItem,
  Avatar,
  Badge,
  Tabs as TabBar,
  EmptyState,
  Separator,
  NAV_THEME,
} from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/hooks/use-account';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useChannels } from '@/hooks/use-channels';
import type { TabItem } from '@iconicedu/ui-native';

const tabs: TabItem[] = [
  { key: 'dms', label: 'Direct Messages' },
  { key: 'channels', label: 'Channels' },
];

export default function MessagesScreen() {
  const [activeTab, setActiveTab] = useState('dms');
  const [search, setSearch] = useState('');
  const { data: account } = useAccount();
  const router = useRouter();

  const orgId = account?.org_id ?? '';
  const profileId = account?.default_profile_id ?? '';

  const { data: dms, isLoading: dmsLoading } = useDirectMessages(
    orgId,
    profileId,
  );
  const { data: channels, isLoading: channelsLoading } = useChannels(orgId);

  const filteredDms = useMemo(() => {
    if (!dms) return [];
    if (!search) return dms;
    return dms.filter((dm: Record<string, unknown>) => {
      const topic = (dm.topic as string) ?? '';
      return topic.toLowerCase().includes(search.toLowerCase());
    });
  }, [dms, search]);

  const filteredChannels = useMemo(() => {
    if (!channels) return [];
    if (!search) return channels;
    return channels.filter((ch: Record<string, unknown>) => {
      const topic = (ch.topic as string) ?? '';
      return topic.toLowerCase().includes(search.toLowerCase());
    });
  }, [channels, search]);

  const isLoading = activeTab === 'dms' ? dmsLoading : channelsLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV_THEME.dark.background }}>
      <View className="gap-3 px-4 pb-2 pt-2">
        <Typography variant="h3">Messages</Typography>
        <SearchBar value={search} onChangeText={setSearch} />
        <TabBar items={tabs} activeKey={activeTab} onTabPress={setActiveTab} />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={NAV_THEME.dark.primary} />
        </View>
      ) : activeTab === 'dms' ? (
        <FlatList
          data={filteredDms}
          keyExtractor={(item: Record<string, unknown>) =>
            item.id as string
          }
          contentContainerStyle={{ paddingHorizontal: 8 }}
          ItemSeparatorComponent={() => <Separator className="ml-14" />}
          ListEmptyComponent={
            <EmptyState
              icon={<Text className="text-4xl">💬</Text>}
              title="No direct messages"
              description="Start a conversation with someone"
            />
          }
          renderItem={({ item }: { item: Record<string, unknown> }) => {
            const topic = (item.topic as string) ?? 'Direct Message';
            const unreadCount = (item.unread_count as number) ?? 0;
            return (
              <ListItem
                leading={<Avatar name={topic} size="md" />}
                title={topic}
                subtitle="Tap to open conversation"
                trailing={
                  unreadCount > 0 ? (
                    <Badge count={unreadCount} variant="info" />
                  ) : undefined
                }
                onPress={() =>
                  router.push(`/(app)/dm/${item.id as string}`)
                }
              />
            );
          }}
        />
      ) : (
        <FlatList
          data={filteredChannels}
          keyExtractor={(item: Record<string, unknown>) =>
            item.id as string
          }
          contentContainerStyle={{ paddingHorizontal: 8 }}
          ItemSeparatorComponent={() => <Separator className="ml-14" />}
          ListEmptyComponent={
            <EmptyState
              icon={<Text className="text-4xl">📢</Text>}
              title="No channels"
              description="Channels you join will appear here"
            />
          }
          renderItem={({ item }: { item: Record<string, unknown> }) => {
            const topic = (item.topic as string) ?? 'Channel';
            return (
              <ListItem
                leading={<Avatar name={topic} size="md" />}
                title={topic}
                subtitle={(item.description as string) ?? ''}
                onPress={() =>
                  router.push(`/(app)/channel/${item.id as string}`)
                }
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
