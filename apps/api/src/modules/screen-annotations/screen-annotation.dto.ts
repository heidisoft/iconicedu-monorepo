import { BadRequestException } from '@nestjs/common';
import type {
  AnnotationObject,
  AnnotationPointerInput,
  AnnotationOperation,
  AnnotationTool,
} from '@iconicedu/shared-types';
const permanentTools: AnnotationTool[] = [
  'pen',
  'highlighter',
  'line',
  'arrow',
  'doubleArrow',
  'rectangle',
  'rectangleFilled',
  'rectangleHighlight',
  'ellipse',
  'ellipseFilled',
  'ellipseHighlight',
  'diamond',
  'text',
  'stampCheck',
  'stampX',
  'stampStar',
  'stampHeart',
  'stampQuestion',
  'stampArrow',
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function annotationUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value))
    throw new BadRequestException('Invalid annotation identifier');
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid annotation payload');
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new BadRequestException('Invalid annotation geometry or style');
  return value;
}
export function parseAnnotationOperation(value: unknown): AnnotationOperation {
  const input = record(value);
  const eventId = annotationUuid(input.eventId);
  if (input.kind === 'permissions') {
    if (typeof input.enabled !== 'boolean')
      throw new BadRequestException('enabled must be boolean');
    return { eventId, kind: 'permissions', enabled: input.enabled };
  }
  if (input.kind === 'end') return { eventId, kind: 'end' };
  if (input.kind === 'clear') {
    if (!['mine', 'students', 'all'].includes(String(input.scope)))
      throw new BadRequestException('Invalid clear scope');
    return { eventId, kind: 'clear', scope: input.scope as 'mine' | 'students' | 'all' };
  }
  const baseVersion = number(input.baseVersion, 0, 1000000);
  if (!Number.isInteger(baseVersion))
    throw new BadRequestException('Invalid object version');
  if (input.kind === 'delete')
    return { eventId, kind: 'delete', id: annotationUuid(input.id), baseVersion };
  if (input.kind !== 'put') throw new BadRequestException('Invalid annotation operation');
  const object = record(input.object);
  const style = record(object.style);
  if (!permanentTools.includes(object.type as AnnotationTool))
    throw new BadRequestException('Invalid permanent annotation type');
  if (
    !Array.isArray(object.points) ||
    !object.points.length ||
    object.points.length > 5000
  )
    throw new BadRequestException('Annotation requires 1–5000 points');
  const points = object.points.map((value) => {
    const point = record(value);
    return {
      x: number(point.x, 0, 1),
      y: number(point.y, 0, 1),
      ...(point.pressure === undefined ? {} : { pressure: number(point.pressure, 0, 1) }),
    };
  });
  if (typeof style.color !== 'string' || !/^#[a-f0-9]{6}$/i.test(style.color))
    throw new BadRequestException('Invalid annotation color');
  if (typeof style.bold !== 'boolean' || typeof style.italic !== 'boolean')
    throw new BadRequestException('Invalid text style');
  if (
    object.text !== undefined &&
    (typeof object.text !== 'string' || object.text.length > 4000)
  )
    throw new BadRequestException('Text is too long');
  const sanitized: AnnotationObject = {
    id: annotationUuid(object.id),
    roomId: '',
    shareSessionId: '',
    creatorId: '',
    creatorName: '',
    creatorRole: 'student',
    type: object.type as AnnotationTool,
    points,
    style: {
      color: style.color,
      width: number(style.width, 0.1, 40),
      opacity: number(style.opacity, 0.05, 1),
      fontSize: number(style.fontSize, 8, 96),
      bold: style.bold,
      italic: style.italic,
    },
    rotation: number(object.rotation, -36000, 36000),
    createdAt: 0,
    updatedAt: 0,
    version: 0,
    ...(typeof object.text === 'string' ? { text: object.text } : {}),
  };
  return { eventId, kind: 'put', baseVersion, object: sanitized };
}

export function parseAnnotationPointer(value: unknown): AnnotationPointerInput {
  const input = record(value);
  const point = record(input.point);
  if (!['spotlight', 'pointerArrow'].includes(String(input.tool)))
    throw new BadRequestException('Invalid pointer tool');
  if (typeof input.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.color))
    throw new BadRequestException('Invalid pointer color');
  return {
    point: { x: number(point.x, 0, 1), y: number(point.y, 0, 1) },
    tool: input.tool as AnnotationPointerInput['tool'],
    color: input.color,
  };
}
