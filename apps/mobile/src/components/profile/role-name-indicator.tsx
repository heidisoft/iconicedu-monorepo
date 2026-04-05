import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type TextProps,
} from 'react-native';
import { IdCardLanyard } from 'lucide-react-native';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-native';

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

const STAFF_LABEL = 'STAFF';
const STAFF_TOOLTIP_TEXT_COLOR = '#f8fafc';

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
          <Tooltip delayDuration={0}>
            <TooltipTrigger
              accessibilityRole="button"
              accessibilityLabel={STAFF_LABEL}
              hitSlop={8}
            >
              <IdCardLanyard
                testID="staff-name-indicator"
                size={iconSize}
                color={colors.textMuted}
                strokeWidth={2}
              />
            </TooltipTrigger>
            <TooltipContent
              testID="staff-tooltip"
              sideOffset={6}
              className="rounded-full px-2.5 py-1"
            >
              <Text style={[s.tooltipText, { color: STAFF_TOOLTIP_TEXT_COLOR }]}>
                {STAFF_LABEL}
              </Text>
            </TooltipContent>
          </Tooltip>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
