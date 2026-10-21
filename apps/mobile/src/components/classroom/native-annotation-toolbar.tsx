import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import {
  Hand,
  MousePointer2,
  Pencil,
  Type,
  Eraser,
  Shapes,
  Minus,
  ArrowRight,
  ArrowLeftRight,
  Square,
  Circle,
  Diamond,
  Highlighter,
  Stamp,
  Check,
  X,
  Star,
  Heart,
  CircleHelp,
  LocateFixed,
  MoveUpRight,
  Undo2,
  Redo2,
  Palette,
  Ellipsis,
  ChevronDown,
} from 'lucide-react-native';
import { LaserPointerIcon } from '@iconicedu/ui-native';
import type { AnnotationTool } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
const primary = [
  ['cursor', 'Pan', Hand],
  ['vanishingPen', 'Laser pointer', LaserPointerIcon],
  ['select', 'Select', MousePointer2],
  ['pen', 'Pen', Pencil],
  ['text', 'Text', Type],
  ['eraser', 'Eraser', Eraser],
] as const;
const shapes = [
  ['line', 'Line', Minus],
  ['arrow', 'Arrow', ArrowRight],
  ['doubleArrow', 'Double arrow', ArrowLeftRight],
  ['rectangle', 'Rectangle', Square],
  ['ellipse', 'Ellipse', Circle],
  ['diamond', 'Diamond', Diamond],
  ['rectangleFilled', 'Filled rectangle', Square],
  ['ellipseFilled', 'Filled ellipse', Circle],
  ['rectangleHighlight', 'Rectangle highlight', Square],
  ['ellipseHighlight', 'Ellipse highlight', Circle],
] as const;
const stamps = [
  ['stampCheck', 'Check', Check],
  ['stampX', 'Cross', X],
  ['stampStar', 'Star', Star],
  ['stampHeart', 'Heart', Heart],
  ['stampQuestion', 'Question', CircleHelp],
  ['stampArrow', 'Stamp arrow', ArrowRight],
] as const;
const attention = [
  ['spotlight', 'Spotlight', LocateFixed],
  ['pointerArrow', 'Named pointer', MoveUpRight],
] as const;
export function NativeAnnotationToolbar({
  availableWidth,
  availableHeight,
  tool,
  editable,
  onTool,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOptions,
  onOpenMenu,
  panelSide = 'bottom',
  panelOffset = 104,
  panelWidth = 260,
}: {
  availableWidth?: number;
  availableHeight?: number;
  tool: AnnotationTool;
  editable: boolean;
  onTool: (tool: AnnotationTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOptions: (panel: 'format' | 'more') => void;
  onOpenMenu?: () => void;
  panelSide?: 'top' | 'bottom';
  panelOffset?: number;
  panelWidth?: number;
}) {
  const { colors } = useTheme();
  const size = useWindowDimensions();
  const spacious =
    (availableWidth ?? size.width) >= 760 && (availableHeight ?? size.height) >= 600;
  const [menu, setMenu] = useState<string | null>(null);
  const button = (
    label: string,
    Icon: React.ComponentType<{ size?: number; color?: string }>,
    onPress: () => void,
    disabled = false,
    selected = false,
    dropdown = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled,
        selected,
        ...(dropdown ? { expanded: menu === label } : {}),
      }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: 44,
        height: 44,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.actionSubtle : undefined,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon size={20} color={colors.text} />
      {dropdown && <ChevronDown size={12} color={colors.text} />}
    </Pressable>
  );
  const choose = (value: AnnotationTool) => {
    onTool(value);
    setMenu(null);
  };
  const toggle = (value: string) => {
    onOpenMenu?.();
    setMenu(menu === value ? null : value);
  };
  const group = menu === 'Shapes' ? shapes : menu === 'Stamps' ? stamps : attention;
  return (
    <View style={{ height: 44 }}>
      <ScrollView
        horizontal
        accessibilityLabel="Screen annotation tools"
        style={{ height: 44 }}
        contentContainerStyle={{ gap: 2, paddingHorizontal: 4, alignItems: 'center' }}
      >
        {primary.map(([value, label, Icon]) =>
          button(
            label,
            Icon,
            () => choose(value),
            !editable && value !== 'cursor',
            tool === value,
          ),
        )}
        {spacious &&
          button('Shapes', Shapes, () => toggle('Shapes'), !editable, false, true)}
        {spacious &&
          button(
            'Highlighter',
            Highlighter,
            () => choose('highlighter'),
            !editable,
            tool === 'highlighter',
          )}
        {spacious && button('Redo annotation', Redo2, onRedo, !editable || !canRedo)}
        {button('Undo annotation', Undo2, onUndo, !editable || !canUndo)}
        {button(
          'More annotation actions',
          Ellipsis,
          () => {
            setMenu(null);
            toggle('More annotation actions');
          },
          false,
          false,
          true,
        )}
      </ScrollView>
      {menu && (
        <View
          accessibilityLabel={menu}
          style={{
            position: 'absolute',
            [panelSide === 'bottom' ? 'top' : 'bottom']: panelOffset,
            left: -76,
            width: panelWidth,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 8,
            zIndex: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text }}>{menu}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${menu}`}
              onPress={() => setMenu(null)}
              style={{ padding: 8 }}
            >
              <X size={16} color={colors.text} />
            </Pressable>
          </View>
          {menu === 'More annotation actions' ? (
            <ScrollView style={{ maxHeight: 320 }}>
              {(
                [
                  ['Shapes', Shapes, () => toggle('Shapes')],
                  ['Highlighter', Highlighter, () => choose('highlighter')],
                  ['Stamps', Stamp, () => toggle('Stamps')],
                  ['Attention', LocateFixed, () => toggle('Attention')],
                  ['Redo annotation', Redo2, onRedo],
                  [
                    'Annotation styles',
                    Palette,
                    () => {
                      setMenu(null);
                      onOptions('format');
                    },
                  ],
                  [
                    'Sharing and export',
                    Ellipsis,
                    () => {
                      setMenu(null);
                      onOptions('more');
                    },
                  ],
                ] as const
              ).map(([label, Icon, action]) => (
                <Pressable
                  key={label as string}
                  accessibilityRole="button"
                  accessibilityLabel={label as string}
                  onPress={action as () => void}
                  disabled={
                    label === 'Redo annotation'
                      ? !editable || !canRedo
                      : ['Shapes', 'Highlighter', 'Stamps', 'Attention'].includes(label)
                        ? !editable
                        : false
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 44,
                    padding: 12,
                  }}
                >
                  <Icon size={18} color={colors.text} />
                  <Text style={{ color: colors.text }}>{label as string}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {group.map(([value, label, Icon]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: !editable, selected: tool === value }}
                  disabled={!editable}
                  onPress={() => choose(value)}
                  style={{
                    width: '33.333%',
                    minHeight: 64,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Icon
                    size={20}
                    color={colors.text}
                    fill={label.startsWith('Filled') ? colors.text : 'none'}
                  />
                  <Text style={{ color: colors.text, fontSize: 11, textAlign: 'center' }}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
