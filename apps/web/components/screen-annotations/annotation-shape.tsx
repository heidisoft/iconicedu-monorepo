'use client';
import { memo } from 'react';
import { Arrow, Circle, Ellipse, Group, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { AnnotationObject } from '@iconicedu/shared-types';
export function annotationGeometry(
  object: AnnotationObject,
  width: number,
  height: number,
) {
  const points = object.points.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  }));
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x));
  const bottom = Math.max(...points.map((point) => point.y));
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    points: points.flatMap((point) => [point.x - left, point.y - top]),
  };
}
const stamps: Record<string, string> = {
  stampCheck: '✓',
  stampX: '✕',
  stampStar: '★',
  stampHeart: '♥',
  stampQuestion: '?',
  stampArrow: '➜',
};
export const AnnotationShape = memo(function AnnotationShape({
  object,
  width,
  height,
  interactive = false,
  draggable = false,
  onSelect,
  onTransform,
  onHover,
}: {
  object: AnnotationObject;
  width: number;
  height: number;
  interactive?: boolean;
  draggable?: boolean;
  onSelect?: (id: string, additive: boolean) => void;
  onTransform?: (object: AnnotationObject, node: Konva.Group) => void;
  onHover?: (name: string | null) => void;
}) {
  const bounds = annotationGeometry(object, width, height);
  const scale = width / 1000;
  const strokeWidth = object.style.width * scale;
  const common = {
    stroke: object.style.color,
    strokeWidth,
    hitStrokeWidth: Math.max(12, strokeWidth),
    opacity: object.style.opacity,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  };
  const fontSize = object.style.fontSize * scale;
  let shape;
  if (object.type === 'text' || object.type.startsWith('stamp'))
    shape = (
      <Text
        text={object.type === 'text' ? object.text : stamps[object.type]}
        fill={object.style.color}
        opacity={object.style.opacity}
        fontSize={object.type === 'text' ? fontSize : 36 * scale}
        fontStyle={`${object.style.bold ? 'bold' : ''} ${object.style.italic ? 'italic' : ''}`}
        width={object.type === 'text' ? Math.max(100 * scale, bounds.width) : undefined}
      />
    );
  else if (object.type === 'arrow' || object.type === 'doubleArrow')
    shape = (
      <Arrow
        {...common}
        points={bounds.points.length >= 4 ? bounds.points : [0, 0, 0, 0]}
        fill={object.style.color}
        pointerAtBeginning={object.type === 'doubleArrow'}
        pointerLength={Math.max(8 * scale, strokeWidth * 3)}
        pointerWidth={Math.max(8 * scale, strokeWidth * 3)}
      />
    );
  else if (object.type.startsWith('rectangle'))
    shape = (
      <Rect
        {...common}
        width={bounds.width}
        height={bounds.height}
        fill={object.type === 'rectangle' ? undefined : object.style.color}
      />
    );
  else if (object.type.startsWith('ellipse'))
    shape = (
      <Ellipse
        {...common}
        x={bounds.width / 2}
        y={bounds.height / 2}
        radiusX={bounds.width / 2}
        radiusY={bounds.height / 2}
        fill={object.type === 'ellipse' ? undefined : object.style.color}
      />
    );
  else if (object.type === 'diamond')
    shape = (
      <Line
        {...common}
        closed
        points={[
          bounds.width / 2,
          0,
          bounds.width,
          bounds.height / 2,
          bounds.width / 2,
          bounds.height,
          0,
          bounds.height / 2,
        ]}
      />
    );
  else if (object.points.length === 1)
    shape = (
      <Circle
        radius={strokeWidth / 2}
        fill={object.style.color}
        opacity={object.style.opacity}
      />
    );
  else
    shape = (
      <Line
        {...common}
        points={bounds.points}
        tension={object.type === 'line' ? 0 : 0.25}
        hitStrokeWidth={Math.max(12, strokeWidth)}
      />
    );
  return (
    <Group
      id={object.id}
      x={bounds.left}
      y={bounds.top}
      rotation={object.rotation}
      listening={interactive}
      draggable={draggable}
      onPointerClick={(event) => {
        event.cancelBubble = true;
        onSelect?.(object.id, Boolean((event.evt as PointerEvent).shiftKey));
      }}
      onDblClick={() => onSelect?.(object.id, false)}
      onDragEnd={(event) =>
        onTransform?.(object, event.currentTarget as unknown as Konva.Group)
      }
      onTransformEnd={(event) =>
        onTransform?.(object, event.currentTarget as unknown as Konva.Group)
      }
      onMouseEnter={() => onHover?.(object.creatorName)}
      onMouseLeave={() => onHover?.(null)}
    >
      {shape}
    </Group>
  );
});
