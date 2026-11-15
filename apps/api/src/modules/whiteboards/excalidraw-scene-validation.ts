import { BadRequestException } from '@nestjs/common';
const supportedTypes = new Set([
  'rectangle',
  'ellipse',
  'diamond',
  'frame',
  'line',
  'arrow',
  'freedraw',
  'text',
]);
const finiteCoordinate = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e7;
/** Engine codec validation stays separate from board ownership, permissions and storage. */
export function validateExcalidrawPayload(data: Record<string, unknown>) {
  if (!supportedTypes.has(String(data.type)) || data.link != null || data.fileId != null)
    throw new BadRequestException('Unsupported canvas element');
  for (const key of ['x', 'y', 'width', 'height', 'angle'])
    if (!finiteCoordinate(data[key]))
      throw new BadRequestException('Invalid canvas coordinates');
  for (const key of ['strokeWidth', 'roughness', 'opacity', 'fontSize', 'lineHeight'])
    if (
      data[key] !== undefined &&
      (typeof data[key] !== 'number' ||
        !Number.isFinite(data[key]) ||
        (data[key] as number) < 0 ||
        (data[key] as number) > 1000)
    )
      throw new BadRequestException('Invalid canvas style');
  if (['freedraw', 'line', 'arrow'].includes(String(data.type))) {
    if (
      !Array.isArray(data.points) ||
      data.points.length < 1 ||
      data.points.length > 10000 ||
      data.points.some(
        (point) =>
          !Array.isArray(point) || point.length !== 2 || !point.every(finiteCoordinate),
      )
    )
      throw new BadRequestException('Invalid drawing points');
  }
  if (
    data.type === 'text' &&
    (typeof data.text !== 'string' ||
      data.text.length > 50000 ||
      typeof data.fontSize !== 'number' ||
      data.fontSize <= 0 ||
      !Number.isInteger(data.fontFamily) ||
      Number(data.fontFamily) < 1 ||
      Number(data.fontFamily) > 8)
  )
    throw new BadRequestException('Invalid text element');
  if (
    data.groupIds !== undefined &&
    (!Array.isArray(data.groupIds) ||
      data.groupIds.length > 100 ||
      data.groupIds.some((id) => typeof id !== 'string' || id.length > 100))
  )
    throw new BadRequestException('Invalid drawing group');
  if (
    data.boundElements != null &&
    (!Array.isArray(data.boundElements) ||
      data.boundElements.some(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          typeof item.id !== 'string' ||
          !['arrow', 'text'].includes(item.type),
      ))
  )
    throw new BadRequestException('Invalid drawing bindings');
  if (
    data.pressures !== undefined &&
    (!Array.isArray(data.pressures) ||
      data.pressures.length > 10000 ||
      data.pressures.some(
        (p) => typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1,
      ))
  )
    throw new BadRequestException('Invalid drawing pressure');
}
