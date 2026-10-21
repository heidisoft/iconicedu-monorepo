import { DrawingStyleStrip, LaserPointerIcon } from '@iconicedu/ui-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import {
  Hand,
  MousePointer2,
  Pencil,
  Type,
  Eraser,
  Shapes,
  Library,
  Undo2,
  Scan,
  Ellipsis,
  ChevronDown,
  Minus,
  ArrowUpRight,
  Square,
  Circle,
  Diamond,
  Frame,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Binoculars,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
export type Tool =
  | 'hand'
  | 'laser'
  | 'selection'
  | 'freedraw'
  | 'text'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'frame';
type IconType = React.ComponentType<{ size?: number; color?: string }>;
export function NativeWhiteboardToolbar({
  editable,
  ready,
  canClear,
  onCommand,
  onClear,
  styleState,
  onFollow,
  moreContent,
  menu: controlledMenu,
  onMenuChange,
}: {
  editable: boolean;
  ready: boolean;
  canClear: boolean;
  styleState?: {
    tool: Tool;
    color: string;
    width: number;
    fill: string;
    selectionType?: string;
  };
  onCommand: (command: Record<string, unknown>) => void;
  onClear: () => void;
  onFollow?: () => void;
  moreContent?: React.ReactNode;
  menu?: string | null;
  onMenuChange?: (menu: string | null) => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [chosenTool, setTool] = useState<Tool>('laser');
  const [localMenu, setLocalMenu] = useState<string | null>(null);
  const menu = controlledMenu === undefined ? localMenu : controlledMenu;
  const setMenu = (value: string | null) => {
    setLocalMenu(value);
    onMenuChange?.(value);
  };
  const toggle = (value: string) => setMenu(menu === value ? null : value);
  const tool = styleState?.tool ?? chosenTool;
  const styleTool = styleState?.selectionType ?? tool;
  const [grid, setGrid] = useState('dots');
  const [snap, setSnap] = useState(false);
  const [stylesVisible, setStylesVisible] = useState(true);
  const choose = (value: Tool) => {
    setStylesVisible((visible) => (value === tool ? !visible : true));
    setTool(value);
    setMenu(null);
    onCommand({ type: 'tool', tool: value });
  };
  const primary = [
    ['hand', 'Pan', Hand],
    ['laser', 'Laser pointer', LaserPointerIcon],
    ['selection', 'Select', MousePointer2],
    ['freedraw', 'Pen', Pencil],
    ['text', 'Text', Type],
    ['eraser', 'Eraser', Eraser],
  ] as const;
  const shapes = [
    ['line', 'Line', Minus],
    ['arrow', 'Arrow', ArrowUpRight],
    ['rectangle', 'Rectangle', Square],
    ['ellipse', 'Ellipse', Circle],
    ['diamond', 'Diamond', Diamond],
    ['frame', 'Frame', Frame],
  ] as const;
  const button = (
    label: string,
    Icon: IconType,
    action: () => void,
    disabled = false,
    selected = false,
    dropdown = false,
    item = false,
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
      onPress={action}
      style={{
        minWidth: 44,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: item ? 'flex-start' : 'center',
        gap: 8,
        paddingHorizontal: item ? 12 : 4,
        borderRadius: item ? 12 : 22,
        backgroundColor: selected ? colors.actionSubtle : undefined,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon size={16} color={colors.text} />
      {item && <Text style={{ color: colors.text, flexShrink: 1 }}>{label}</Text>}
      {dropdown && Icon !== ChevronDown && Icon !== Ellipsis && (
        <ChevronDown size={10} color={colors.text} />
      )}
    </Pressable>
  );
  const item = (
    label: string,
    Icon: IconType,
    action: () => void,
    disabled = false,
    selected = false,
  ) => button(label, Icon, action, disabled, selected, false, true);
  return (
    <View style={{ zIndex: 4 }}>
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Whiteboard tools"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 28,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 4,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1, minWidth: 0 }}
          contentContainerStyle={{ alignItems: 'center', gap: 2 }}
        >
          {primary.map(([value, label, Icon]) =>
            button(
              label,
              Icon,
              () => choose(value),
              !ready || (!editable && value !== 'hand'),
              tool === value,
            ),
          )}
          {button('Undo', Undo2, () => onCommand({ type: 'undo' }), !ready || !editable)}
        </ScrollView>
        {button(
          'More whiteboard actions',
          Ellipsis,
          () => toggle('More whiteboard actions'),
          false,
          false,
          true,
        )}
      </View>
      {editable && !['hand', 'laser', 'eraser', 'selection'].includes(styleTool) && (
        <DrawingStyleStrip
          open={stylesVisible}
          onOpenChange={setStylesVisible}
          color={styleState?.color ?? '#1e293b'}
          width={styleState?.width ?? 2}
          fill={styleState?.fill}
          foreground={colors.text}
          background={colors.card}
          borderColor={colors.border}
          showWidth={styleTool !== 'text'}
          showFill={['rectangle', 'ellipse', 'diamond'].includes(styleTool)}
          onStyle={(style) => onCommand({ type: 'style', style })}
          onClose={() => onCommand({ type: 'close-style-options' })}
          onMore={() => onCommand({ type: 'style-options' })}
        />
      )}
      {menu && (
        <View
          style={{
            position: 'absolute',
            top: 58,
            right: 0,
            width: '100%',
            maxWidth: 320,
            maxHeight: height * 0.5,
            padding: 8,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              accessibilityRole="header"
              style={{ flex: 1, color: colors.text, paddingHorizontal: 8 }}
            >
              {menu}
            </Text>
            {button(`Close ${menu}`, X, () => setMenu(null))}
          </View>
          <ScrollView
            accessibilityLabel={`${menu} menu`}
            keyboardShouldPersistTaps="handled"
          >
            {menu === 'Shapes' &&
              shapes.map(([value, label, Icon]) =>
                item(label, Icon, () => choose(value), !editable, tool === value),
              )}
            {menu === 'View controls' && (
              <>
                {(['none', 'dots', 'lines'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={
                      value === 'none'
                        ? 'No grid'
                        : value === 'dots'
                          ? 'Dot grid'
                          : 'Line grid'
                    }
                    accessibilityState={{ checked: grid === value }}
                    onPress={() => {
                      setGrid(value);
                      onCommand({ type: 'grid', grid: value, snap });
                    }}
                    style={{ minHeight: 44, padding: 12 }}
                  >
                    <Text style={{ color: colors.text }}>
                      {grid === value ? '✓ ' : ''}
                      {value === 'none'
                        ? 'No grid'
                        : value === 'dots'
                          ? 'Dot grid'
                          : 'Line grid'}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Snap to grid"
                  accessibilityState={{ checked: snap }}
                  onPress={() => {
                    setSnap(!snap);
                    onCommand({ type: 'grid', grid, snap: !snap });
                  }}
                  style={{ minHeight: 44, padding: 12 }}
                >
                  <Text style={{ color: colors.text }}>
                    {snap ? '✓ ' : ''}Snap to grid
                  </Text>
                </Pressable>
                {item('Fit content', Scan, () => onCommand({ type: 'fit' }))}
                {item('Zoom in', ZoomIn, () => onCommand({ type: 'zoom', delta: 0.1 }))}
                {item('Zoom out', ZoomOut, () =>
                  onCommand({ type: 'zoom', delta: -0.1 }),
                )}
                {item('Reset zoom to 100%', RotateCcw, () =>
                  onCommand({ type: 'reset-zoom' }),
                )}
              </>
            )}
            {menu === 'More whiteboard actions' && (
              <>
                {item('Shapes', Shapes, () => toggle('Shapes'), !ready || !editable)}
                {item(
                  'Library',
                  Library,
                  () => {
                    setMenu(null);
                    onCommand({ type: 'library' });
                  },
                  !ready,
                )}
                {item('View controls', Scan, () => toggle('View controls'), !ready)}
                {onFollow &&
                  item(
                    'Focus tutor',
                    Binoculars,
                    () => {
                      setMenu(null);
                      onFollow();
                    },
                    !ready,
                  )}
                {moreContent}
                {item(
                  'Redo',
                  Redo2,
                  () => onCommand({ type: 'redo' }),
                  !ready || !editable,
                )}
                {canClear && item('Clear board', Trash2, onClear, !ready || !editable)}
              </>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
