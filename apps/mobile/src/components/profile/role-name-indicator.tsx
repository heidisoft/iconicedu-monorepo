import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type TextProps,
} from 'react-native';
import { IdCardLanyard } from 'lucide-react-native';

import { useTheme } from '@/providers/theme-provider';

type RoleNameIndicatorProps = {
  name: string;
  role?: string | null;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  iconSize?: number;
  numberOfLines?: TextProps['numberOfLines'];
  ellipsizeMode?: TextProps['ellipsizeMode'];
  textTestID?: string;
};

function isStaffRole(role?: string | null) {
  return role === 'staff';
}

export function RoleNameIndicator({
  name,
  role,
  textStyle,
  containerStyle,
  iconSize = 13,
  numberOfLines,
  ellipsizeMode = 'tail',
  textTestID,
}: RoleNameIndicatorProps) {
  const { colors } = useTheme();
  const showStaffIcon = isStaffRole(role);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideTooltip = React.useCallback(() => {
    setShowTooltip(false);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleStaffPress = React.useCallback(() => {
    setShowTooltip(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowTooltip(false);
      hideTimerRef.current = null;
    }, 1600);
  }, []);

  React.useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return (
    <View style={[s.row, containerStyle]}>
      <Text
        style={[s.textBase, textStyle]}
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        testID={textTestID}
      >
        {name}
      </Text>
      {showStaffIcon ? (
        <View style={s.iconWrap}>
          {showTooltip ? (
            <Pressable
              style={s.tooltipOverlay}
              onPress={hideTooltip}
              testID="staff-tooltip"
            >
              <View
                style={[
                  s.tooltipBubble,
                  {
                    backgroundColor: colors.text,
                  },
                ]}
              >
                <Text style={[s.tooltipText, { color: colors.pageBg }]}>
                  Staff member
                </Text>
              </View>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleStaffPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Staff member"
          >
            <IdCardLanyard
              testID="staff-name-indicator"
              size={iconSize}
              color={colors.textMuted}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
    position: 'relative',
  },
  textBase: {
    flexShrink: 1,
    minWidth: 0,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipOverlay: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  tooltipBubble: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
