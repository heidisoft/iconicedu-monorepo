export function createHitSlop(visualSize: number, minSize = 44) {
  const inset = Math.max(0, Math.ceil((minSize - visualSize) / 2));
  return { top: inset, bottom: inset, left: inset, right: inset };
}
