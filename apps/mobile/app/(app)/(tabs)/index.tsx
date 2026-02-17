import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Typography,
  StyledView,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Avatar,
  StyledPressable,
  StyledText,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 24 }}>
        <StyledView className="flex-row items-center justify-between">
          <StyledView className="gap-1">
            <Typography variant="h3">
              Welcome back
            </Typography>
            <Typography variant="muted">
              {user?.email}
            </Typography>
          </StyledView>
          <StyledPressable
            onPress={() => router.push('/(app)/profile')}
            accessibilityLabel="Open profile"
          >
            <Avatar
              name={user?.email?.split('@')[0]}
              size="lg"
              status="online"
            />
          </StyledPressable>
        </StyledView>

        <StyledView className="gap-3">
          <Typography variant="label">Quick Navigation</Typography>
          <StyledView className="flex-row flex-wrap gap-3">
            {quickNavItems.map((item) => (
              <StyledPressable
                key={item.label}
                onPress={() => router.push(item.route as never)}
                className="w-[48%] rounded-2xl border border-slate-800 bg-slate-900 p-4 active:bg-slate-800"
                accessibilityLabel={item.label}
              >
                <StyledText className="mb-2 text-2xl">{item.icon}</StyledText>
                <StyledText className="text-sm font-semibold text-white">
                  {item.label}
                </StyledText>
                <StyledText className="mt-0.5 text-xs text-slate-400">
                  {item.description}
                </StyledText>
              </StyledPressable>
            ))}
          </StyledView>
        </StyledView>

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
