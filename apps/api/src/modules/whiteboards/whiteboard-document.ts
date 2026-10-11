import { continuousCanvas, translateLegacyElement } from './continuous-canvas';
import { validateExcalidrawPayload } from './excalidraw-scene-validation';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
  WhiteboardDocumentVM,
  WhiteboardElementVM,
  WhiteboardOperationVM,
  WhiteboardRole,
} from '@iconicedu/shared-types';

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w-]{1,100}$/.test(value);

/** Bound untrusted canvas data; image, iframe and executable/link payloads are disallowed. */
export function validateWhiteboardOperation(value: unknown): WhiteboardOperationVM {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid whiteboard operation');
  const op = value as Record<string, unknown>;
  if (!identifier(op.id) || Buffer.byteLength(JSON.stringify(value), 'utf8') > 1_000_000)
    throw new BadRequestException('Invalid or oversized whiteboard operation');
  if (
    ['student-editing', 'presentation'].includes(String(op.type)) &&
    typeof op.enabled === 'boolean'
  )
    return {
      id: op.id,
      type: op.type as 'student-editing' | 'presentation',
      enabled: op.enabled,
    };
  if (!identifier(op.pageId)) throw new BadRequestException('Invalid page');
  switch (op.type) {
    case 'elements': {
      if (!Array.isArray(op.elements) || op.elements.length > 1000)
        throw new BadRequestException('Invalid elements');
      const elements = op.elements.map((input: unknown): WhiteboardElementVM => {
        if (!input || typeof input !== 'object' || Array.isArray(input))
          throw new BadRequestException('Invalid element');
        const e = input as WhiteboardElementVM;
        if (
          !identifier(e.id) ||
          !Number.isSafeInteger(e.version) ||
          e.version < 1 ||
          !Number.isSafeInteger(e.nonce) ||
          typeof e.deleted !== 'boolean' ||
          !e.data ||
          typeof e.data !== 'object' ||
          Array.isArray(e.data)
        )
          throw new BadRequestException('Invalid element');
        if (
          e.data.id !== e.id ||
          e.data.version !== e.version ||
          e.data.versionNonce !== e.nonce ||
          e.data.isDeleted !== e.deleted ||
          e.data.link != null ||
          e.data.fileId != null
        )
          throw new BadRequestException('Unsupported canvas element');
        validateExcalidrawPayload(e.data);
        if (Buffer.byteLength(JSON.stringify(e.data), 'utf8') > 200_000)
          throw new BadRequestException('Element is too large');
        return {
          id: e.id,
          version: e.version,
          nonce: e.nonce,
          deleted: e.deleted,
          data: e.data,
        };
      });
      return { id: op.id, type: op.type, pageId: op.pageId, elements };
    }
    case 'add-page':
      if (
        typeof op.title !== 'string' ||
        !op.title.trim() ||
        op.title.length > 80 ||
        (op.sourceId !== undefined && !identifier(op.sourceId))
      )
        throw new BadRequestException('Invalid page title or source');
      return {
        id: op.id,
        type: op.type,
        pageId: op.pageId,
        title: op.title.trim(),
        ...(op.sourceId ? { sourceId: op.sourceId as string } : {}),
      };
    case 'clear-page':
    case 'delete-page':
      return { id: op.id, type: op.type, pageId: op.pageId };
    case 'reorder-page':
      if (op.beforeId !== null && !identifier(op.beforeId))
        throw new BadRequestException('Invalid page order');
      return {
        id: op.id,
        type: op.type,
        pageId: op.pageId,
        beforeId: op.beforeId as string | null,
      };
    default:
      throw new BadRequestException('Unsupported whiteboard operation');
  }
}

export function applyWhiteboardOperation(
  document: WhiteboardDocumentVM,
  op: WhiteboardOperationVM,
  role: WhiteboardRole,
): WhiteboardDocumentVM {
  if (role !== 'teacher' && (op.type !== 'elements' || !document.studentEditing))
    throw new ForbiddenException('Whiteboard editing is locked');
  const next = continuousCanvas(document);
  if (op.type === 'presentation') {
    next.presenting = op.enabled;
    return next;
  }
  if (op.type === 'student-editing') {
    next.studentEditing = op.enabled;
    return next;
  }
  if (op.type === 'add-page' || op.type === 'delete-page' || op.type === 'reorder-page')
    throw new BadRequestException(
      'Page controls have been replaced by an infinite canvas. Rejoin the whiteboard.',
    );
  const page = next.pages[0];
  const legacy = next.legacyPages?.find((item) => item.id === op.pageId);
  if (op.pageId !== page.id && !legacy)
    throw new BadRequestException('Canvas no longer exists');
  if (op.type === 'clear-page') {
    if (legacy)
      throw new BadRequestException('Rejoin the whiteboard before clearing the canvas');
    page.elements = page.elements.map((e) => ({
      ...e,
      deleted: true,
      version: e.version + 1,
      data: { ...e.data, isDeleted: true, version: e.version + 1 },
    }));
  } else {
    const merged = new Map(page.elements.map((e) => [e.id, e]));
    for (const incoming of op.elements) {
      const element = legacy ? translateLegacyElement(incoming, legacy) : incoming;
      const existing = merged.get(element.id);
      // Deterministic per-element LWW order: version then nonce; tombstones prevent replay resurrection.
      if (
        !existing ||
        element.version > existing.version ||
        (element.version === existing.version && element.nonce < existing.nonce)
      )
        merged.set(element.id, element);
    }
    if (merged.size > Math.max(5000, page.elements.length))
      throw new BadRequestException('Whiteboard element limit reached');
    page.elements = [...merged.values()];
  }
  if (Buffer.byteLength(JSON.stringify(next), 'utf8') > 8_000_000)
    throw new BadRequestException('Whiteboard storage limit reached');
  return next;
}
