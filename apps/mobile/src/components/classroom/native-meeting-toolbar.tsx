import React, { Children, isValidElement, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Ellipsis,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PenLine,
  MessageCircle,
  Users,
  PhoneOff,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

const primary = (label: string) => {
  if (label === 'Mute microphone') return { Icon: Mic, active: true };
  if (label === 'Unmute microphone') return { Icon: MicOff, active: false };
  if (label === 'Stop video') return { Icon: Video, active: true };
  if (label === 'Start video') return { Icon: VideoOff, active: false };
  if (label === 'Share screen') return { Icon: ScreenShare, active: false };
  if (label === 'Stop sharing screen') return { Icon: ScreenShareOff, active: true };
  if (label === 'Whiteboard') return { Icon: PenLine, active: false };
  if (label === 'Messages') return { Icon: MessageCircle, active: false };
  if (label.startsWith('Participants')) return { Icon: Users, active: false };
  if (label === 'Leave meeting') return { Icon: PhoneOff, active: false, danger: true };
  return null;
};
type ActionProps = {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
};
/** Same primary/More hierarchy as web; actions and authorization remain with the owning screen/API. */
export function NativeMeetingToolbar({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const actions = Children.toArray(children).filter(isValidElement<ActionProps>);
  const secondary = actions.filter((action) => !primary(action.props.accessibilityLabel));
  return (
    <View style={{ gap: 8 }}>
      <View
        accessibilityRole="toolbar"
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {actions.map((action) => {
          const control = primary(action.props.accessibilityLabel);
          if (!control) return null;
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
                width: 48,
                height: 48,
                borderRadius: 24,
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
            </Pressable>
          );
        })}
        {!!secondary.length && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Close more controls' : 'More controls'}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.actionSubtle,
            }}
          >
            <Ellipsis size={22} color={colors.text} />
          </Pressable>
        )}
      </View>
      {expanded && (
        <View
          style={{ backgroundColor: colors.card, borderRadius: 16, padding: 12, gap: 8 }}
        >
          <Text accessibilityRole="header" style={{ color: colors.text }}>
            More controls
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {secondary}
          </View>
        </View>
      )}
    </View>
  );
}
