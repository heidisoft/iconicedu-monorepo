'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Circle, Group, Label, Tag, Text } from 'react-konva';
import Konva from 'konva';
import type { AnnotationPoint } from '@iconicedu/shared-types';
/** Tween canvas nodes directly; pointer interpolation does not redraw permanent shapes. */
export function AnnotationPointer({
  point,
  width,
  height,
  tool,
  name,
  color,
}: {
  point: AnnotationPoint;
  width: number;
  height: number;
  tool: 'spotlight' | 'pointerArrow';
  name: string;
  color: string;
}) {
  const displayName = name.trim() || 'Participant';
  const node = useRef<Konva.Group>(null);
  const label = useRef<Konva.Label>(null);
  const labelText = useRef<Konva.Text>(null);
  useLayoutEffect(() => {
    if (!label.current || !labelText.current) return;
    labelText.current.width(
      Math.min(
        180,
        Math.max(10, width - 8),
        labelText.current.measureSize(displayName).width + 10,
      ),
    );
    const bounds = label.current.getClientRect({ skipTransform: true });
    label.current.position({
      x: Math.max(
        4 - point.x * width,
        Math.min(16, width - point.x * width - bounds.width - 4),
      ),
      y: Math.max(
        4 - point.y * height,
        Math.min(8, height - point.y * height - bounds.height - 4),
      ),
    });
  }, [displayName, point.x, point.y, width, height]);
  const initial = useRef({ x: point.x * width, y: point.y * height });
  useEffect(() => {
    if (!node.current) return;
    const position = { x: point.x * width, y: point.y * height };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.current.position(position);
      return;
    }
    const tween = new Konva.Tween({
      node: node.current,
      ...position,
      duration: 0.08,
      easing: Konva.Easings.EaseOut,
    });
    tween.play();
    return () => tween.destroy();
  }, [point.x, point.y, width, height]);
  return (
    <Group ref={node} x={initial.current.x} y={initial.current.y} listening={false}>
      {tool === 'spotlight' && <Circle radius={12} fill={color} opacity={0.5} />}
      <Label ref={label} x={16} y={8} listening={false}>
        <Tag fill={color} cornerRadius={4} />
        <Text
          ref={labelText}
          wrap="none"
          ellipsis
          text={displayName}
          fill={(() => {
            const channels = color
              .replace('#', '')
              .match(/.{2}/g)
              ?.map((value) => parseInt(value, 16)) ?? [0, 0, 0];
            return channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114 > 150
              ? '#111827'
              : '#ffffff';
          })()}
          fontSize={12}
          padding={5}
        />
      </Label>
    </Group>
  );
}
