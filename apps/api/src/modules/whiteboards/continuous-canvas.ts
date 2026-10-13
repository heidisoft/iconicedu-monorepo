import { createHash } from 'node:crypto';
import type { WhiteboardDocumentVM, WhiteboardElementVM } from '@iconicedu/shared-types';

type LegacyPage = NonNullable<WhiteboardDocumentVM['legacyPages']>[number];
const remapId = (pageId: string, id: string) =>
  `wb_${createHash('sha256').update(`${pageId}:${id}`).digest('hex').slice(0, 32)}`;

/** Preserve each page's geometry and internal bindings while placing pages in one workspace. */
export function translateLegacyElement(
  element: WhiteboardElementVM,
  page: LegacyPage,
): WhiteboardElementVM {
  const result = structuredClone(element);
  const data = result.data;
  const id = (value: string) => remapId(page.id, value);
  result.id = id(result.id);
  data.id = result.id;
  data.x = Number(data.x ?? 0) + page.offsetX;
  data.y = Number(data.y ?? 0) + page.offsetY;
  delete data.index; // Scene restoration generates a consistent global stacking order.
  if (Array.isArray(data.groupIds))
    data.groupIds = data.groupIds.map((value) => id(String(value)));
  for (const key of ['containerId', 'frameId'])
    if (typeof data[key] === 'string') data[key] = id(data[key]);
  if (Array.isArray(data.boundElements))
    data.boundElements = data.boundElements.map((value) => ({
      ...value,
      id: id(String(value.id)),
    }));
  for (const key of ['startBinding', 'endBinding']) {
    const binding = data[key];
    if (
      binding &&
      typeof binding === 'object' &&
      'elementId' in binding &&
      typeof binding.elementId === 'string'
    )
      data[key] = { ...binding, elementId: id(binding.elementId) };
  }
  return result;
}
function extent(elements: WhiteboardElementVM[]) {
  let left = Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const { data } of elements) {
    const x = Number(data.x ?? 0),
      y = Number(data.y ?? 0);
    const w = Number(data.width ?? 0),
      h = Number(data.height ?? 0),
      angle = Number(data.angle ?? 0);
    const radiusX = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
    const radiusY = (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2;
    left = Math.min(left, x + w / 2 - radiusX);
    top = Math.min(top, y + h / 2 - radiusY);
    bottom = Math.max(bottom, y + h / 2 + radiusY);
  }
  return Number.isFinite(top) ? { left, top, bottom } : { left: 0, top: 0, bottom: 0 };
}
/** Read-time compatibility projection; the next atomic save persists the same normalized scene. */
export function continuousCanvas(document: WhiteboardDocumentVM): WhiteboardDocumentVM {
  if (document.layout === 'infinite') return structuredClone(document);
  const next = structuredClone(document);
  const [canvas, ...pages] = next.pages;
  if (!canvas) throw new Error('Whiteboard has no canvas');
  const firstExtent = extent(canvas.elements);
  let bottom = firstExtent.bottom;
  const legacyPages: LegacyPage[] = [];
  for (const page of pages) {
    const bounds = extent(page.elements);
    const legacy = {
      id: page.id,
      title: page.title,
      offsetX: firstExtent.left - bounds.left,
      offsetY: bottom + 160 - bounds.top,
    };
    legacyPages.push(legacy);
    canvas.elements.push(
      ...page.elements.map((element) => translateLegacyElement(element, legacy)),
    );
    bottom += 160 + bounds.bottom - bounds.top;
  }
  canvas.title = 'Canvas';
  next.pages = [canvas];
  next.layout = 'infinite';
  if (legacyPages.length) next.legacyPages = legacyPages;
  return next;
}
