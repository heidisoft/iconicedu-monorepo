import { NativeControlPop } from './native-meeting-motion';
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
} from 'lucide-react-native';
import { NativeMeetingSheet } from './native-meeting-sheets';
import { useTheme } from '@/providers/theme-provider';

const primary = (label: string) => {
  if (label === 'Mute microphone') return { Icon: Mic, active: true };
  if (label === 'Unmute microphone') return { Icon: MicOff, active: false, muted: true };
  if (label === 'Stop video') return { Icon: Video, active: true };
  if (label === 'Start video') return { Icon: VideoOff, active: false, muted: true };
  if (label === 'Whiteboard' || label === 'Return to whiteboard')
    return { Icon: Presentation, active: false };
  if (label === 'Annotate screen' || label === 'Stop annotating')
    return { Icon: Pencil, active: label.startsWith('Stop') };
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
  if (label === 'Stop presenting whiteboard')
    return { Icon: Presentation, title: label, active: true };
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
  accessibilityState?: { selected?: boolean };
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
    /^(Mute microphone|Unmute microphone|Stop video|Start video|Share screen|Stop sharing screen|Whiteboard|Return to whiteboard|Annotate screen|Stop annotating|Leave class|Leave or end class|End class)/.test(
      label,
    );
  const priority = (label: string) =>
    label.includes('microphone')
      ? 0
      : label === 'Start video' || label === 'Stop video'
        ? 1
        : label.includes('whiteboard') || label === 'Whiteboard'
          ? 2
          : label.includes('annotat')
            ? 3
            : label.includes('screen')
              ? 4
              : 5;
  actions.sort(
    (a, b) => priority(a.props.accessibilityLabel) - priority(b.props.accessibilityLabel),
  );
  const secondary = actions.filter((action) => !pinned(action.props.accessibilityLabel));
  const menuPriority = (label: string) =>
    label.toLowerCase().includes('recording')
      ? 0
      : label.includes('whiteboard')
        ? 1
        : label === 'Open floating call'
          ? 2
          : label.includes('captions')
            ? 3
            : label === 'Settings'
              ? 10
              : 5;
  secondary.sort(
    (a, b) =>
      menuPriority(a.props.accessibilityLabel) - menuPriority(b.props.accessibilityLabel),
  );
  const renderControl = (action: (typeof actions)[number]) => {
    const control = primary(action.props.accessibilityLabel);
    if (!control || !pinned(action.props.accessibilityLabel)) return null;
    const { Icon } = control;
    const active = action.props.accessibilityState?.selected ?? control.active;
    const emphasized =
      !!control.danger ||
      !!control.muted ||
      (active && action.props.accessibilityLabel === 'Whiteboard');
    return (
      <Pressable
        key={action.key}
        accessibilityRole="button"
        accessibilityLabel={action.props.accessibilityLabel}
        accessibilityState={{
          disabled: !!action.props.disabled,
          selected: active,
        }}
        disabled={action.props.disabled}
        onPress={action.props.onPress}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          gap: 4,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            control.danger || control.muted
              ? colors.red
              : emphasized
                ? colors.action
                : colors.actionSubtle,
          opacity: action.props.disabled ? 0.5 : 1,
        }}
      >
        <NativeControlPop value={active}>
          <Icon size={22} color={emphasized ? colors.primaryForeground : colors.text} />
        </NativeControlPop>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 8 }}>
      <View
        accessibilityRole="toolbar"
        style={{
          flexDirection: 'row',
          flexWrap: 'nowrap',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {actions
          .filter((action) => !primary(action.props.accessibilityLabel)?.danger)
          .map(renderControl)}
        {(!!secondary.length || !!more) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Close more controls' : 'More controls'}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.actionSubtle,
            }}
          >
            <Ellipsis size={22} color={colors.text} />
          </Pressable>
        )}
        {actions
          .filter((action) => primary(action.props.accessibilityLabel)?.danger)
          .map(renderControl)}
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
          {secondary.map((action) => {
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
                  width: '100%',
                  minHeight: 48,
                  padding: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 8,
                  opacity: action.props.disabled ? 0.45 : 1,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: item.active ? colors.action : colors.actionSubtle,
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
                    fontSize: 16,
                    textAlign: 'left',
                    flex: 1,
                  }}
                >
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </NativeMeetingSheet>
    </View>
  );
}
