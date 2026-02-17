import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Typography,
  Avatar,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Separator,
  StyledView,
  StyledText,
  ListItem,
} from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-provider';
import { useAccount } from '@/hooks/use-account';

type SettingsItem = {
  label: string;
  icon: string;
};

const settingsItems: SettingsItem[] = [
  { label: 'Edit Profile', icon: '👤' },
  { label: 'Notifications', icon: '🔔' },
  { label: 'Privacy & Security', icon: '🔒' },
  { label: 'Appearance', icon: '🎨' },
  { label: 'Help & Support', icon: '❓' },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { data: account } = useAccount();
  const router = useRouter();

  const displayName = user?.email?.split('@')[0] ?? 'User';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <StyledView className="flex-row items-center gap-3 border-b border-slate-800 px-4 pb-3 pt-2">
        <Button
          label="Close"
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
        />
        <Typography variant="h4" className="flex-1 text-center">
          Profile
        </Typography>
        <StyledView className="w-14" />
      </StyledView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 24 }}
      >
        <StyledView className="items-center gap-3 py-4">
          <Avatar name={displayName} size="xl" status="online" />
          <StyledView className="items-center gap-1">
            <Typography variant="h3">{displayName}</Typography>
            <Typography variant="muted">{user?.email}</Typography>
          </StyledView>
        </StyledView>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <StyledView className="gap-1">
              {settingsItems.map((item, index) => (
                <React.Fragment key={item.label}>
                  <ListItem
                    leading={<StyledText className="text-lg">{item.icon}</StyledText>}
                    title={item.label}
                    trailing={
                      <StyledText className="text-slate-500">{'›'}</StyledText>
                    }
                  />
                  {index < settingsItems.length - 1 && (
                    <Separator className="ml-10" />
                  )}
                </React.Fragment>
              ))}
            </StyledView>
          </CardContent>
        </Card>

        <Button
          label="Sign Out"
          variant="destructive"
          size="lg"
          onPress={signOut}
        />

        <Typography variant="caption" className="text-center">
          IconicEdu Mobile v0.1.0
        </Typography>
      </ScrollView>
    </SafeAreaView>
  );
}
