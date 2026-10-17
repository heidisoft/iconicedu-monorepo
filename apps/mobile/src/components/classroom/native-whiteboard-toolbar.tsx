import { DrawingStyleStrip, LaserPointerIcon } from '@iconicedu/ui-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
export function NativeWhiteboardToolbar({
  editable,
  ready,
  canClear,
  onCommand,
  onClear,
  styleState,
  onFollow,
  followLabel,
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
  followLabel?: string;
}) {
  const { colors } = useTheme();
  const [chosenTool, setTool] = useState<Tool>('selection');
  const tool = styleState?.tool ?? chosenTool;
  const styleTool = styleState?.selectionType ?? tool;
  const [menu, setMenu] = useState<string | null>(null);
  const [grid, setGrid] = useState('dots');
  const [snap, setSnap] = useState(false);
  const button = (
    label: string,
    Icon: React.ComponentType<{ size?: number; color?: string }>,
    action: () => void,
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
      onPress={action}
      style={{
        minWidth: 44,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
        backgroundColor: selected ? colors.actionSubtle : undefined,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon size={20} color={colors.text} />
      {dropdown && <ChevronDown size={12} color={colors.text} />}
    </Pressable>
  );
  const choose = (value: Tool) => {
    setTool(value);
    setMenu(null);
    onCommand({ type: 'tool', tool: value });
  };
  const toggle = (value: string) => setMenu(menu === value ? null : value);
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
  return (
    <View style={{ backgroundColor: colors.card, zIndex: 4 }}>
      <ScrollView
        horizontal
        accessibilityLabel="Whiteboard tools"
        contentContainerStyle={{ gap: 2, padding: 4 }}
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
        {button(
          'Shapes',
          Shapes,
          () => toggle('Shapes'),
          !ready || !editable,
          shapes.some(([value]) => value === tool),
          true,
        )}
        {button('Library', Library, () => onCommand({ type: 'library' }), !ready)}
        {button('Undo', Undo2, () => onCommand({ type: 'undo' }), !ready || !editable)}
        {button(
          'View controls',
          Scan,
          () => toggle('View controls'),
          !ready,
          false,
          true,
        )}
        {button(
          'More whiteboard actions',
          Ellipsis,
          () => toggle('More whiteboard actions'),
          !ready,
          false,
          true,
        )}
        {onFollow && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Follow viewport"
            disabled={!ready}
            onPress={onFollow}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}
          >
            <Text style={{ color: colors.text }}>{followLabel ?? 'Follow tutor'}</Text>
          </Pressable>
        )}
      </ScrollView>
      {editable && !['hand', 'laser', 'eraser', 'selection'].includes(styleTool) && (
        <DrawingStyleStrip
          color={styleState?.color ?? '#1e293b'}
          width={styleState?.width ?? 2}
          fill={styleState?.fill}
          foreground={colors.text}
          showWidth={styleTool !== 'text'}
          showFill={['rectangle', 'ellipse', 'diamond'].includes(styleTool)}
          onStyle={(style) => onCommand({ type: 'style', style })}
          onMore={() => onCommand({ type: 'style-options' })}
        />
      )}
      {menu && (
        <ScrollView
          horizontal
          accessibilityLabel={menu}
          contentContainerStyle={{ gap: 4, padding: 4 }}
        >
          {menu === 'Shapes' &&
            shapes.map(([value, label, Icon]) =>
              button(label, Icon, () => choose(value), !editable, tool === value),
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
                  style={{ padding: 12 }}
                >
                  <Text style={{ color: colors.text }}>
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
                style={{ padding: 12 }}
              >
                <Text style={{ color: colors.text }}>Snap to grid</Text>
              </Pressable>
              {button('Fit content', Scan, () => onCommand({ type: 'fit' }))}
              {button('Zoom in', ZoomIn, () => onCommand({ type: 'zoom', delta: 0.1 }))}
              {button('Zoom out', ZoomOut, () =>
                onCommand({ type: 'zoom', delta: -0.1 }),
              )}
              {button('Reset zoom to 100%', RotateCcw, () =>
                onCommand({ type: 'reset-zoom' }),
              )}
            </>
          )}
          {menu === 'More whiteboard actions' && (
            <>
              {button('Redo', Redo2, () => onCommand({ type: 'redo' }), !editable)}
              {canClear && button('Clear board', Trash2, onClear, !editable)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
