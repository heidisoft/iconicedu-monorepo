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
        <IdCardLanyard
          testID="staff-name-indicator"
          size={iconSize}
          color={colors.textMuted}
          strokeWidth={2}
        />
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
  },
  textBase: {
    flexShrink: 1,
    minWidth: 0,
  },
});
