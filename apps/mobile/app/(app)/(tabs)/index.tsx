import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
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
  { label: 'Messages', icon: '💬', route: '/(app)/(tabs)/messages', desc: 'Your conversations' },
  { label: 'Inbox',    icon: '🔔', route: '/(app)/(tabs)/inbox',    desc: 'Activity & alerts' },
  { label: 'Spaces',   icon: '📚', route: '/(app)/spaces',           desc: 'Learning spaces' },
  { label: 'Account',  icon: '👤', route: '/(app)/(tabs)/account',  desc: 'Profile & settings' },
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
    gridIcon:     { fontSize: 24 },
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

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity style={s.avatar} onPress={() => router.push('/(app)/(tabs)/account')} activeOpacity={0.8} accessibilityLabel="Open account">
            <Text style={s.avatarTxt}>{initial}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bellBtn} onPress={() => router.push('/(app)/(tabs)/inbox')} activeOpacity={0.8} accessibilityLabel="Open inbox">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M18 8C18 6.4 17.37 4.87 16.24 3.76C15.13 2.63 13.6 2 12 2C10.4 2 8.87 2.63 7.76 3.76C6.63 4.87 6 6.4 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
                stroke={colors.text} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
              <Path d="M13.73 21C13.55 21.3 13.3 21.55 13 21.72C12.7 21.89 12.35 21.97 12 21.97C11.65 21.97 11.3 21.89 11 21.72C10.7 21.55 10.45 21.3 10.27 21"
                stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
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
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M9 11L12 14L22 4" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M21 12V19C21 19.53 20.79 20.04 20.41 20.41C20.04 20.79 19.53 21 19 21H5C4.47 21 3.96 20.79 3.59 20.41C3.21 20.04 3 19.53 3 19V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H16" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={s.taskText}>View your messages & channels</Text>
            </View>
            <TouchableOpacity style={s.arrowBtn} onPress={() => router.push('/(app)/(tabs)/messages')} activeOpacity={0.8}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M7 17L17 7M17 7H7M17 7V17" stroke={colors.tealFg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
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
                <Text style={s.gridIcon}>{item.icon}</Text>
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
