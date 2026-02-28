import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, ClipboardCheck, ArrowUpRight, MessageCircle, BookOpen, User } from 'lucide-react-native';
import { SectionCard } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const quickNav = [
  { label: 'Messages', Icon: MessageCircle, route: '/(app)/(tabs)/messages', desc: 'Your conversations' },
  { label: 'Inbox',    Icon: Bell,          route: '/(app)/(tabs)/inbox',    desc: 'Activity & alerts' },
  { label: 'Spaces',   Icon: BookOpen,      route: '/(app)/spaces',           desc: 'Learning spaces' },
  { label: 'Account',  Icon: User,          route: '/(app)/(tabs)/account',  desc: 'Profile & settings' },
] as const;

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: C.pageBg },
    scroll:       { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 22 },
    avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:    { color: C.tealFg, fontWeight: '800', fontSize: 18 },
    bellBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: C.tealBg, alignItems: 'center', justifyContent: 'center' },
    greetingLine: { fontSize: 15, color: C.textMuted, fontWeight: '500' },
    headline:     { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, lineHeight: 34 },
    taskCard:     { borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    taskInner:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    taskLeft:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    taskText:     { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
    arrowBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
    grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem:     { width: '47%', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, gap: 6 },
    gridLabel:    { fontSize: 14, fontWeight: '700', color: C.text },
    gridDesc:     { fontSize: 12, color: C.textMuted, lineHeight: 17 },
    featureTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    featureDesc:  { fontSize: 13, color: C.textMuted, lineHeight: 20 },
    featureCTA:   { marginTop: 8, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start' },
    featureCTATxt:{ fontSize: 14, fontWeight: '700', color: C.tealFg },
  });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const displayName = user?.email?.split('@')[0] ?? 'there';
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity style={s.avatar} onPress={() => router.push('/(app)/(tabs)/account')} activeOpacity={0.8} accessibilityLabel="Open account">
            <Text style={s.avatarTxt}>{initial}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bellBtn} onPress={() => router.push('/(app)/(tabs)/inbox')} activeOpacity={0.8} accessibilityLabel="Open inbox">
            <Bell size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={{ gap: 6 }}>
          <Text style={s.greetingLine}>{getGreeting()}, {displayName} 👋</Text>
          <Text style={s.headline}>{"Here's your\nlearning plan for today"}</Text>
        </View>

        {/* Task summary card */}
        <View style={s.taskCard}>
          <View style={s.taskInner}>
            <View style={s.taskLeft}>
              <ClipboardCheck size={20} color={colors.text} />
              <Text style={s.taskText}>View your messages & channels</Text>
            </View>
            <TouchableOpacity style={s.arrowBtn} onPress={() => router.push('/(app)/(tabs)/messages')} activeOpacity={0.8}>
              <ArrowUpRight size={16} color={colors.tealFg} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick nav */}
        <View style={{ gap: 10 }}>
          <Text style={s.sectionLabel}>Quick access</Text>
          <View style={s.grid}>
            {quickNav.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={s.gridItem}
                onPress={() => router.push(item.route as never)}
                activeOpacity={0.75}
                accessibilityLabel={item.label}
              >
                <item.Icon size={24} color={colors.text} />
                <Text style={s.gridLabel}>{item.label}</Text>
                <Text style={s.gridDesc}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Welcome card */}
        <SectionCard variant="tint" style={{ borderRadius: 16, gap: 8, backgroundColor: colors.tealBg, borderColor: colors.border }}>
          <Text style={{ fontSize: 30, marginBottom: 4 }}>🎓</Text>
          <Text style={s.featureTitle}>Welcome to IconicEdu</Text>
          <Text style={s.featureDesc}>
            Connect with educators, join learning spaces, and collaborate with your community.
          </Text>
          <TouchableOpacity style={s.featureCTA} onPress={() => router.push('/(app)/(tabs)/messages')} activeOpacity={0.85}>
            <Text style={s.featureCTATxt}>Explore Messages</Text>
          </TouchableOpacity>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
