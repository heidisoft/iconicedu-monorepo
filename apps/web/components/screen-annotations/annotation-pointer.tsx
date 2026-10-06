'use client';
import { useEffect, useRef } from 'react';
import { Arrow, Circle, Group, Text } from 'react-konva';
import type Konva from 'konva';
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
  const node = useRef<Konva.Group>(null);
  const initial = useRef({ x: point.x * width, y: point.y * height });
  useEffect(() => {
    node.current?.to({ x: point.x * width, y: point.y * height, duration: 0.04 });
  }, [point.x, point.y, width, height]);
  return (
    <Group ref={node} x={initial.current.x} y={initial.current.y} listening={false}>
      {tool === 'spotlight' ? (
        <Circle radius={12} fill={color} opacity={0.5} />
      ) : (
        <>
          <Arrow
            points={[0, -28, 0, -3]}
            stroke={color}
            fill={color}
            strokeWidth={3}
            pointerLength={8}
            pointerWidth={8}
          />
          <Text x={6} text={name} fill={color} fontSize={14} />
        </>
      )}
    </Group>
  );
}
