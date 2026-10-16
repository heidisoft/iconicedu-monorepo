import React, { Children, isValidElement, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import {
  Ellipsis,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageCircle,
  PhoneOff,
  OctagonX,
  Settings,
  MonitorUp,
  MonitorX,
  Pencil,
  Presentation,
  Users,
  Share,
  Captions,
  PictureInPicture2,
  Circle,
  Pause,
  Play,
  Square,
  ShieldCheck,
  Maximize2,
  ChevronRight,
} from 'lucide-react-native';
import { NativeMeetingSheet } from './native-meeting-sheets';
import { useTheme } from '@/providers/theme-provider';

const primary = (label: string) => {
  if (label === 'Mute microphone') return { Icon: Mic, active: true };
  if (label === 'Unmute microphone') return { Icon: MicOff, active: false };
  if (label === 'Stop video') return { Icon: Video, active: true };
  if (label === 'Start video') return { Icon: VideoOff, active: false };
  if (label === 'Share screen') return { Icon: MonitorUp, active: false };
  if (label === 'Stop sharing screen') return { Icon: MonitorX, active: true };
  if (label === 'Leave class' || label === 'Leave or end class')
    return { Icon: PhoneOff, active: false, danger: true };
  if (label === 'End class') return { Icon: OctagonX, active: false, danger: true };
  return null;
};
const menuItem = (label: string) => {
  if (label === 'Settings' || label === 'Audio settings')
    return { Icon: Settings, title: 'Settings' };
  if (label === 'Share screen') return { Icon: MonitorUp, title: 'Share screen' };
  if (label === 'Stop sharing screen')
    return { Icon: MonitorX, title: 'Stop sharing', active: true };
  if (label === 'Whiteboard' || label === 'Return to whiteboard')
    return { Icon: Presentation, title: label };
  if (label.startsWith('Messages'))
    return { Icon: MessageCircle, title: label.replace('Messages', 'Chat') };
  if (label === 'Expand whiteboard') return { Icon: Maximize2, title: 'Expand board' };
  if (label.startsWith('Participants'))
    return { Icon: Users, title: label.replace('Participants', 'People') };
  if (label === 'Invite') return { Icon: Share, title: 'Invite' };
  if (label.includes('captions'))
    return { Icon: Captions, title: 'Captions', active: label.endsWith('off') };
  if (label === 'Open floating call')
    return { Icon: PictureInPicture2, title: 'Floating call' };
  if (label.endsWith('participant annotations'))
    return { Icon: ShieldCheck, title: label, host: true };
  if (label.includes('annotat'))
    return {
      Icon: Pencil,
      title: label.startsWith('Stop') ? 'Stop annotating' : 'Annotate',
      active: label.startsWith('Stop'),
    };
  if (label === 'Expand shared screen')
    return { Icon: Maximize2, title: 'Expand screen' };
  if (label === 'Claim host') return { Icon: ShieldCheck, title: label, host: true };
  if (label.toLowerCase().includes('recording'))
    return {
      Icon:
        label === 'Stop recording'
          ? Square
          : label === 'Pause recording'
            ? Pause
            : label === 'Resume recording'
              ? Play
              : Circle,
      title: label,
      host: true,
    };
  return { Icon: Settings, title: label };
};
type ActionProps = {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
};
/** Keep the call bar compact; secondary actions live in a native sheet. */
export function NativeMeetingToolbar({
  children,
  more,
}: {
  children: React.ReactNode;
  more?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const completeDismissal = () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  };
  const actions = Children.toArray(children).filter(isValidElement<ActionProps>);
  const pinned = (label: string) =>
    /^(Mute microphone|Unmute microphone|Stop video|Start video|Share screen|Stop sharing screen|Leave class|Leave or end class|End class)/.test(
      label,
    );
  const secondary = actions.filter((action) => !pinned(action.props.accessibilityLabel));
  return (
    <View style={{ gap: 8 }}>
      <View
        accessibilityRole="toolbar"
        style={{
          flexDirection: 'row',
          flexWrap: 'nowrap',
          justifyContent: 'space-around',
          gap: 4,
        }}
      >
        {actions.map((action) => {
          const control = primary(action.props.accessibilityLabel);
          if (!control || !pinned(action.props.accessibilityLabel)) return null;
          const { Icon } = control;
          return (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.props.accessibilityLabel}
              accessibilityState={{
                disabled: !!action.props.disabled,
                selected: control.active,
              }}
              disabled={action.props.disabled}
              onPress={action.props.onPress}
              style={{
                flex: 1,
                minHeight: 56,
                borderRadius: 16,
                gap: 4,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: control.danger ? colors.red : colors.actionSubtle,
                opacity: action.props.disabled ? 0.5 : 1,
              }}
            >
              <Icon
                size={22}
                color={control.danger ? colors.primaryForeground : colors.text}
              />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  color: control.danger ? colors.primaryForeground : colors.text,
                }}
              >
                {action.props.accessibilityLabel.includes('microphone')
                  ? control.active
                    ? 'Mute'
                    : 'Unmute'
                  : action.props.accessibilityLabel.includes('video')
                    ? control.active
                      ? 'Stop video'
                      : 'Start video'
                    : action.props.accessibilityLabel.startsWith('Messages')
                      ? 'Chat'
                      : action.props.accessibilityLabel.includes('sharing') ||
                          action.props.accessibilityLabel === 'Share screen'
                        ? control.active
                          ? 'Stop share'
                          : 'Share'
                        : 'Leave'}
              </Text>
            </Pressable>
          );
        })}
        {(!!secondary.length || !!more) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Close more controls' : 'More controls'}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={{
              flex: 1,
              minHeight: 56,
              borderRadius: 16,
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.actionSubtle,
            }}
          >
            <Ellipsis size={22} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 11 }}>More</Text>
          </Pressable>
        )}
      </View>
      <NativeMeetingSheet
        open={expanded}
        compact
        title="More controls"
        onClose={() => setExpanded(false)}
        onDismiss={completeDismissal}
      >
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}
        >
          {more}
          {[false, true].map((host) => {
            const group = secondary.filter(
              (action) => !!menuItem(action.props.accessibilityLabel).host === host,
            );
            if (!group.length) return null;
            return (
              <View key={String(host)} style={{ gap: 8 }}>
                {host && (
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      fontWeight: '600',
                      paddingTop: 8,
                    }}
                  >
                    HOST CONTROLS
                  </Text>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    ...(host ? { borderTopWidth: 1, borderTopColor: colors.border } : {}),
                  }}
                >
                  {group.map((action) => {
                    const item = menuItem(action.props.accessibilityLabel);
                    return (
                      <Pressable
                        key={action.key}
                        accessibilityRole="button"
                        accessibilityLabel={action.props.accessibilityLabel}
                        accessibilityState={{
                          disabled: !!action.props.disabled,
                          selected: !!item.active,
                        }}
                        disabled={action.props.disabled}
                        onPress={() => {
                          pendingAction.current = action.props.onPress;
                          setExpanded(false);
                          if (Platform.OS !== 'ios') completeDismissal();
                        }}
                        style={{
                          width: host ? '100%' : '33.333%',
                          minHeight: host ? 48 : 84,
                          padding: 8,
                          flexDirection: host ? 'row' : 'column',
                          alignItems: 'center',
                          justifyContent: host ? 'flex-start' : 'center',
                          gap: 8,
                          opacity: action.props.disabled ? 0.45 : 1,
                        }}
                      >
                        <View
                          style={{
                            width: host ? 28 : 44,
                            height: host ? 28 : 44,
                            borderRadius: 14,
                            backgroundColor: item.active
                              ? colors.action
                              : colors.actionSubtle,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <item.Icon
                            size={20}
                            color={item.active ? colors.actionForeground : colors.text}
                          />
                        </View>
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 12,
                            textAlign: host ? 'left' : 'center',
                            ...(host ? { flex: 1 } : {}),
                          }}
                        >
                          {item.title}
                        </Text>
                        {host && <ChevronRight size={16} color={colors.textMuted} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </NativeMeetingSheet>
    </View>
  );
}
