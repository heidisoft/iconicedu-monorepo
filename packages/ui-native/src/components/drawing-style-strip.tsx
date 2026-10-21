import React, { useState } from 'react';
import { X, Palette } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/** Native counterpart of the web drawing style strip, with native touch targets. */
export function DrawingStyleStrip({
  color,
  width,
  fill = 'transparent',
  widths = [1, 2, 4],
  showWidth = true,
  showFill = false,
  foreground,
  background,
  borderColor,
  onStyle,
  onMore,
  onClose,
  open,
  onOpenChange,
}: {
  color: string;
  width: number;
  fill?: string;
  widths?: readonly number[];
  showWidth?: boolean;
  showFill?: boolean;
  foreground: string;
  background?: string;
  borderColor?: string;
  onStyle: (style: {
    strokeColor?: string;
    strokeWidth?: number;
    backgroundColor?: string;
  }) => void;
  onMore: () => void;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const button = {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  if (open === false) return null;
  return (
    <View
      style={{
        maxWidth: '100%',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        padding: 4,
        borderRadius: 28,
        borderWidth: 1,
        borderColor,
        backgroundColor: background,
      }}
    >
      {!collapsed && (
        <ScrollView
          horizontal
          style={{ flexGrow: 0, flexShrink: 1 }}
          accessibilityLabel="Drawing styles"
          contentContainerStyle={{ padding: 4, gap: 4 }}
        >
          {!collapsed && (
            <>
              {showWidth &&
                widths.map((value, index) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`${['Thin', 'Medium', 'Thick'][index]} stroke`}
                    accessibilityState={{ selected: width === value }}
                    onPress={() => onStyle({ strokeWidth: value })}
                    style={button}
                  >
                    <View
                      style={{ width: 20, height: value, backgroundColor: foreground }}
                    />
                  </Pressable>
                ))}
              {Array.from(
                new Set(['#1e293b', '#e03131', '#2f9e44', '#1971c2', '#f08c00', color]),
              ).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`Stroke color ${value}`}
                  accessibilityState={{ selected: color === value }}
                  onPress={() => onStyle({ strokeColor: value })}
                  style={button}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: color === value ? 2 : 0,
                      borderColor: foreground,
                      backgroundColor: value,
                    }}
                  />
                </Pressable>
              ))}
              {showFill && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    fill === 'transparent' ? 'Fill shape' : 'Remove fill'
                  }
                  accessibilityState={{ selected: fill !== 'transparent' }}
                  onPress={() =>
                    onStyle({
                      backgroundColor: fill === 'transparent' ? color : 'transparent',
                    })
                  }
                  style={button}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderWidth: 1,
                      borderColor: foreground,
                      borderRadius: 3,
                      backgroundColor: fill,
                    }}
                  />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More style options"
                onPress={onMore}
                style={button}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill={foreground}>
                  <Circle cx={5} cy={12} r={2} />
                  <Circle cx={12} cy={12} r={2} />
                  <Circle cx={19} cy={12} r={2} />
                </Svg>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Show drawing styles' : 'Close drawing styles'}
        onPress={() => {
          if (open !== undefined) onOpenChange?.(false);
          else setCollapsed(!collapsed);
          if (!collapsed) onClose?.();
        }}
        style={button}
      >
        {collapsed ? (
          <Palette size={20} color={foreground} />
        ) : (
          <X size={20} color={foreground} />
        )}
      </Pressable>
    </View>
  );
}
