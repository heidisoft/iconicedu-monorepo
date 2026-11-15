'use client';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnnotationCoordinateService } from '@iconicedu/utils';
/** Gives renderers and overlays one content rectangle, excluding letterboxing. */
export function SharedContentSurface({
  source,
  children,
  overlay,
}: {
  source: { width: number; height: number };
  children: ReactNode;
  overlay?: (size: { width: number; height: number }) => ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const coordinates = useMemo(
    () => new AnnotationCoordinateService(source),
    [source.width, source.height],
  );
  const bounds = coordinates.getContentBounds(size);
  useLayoutEffect(() => {
    const node = container.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={container} className="relative h-full w-full" data-shared-content-surface>
      <div
        className="absolute overflow-hidden"
        data-shared-content-bounds
        style={{
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
        }}
      >
        {children}
        {bounds.width > 0 &&
          bounds.height > 0 &&
          overlay?.({ width: bounds.width, height: bounds.height })}
      </div>
    </div>
  );
}
