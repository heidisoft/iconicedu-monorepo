import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Typography,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Avatar,
  NAV_THEME,
} from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-provider';
import { useAccount } from '@/hooks/use-account';

type QuickNavItem = {
  label: string;
  icon: string;
  route: string;
  description: string;
};

const quickNavItems: QuickNavItem[] = [
  {
    label: 'Messages',
    icon: '💬',
    route: '/(app)/(tabs)/messages',
    description: 'View your conversations',
  },
  {
    label: 'Schedule',
    icon: '📅',
    route: '/(app)/(tabs)/schedule',
    description: 'Upcoming classes',
  },
  {
    label: 'Learning Spaces',
    icon: '📚',
    route: '/(app)/spaces',
    description: 'Your learning spaces',
  },
  {
    label: 'Inbox',
    icon: '📥',
    route: '/(app)/(tabs)/inbox',
    description: 'Activity feed',
  },
];

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { data: account } = useAccount();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV_THEME.dark.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Typography variant="h3">
              Welcome back
            </Typography>
            <Typography variant="muted">
              {user?.email}
            </Typography>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            accessibilityLabel="Open profile"
          >
            <Avatar
              name={user?.email?.split('@')[0]}
              size="lg"
              status="online"
            />
          </Pressable>
        </View>

        <View className="gap-3">
          <Typography variant="label">Quick Navigation</Typography>
          <View className="flex-row flex-wrap gap-3">
            {quickNavItems.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => router.push(item.route as never)}
                className="w-[48%] rounded-2xl border border-border bg-card p-4 active:bg-accent"
                accessibilityLabel={item.label}
              >
                <Text className="mb-2 text-2xl">{item.icon}</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {item.label}
                </Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Explore your learning dashboard and connect with educators.
            </CardDescription>
          </CardHeader>
        </Card>

        <Button
          label="Sign Out"
          variant="ghost"
          onPress={signOut}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
