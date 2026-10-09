'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import { AnnotationPointer } from './annotation-pointer';
import type Konva from 'konva';
import type {
  AnnotationContext,
  AnnotationObject,
  AnnotationPoint,
  AnnotationPreview,
  AnnotationTool,
} from '@iconicedu/shared-types';
import {
  AnnotationCoordinateService,
  moveAnnotation,
  simplifyAnnotationPoints,
} from '@iconicedu/utils';
import { AnnotationShape, annotationGeometry } from './annotation-shape';
import { AnnotationToolbar } from './annotation-toolbar';
import { useScreenAnnotations } from './use-screen-annotations';
type PreviewBody = AnnotationPreview extends infer Event
  ? Event extends AnnotationPreview
    ? Omit<
        Event,
        | 'eventId'
        | 'roomId'
        | 'clientId'
        | 'userId'
        | 'sequence'
        | 'timestamp'
        | 'annotationId'
      >
    : never
  : never;
const paths = new Set<AnnotationTool>(['pen', 'highlighter', 'vanishingPen']);
export function AnnotationOverlay({
  sessionId,
  shareKey,
  width,
  height,
  useAnnotations = useScreenAnnotations,
  onContext,
  annotationToken,
  sourceComposited = false,
}: {
  sessionId: string;
  annotationToken?: string;
  sourceComposited?: boolean;
  shareKey: string;
  width: number;
  height: number;
  useAnnotations?: typeof useScreenAnnotations;
  onContext?: (context: AnnotationContext) => void;
}) {
  const engine = useAnnotations(sessionId, shareKey, annotationToken);
  useEffect(() => {
    if (engine.context) onContext?.(engine.context);
  }, [engine.context, onContext]);
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => {
    const element = root.current;
    const draw = () => stage.current?.draw();
    element?.addEventListener('recording-frame', draw);
    return () => element?.removeEventListener('recording-frame', draw);
  }, []);
  const coordinates = useMemo(
    () => new AnnotationCoordinateService({ width, height }),
    [width, height],
  );
  const [tool, setToolState] = useState<AnnotationTool>('cursor');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [fontSize, setFontSize] = useState(24);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [pressure, setPressure] = useState(false);
  const [draft, setDraft] = useState<AnnotationObject | null>(null);
  const active = useRef<AnnotationObject | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [textEditor, setTextEditor] = useState<{
    object: AnnotationObject;
    value: string;
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    start: AnnotationPoint;
    end: AnnotationPoint;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const pendingPoints = useRef<AnnotationPoint[]>([]);
  const sequence = useRef(0);
  const lastPointer = useRef(0);
  const pointerSequence = useRef(0);
  const frame = useRef<number | null>(null);
  const touchIds = useRef(new Set<number>());
  const pointerId = useRef<number | null>(null);
  const actor = engine.context?.actor;
  const tutor = actor?.role === 'educator';
  const canEdit = useCallback(
    (object: AnnotationObject) =>
      engine.canDraw && (tutor || object.creatorId === actor?.userId),
    [engine.canDraw, tutor, actor?.userId],
  );
  const setTool = useCallback(
    (next: AnnotationTool) => {
      setToolState(next);
      setSelected([]);
      setTextEditor(null);
      active.current = null;
      setDraft(null);
      setMarquee(null);
      if (next === 'highlighter' || next.endsWith('Highlight')) {
        setOpacity(0.25);
        if (next === 'highlighter') setLineWidth(18);
      } else {
        setOpacity(1);
        if (lineWidth === 18) setLineWidth(3);
      }
    },
    [lineWidth],
  );
  const swallow = (promise: Promise<unknown>) => {
    void promise.catch(() => undefined);
  };
  const preview = useCallback(
    (body: PreviewBody, annotationId: string, packetSequence: number) => {
      const current = engineRef.current;
      if (!current.context) return;
      current.broadcast({
        ...body,
        eventId: crypto.randomUUID(),
        roomId: current.context.snapshot.roomId,
        clientId: current.clientId,
        userId: current.context.actor.userId,
        sequence: packetSequence,
        timestamp: Date.now(),
        annotationId,
      } as AnnotationPreview);
    },
    [],
  );
  const flush = useCallback(() => {
    const object = active.current;
    if (!object || !pendingPoints.current.length) return;
    const points = pendingPoints.current.splice(0, 128);
    preview({ kind: 'points', points }, object.id, ++sequence.current);
  }, [preview]);
  useEffect(() => {
    const timer = setInterval(flush, 40);
    return () => {
      clearInterval(timer);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [flush]);
  useEffect(() => {
    if (!engine.canDraw) {
      active.current = null;
      pendingPoints.current = [];
      setDraft(null);
      setSelected([]);
      setTextEditor(null);
      setToolState('cursor');
    }
  }, [engine.canDraw]);
  useEffect(() => {
    if (!transformer.current || !stage.current) return;
    transformer.current.nodes(
      selected
        .map((id) => stage.current!.findOne(`#${id}`))
        .filter((node): node is Konva.Node => Boolean(node)),
    );
    transformer.current.getLayer()?.batchDraw();
  }, [selected, engine.objects]);
  const executeOperation = engine.execute;
  const put = useCallback(
    (object: AnnotationObject, baseVersion = object.version) =>
      executeOperation({
        eventId: crypto.randomUUID(),
        kind: 'put',
        object,
        baseVersion,
      }),
    [executeOperation],
  );
  const deleteSelection = useCallback(() => {
    for (const object of engineRef.current.objects)
      if (selected.includes(object.id) && canEdit(object))
        swallow(
          engineRef.current.execute({
            eventId: crypto.randomUUID(),
            kind: 'delete',
            id: object.id,
            baseVersion: object.version,
          }),
        );
    setSelected([]);
  }, [selected, canEdit]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        !engineRef.current.canDraw ||
        tool === 'cursor' ||
        target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        swallow(engineRef.current.changeHistory(event.shiftKey ? 'redo' : 'undo'));
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      } else if (event.key === 'Escape') {
        active.current = null;
        pendingPoints.current = [];
        setDraft(null);
        setSelected([]);
        setTextEditor(null);
        setMarquee(null);
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const shortcuts: Record<string, AnnotationTool> = {
          v: 'select',
          p: 'pen',
          h: 'highlighter',
          t: 'text',
          e: 'eraser',
        };
        const next = shortcuts[event.key.toLowerCase()];
        if (next) {
          event.preventDefault();
          setTool(next);
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [tool, deleteSelection, setTool]);
  const eventPoint = (event: React.PointerEvent): AnnotationPoint | null =>
    root.current
      ? coordinates.clientToNormalized(
          { x: event.clientX, y: event.clientY, pressure: event.pressure },
          root.current.getBoundingClientRect(),
        )
      : null;
  const createObject = (point: AnnotationPoint): AnnotationObject | null => {
    if (!actor || !engine.context) return null;
    const roomId = engine.context.snapshot.roomId;
    return {
      id: crypto.randomUUID(),
      roomId,
      shareSessionId: roomId,
      type: tool,
      creatorId: actor.userId,
      creatorName: actor.name,
      creatorRole: actor.role,
      points: [point],
      style: { color, width: lineWidth, opacity, fontSize, bold, italic },
      rotation: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 0,
    };
  };
  const hitObject = (point: AnnotationPoint) => {
    const node = stage.current?.getIntersection(
      coordinates.normalizedToStage(point, { width, height }),
    );
    const group = node?.findAncestor('Group');
    return engine.objects.find((object) => object.id === group?.id());
  };
  const publishPointer = (
    point: AnnotationPoint,
    pointerTool: 'spotlight' | 'pointerArrow',
  ) => {
    const now = Date.now();
    if (now - lastPointer.current < 40) return;
    lastPointer.current = now;
    preview(
      { kind: 'pointer', point, tool: pointerTool },
      `pointer:${actor?.userId}`,
      ++pointerSequence.current,
    );
  };
  const cancelDraft = () => {
    if (active.current)
      preview({ kind: 'finish' }, active.current.id, ++sequence.current);
    active.current = null;
    pendingPoints.current = [];
    setDraft(null);
    pointerId.current = null;
  };
  const down = (event: React.PointerEvent) => {
    if (!engine.canDraw || tool === 'cursor') return;
    if (event.pointerType === 'touch') {
      touchIds.current.add(event.pointerId);
      if (touchIds.current.size > 1) {
        cancelDraft();
        return;
      }
    }
    if (
      event.button !== 0 ||
      pointerId.current !== null ||
      (event.pointerType === 'touch' && event.width > 50)
    )
      return;
    const point = eventPoint(event);
    if (!point) return;
    const hit = hitObject(point);
    if (tool === 'eraser') {
      if (hit && canEdit(hit))
        swallow(
          engine.execute({
            eventId: crypto.randomUUID(),
            kind: 'delete',
            id: hit.id,
            baseVersion: hit.version,
          }),
        );
      return;
    }
    if (tool === 'select') {
      if (hit && canEdit(hit)) {
        setSelected((previous) =>
          event.shiftKey
            ? previous.includes(hit.id)
              ? previous.filter((id) => id !== hit.id)
              : [...previous, hit.id]
            : previous.includes(hit.id)
              ? previous
              : [hit.id],
        );
        return;
      }
      setSelected([]);
      setMarquee({ start: point, end: point });
      return;
    }
    if (tool === 'spotlight' || tool === 'pointerArrow') {
      publishPointer(point, tool);
      return;
    }
    if (tool === 'text') {
      event.preventDefault();
      const object = hit?.type === 'text' && canEdit(hit) ? hit : createObject(point);
      if (object)
        setTextEditor({
          object:
            object.type === 'text' && object.points.length === 1
              ? {
                  ...object,
                  points: [point, { x: Math.min(1, point.x + 0.3), y: point.y }],
                }
              : object,
          value: object.text ?? '',
        });
      return;
    }
    const object = createObject(point);
    if (!object) return;
    if (tool.startsWith('stamp')) {
      swallow(put(object, 0));
      return;
    }
    pointerId.current = event.pointerId;
    root.current?.setPointerCapture(event.pointerId);
    active.current = object;
    pendingPoints.current = [];
    sequence.current = 0;
    setDraft(object);
    preview({ kind: 'start', object }, object.id, 0);
  };
  const move = (event: React.PointerEvent) => {
    if (!engine.canDraw || touchIds.current.size > 1) return;
    const point = eventPoint(event);
    if (!point) return;
    if (tool === 'spotlight') {
      publishPointer(point, tool);
      return;
    }
    if (marquee) {
      setMarquee((previous) => (previous ? { ...previous, end: point } : null));
      return;
    }
    const object = active.current;
    if (!object || event.pointerId !== pointerId.current) return;
    if (paths.has(object.type)) {
      if (object.points.length >= 5000) return;
      object.points.push(point);
      pendingPoints.current.push(point);
    } else {
      const start = object.points[0];
      if (event.shiftKey && tool.startsWith('ellipse')) {
        const side = Math.min(
          Math.abs(point.x - start.x) * width,
          Math.abs(point.y - start.y) * height,
        );
        point.x = start.x + (Math.sign(point.x - start.x) * side) / width;
        point.y = start.y + (Math.sign(point.y - start.y) * side) / height;
      }
      object.points = [start, point];
      pendingPoints.current = [point];
    }
    if (frame.current === null)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (active.current)
          setDraft({ ...active.current, points: [...active.current.points] });
      });
  };
  const up = (event: React.PointerEvent) => {
    touchIds.current.delete(event.pointerId);
    if (marquee) {
      const left = Math.min(marquee.start.x, marquee.end.x);
      const right = Math.max(marquee.start.x, marquee.end.x);
      const top = Math.min(marquee.start.y, marquee.end.y);
      const bottom = Math.max(marquee.start.y, marquee.end.y);
      setSelected(
        engine.objects
          .filter(
            (object) =>
              canEdit(object) &&
              object.points.every(
                (p) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom,
              ),
          )
          .map((object) => object.id),
      );
      setMarquee(null);
      return;
    }
    if (pointerId.current !== event.pointerId || !active.current) return;
    if (!paths.has(tool) && active.current.points.length < 2) {
      cancelDraft();
      return;
    }
    while (pendingPoints.current.length) flush();
    const object = {
      ...active.current,
      points: paths.has(tool)
        ? simplifyAnnotationPoints(active.current.points)
        : active.current.points,
    };
    if (pressure && tool === 'pen')
      object.style = {
        ...object.style,
        width: Math.max(
          0.1,
          lineWidth *
            (0.4 +
              object.points.reduce((sum, p) => sum + (p.pressure || 0.5), 0) /
                object.points.length),
        ),
      };
    if (tool === 'vanishingPen')
      preview(
        { kind: 'vanish', object, expiresAt: Date.now() + 4000 },
        object.id,
        ++sequence.current,
      );
    else
      swallow(
        put(object, 0).then(() => {
          preview({ kind: 'finish' }, object.id, ++sequence.current);
        }),
      );
    active.current = null;
    pointerId.current = null;
    setDraft(null);
    if (root.current?.hasPointerCapture(event.pointerId))
      root.current.releasePointerCapture(event.pointerId);
  };
  const transformObject = useCallback(
    (object: AnnotationObject, node: Konva.Group) => {
      if (!canEdit(object)) return;
      const geometry = annotationGeometry(object, width, height);
      const transformed = {
        ...object,
        points: object.points.map((point) => ({
          ...point,
          x: Math.max(
            0,
            Math.min(
              1,
              (node.x() + (point.x * width - geometry.left) * node.scaleX()) / width,
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              1,
              (node.y() + (point.y * height - geometry.top) * node.scaleY()) / height,
            ),
          ),
        })),
        rotation: node.rotation(),
        style: {
          ...object.style,
          fontSize: Math.max(8, Math.min(96, object.style.fontSize * node.scaleY())),
        },
      };
      node.scaleX(1);
      node.scaleY(1);
      swallow(put(transformed));
    },
    [canEdit, width, height, put],
  );
  const save = () => {
    if (!stage.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * 2);
    canvas.height = Math.round(height * 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const source = root.current?.parentElement?.querySelector<
      HTMLCanvasElement | HTMLVideoElement
    >('[data-share-source="active"]');
    try {
      if (source) ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const layers = stage.current.getLayers();
      const visibility = layers.map((layer) => layer.visible());
      layers.forEach((layer, index) => layer.visible(index === 0));
      try {
        ctx.drawImage(stage.current.toCanvas({ pixelRatio: 2 }), 0, 0);
      } finally {
        layers.forEach((layer, index) => layer.visible(visibility[index]));
      }
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'screen-annotations.png';
      link.click();
    } catch {
      setLocalError('The shared screen cannot be exported in this browser.');
    }
  };
  return (
    <div
      ref={root}
      data-recording-annotations
      className="absolute inset-0"
      style={{
        pointerEvents: tool === 'cursor' || !engine.canDraw ? 'none' : 'auto',
        touchAction: tool === 'cursor' ? 'auto' : 'pinch-zoom',
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={(event) => {
        touchIds.current.delete(event.pointerId);
        cancelDraft();
      }}
      onLostPointerCapture={() => {
        if (active.current) cancelDraft();
      }}
    >
      <Stage
        ref={stage}
        width={width}
        height={height}
        style={{ opacity: sourceComposited ? 0 : 1 }}
      >
        <Layer>
          {engine.objects.map((object) => (
            <AnnotationShape
              key={object.id}
              object={object}
              width={width}
              height={height}
              interactive={canEdit(object) && ['select', 'eraser', 'text'].includes(tool)}
              draggable={
                tool === 'select' && canEdit(object) && selected.includes(object.id)
              }
              onTransform={transformObject}
              onHover={setHoverName}
            />
          ))}
        </Layer>
        <Layer listening={false}>
          {engine.remoteDrafts.map((object) => (
            <AnnotationShape
              key={object.id}
              object={object}
              width={width}
              height={height}
            />
          ))}
          {draft && <AnnotationShape object={draft} width={width} height={height} />}
          {engine.vanishing.map(({ object, expiresAt }) => (
            <AnnotationShape
              key={object.id}
              object={{
                ...object,
                style: {
                  ...object.style,
                  opacity: Math.min(1, (expiresAt - Date.now()) / 1000),
                },
              }}
              width={width}
              height={height}
            />
          ))}
        </Layer>
        <Layer listening={false}>
          {Object.entries(engine.pointers)
            .filter(([, pointer]) => pointer.tool === 'pointerArrow')
            .map(([id, pointer]) => (
              <AnnotationPointer
                key={id}
                {...pointer}
                width={width}
                height={height}
                color={color}
              />
            ))}
        </Layer>
        <Layer>
          <Transformer
            ref={transformer}
            rotateEnabled
            flipEnabled={false}
            boundBoxFunc={(oldBounds, nextBounds) =>
              nextBounds.width < 5 || nextBounds.height < 5 ? oldBounds : nextBounds
            }
          />
          {marquee && (
            <Rect
              listening={false}
              x={Math.min(marquee.start.x, marquee.end.x) * width}
              y={Math.min(marquee.start.y, marquee.end.y) * height}
              width={Math.abs(marquee.end.x - marquee.start.x) * width}
              height={Math.abs(marquee.end.y - marquee.start.y) * height}
              stroke={color}
              dash={[4, 4]}
            />
          )}
        </Layer>
        <Layer listening={false}>
          {Object.entries(engine.pointers)
            .filter(([, pointer]) => pointer.tool === 'spotlight')
            .map(([id, pointer]) => (
              <AnnotationPointer
                key={id}
                {...pointer}
                width={width}
                height={height}
                color={color}
              />
            ))}
        </Layer>
      </Stage>
      {textEditor && (
        <textarea
          aria-label="Annotation text"
          autoFocus
          maxLength={4000}
          className="pointer-events-auto absolute z-40 min-h-20 min-w-40 rounded-md border bg-background p-2 text-foreground shadow-md"
          style={{
            left: Math.min(
              textEditor.object.points[0].x * width,
              Math.max(0, width - 180),
            ),
            top: Math.min(
              textEditor.object.points[0].y * height,
              Math.max(0, height - 100),
            ),
            color: textEditor.object.style.color,
            fontSize: Math.max(12, (textEditor.object.style.fontSize * width) / 1000),
          }}
          value={textEditor.value}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            setTextEditor({ ...textEditor, value: event.target.value })
          }
          onBlur={() => {
            if (textEditor.value.trim())
              swallow(put({ ...textEditor.object, text: textEditor.value }));
            setTextEditor(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setTextEditor(null);
            } else if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      )}
      {showNames && hoverName && (
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-background px-2 py-1 text-xs text-foreground">
          {hoverName}
        </div>
      )}
      <output
        aria-label="Annotation count"
        className="pointer-events-none absolute right-2 top-2 rounded bg-background px-2 py-1 text-xs text-muted-foreground"
      >
        {engine.objects.length} {engine.objects.length === 1 ? 'mark' : 'marks'}
      </output>
      <div className="pointer-events-auto">
        <AnnotationToolbar
          tool={tool}
          setTool={setTool}
          canDraw={engine.canDraw}
          tutor={tutor}
          studentsEnabled={engine.context?.snapshot.studentsEnabled ?? false}
          onPermissions={(enabled) =>
            swallow(
              engine.execute({
                eventId: crypto.randomUUID(),
                kind: 'permissions',
                enabled,
              }),
            )
          }
          undo={() => swallow(engine.changeHistory('undo'))}
          redo={() => swallow(engine.changeHistory('redo'))}
          undoCount={engine.historyCount.undo}
          redoCount={engine.historyCount.redo}
          clear={(scope) =>
            swallow(
              engine.execute({ eventId: crypto.randomUUID(), kind: 'clear', scope }),
            )
          }
          color={color}
          setColor={setColor}
          width={lineWidth}
          setWidth={setLineWidth}
          opacity={opacity}
          setOpacity={setOpacity}
          fontSize={fontSize}
          setFontSize={setFontSize}
          bold={bold}
          setBold={setBold}
          italic={italic}
          setItalic={setItalic}
          pressure={pressure}
          setPressure={setPressure}
          showNames={showNames}
          setShowNames={setShowNames}
          onDelete={deleteSelection}
          onFormat={() => {
            for (const object of engine.objects)
              if (selected.includes(object.id) && canEdit(object))
                swallow(
                  put({
                    ...object,
                    style: { color, width: lineWidth, opacity, fontSize, bold, italic },
                  }),
                );
          }}
          onDuplicate={() => {
            for (const object of engine.objects)
              if (selected.includes(object.id) && canEdit(object))
                swallow(
                  put(
                    {
                      ...moveAnnotation(object, 0.02, 0.02),
                      id: crypto.randomUUID(),
                      creatorId: actor!.userId,
                      creatorName: actor!.name,
                      creatorRole: actor!.role,
                      version: 0,
                    },
                    0,
                  ),
                );
          }}
          onSave={save}
        />
      </div>
      {(engine.error || localError || !engine.connected) && (
        <div
          role="status"
          className="pointer-events-none absolute left-2 top-2 max-w-sm rounded-md bg-background px-3 py-2 text-xs text-muted-foreground"
        >
          {localError ?? engine.error ?? 'Reconnecting annotations…'}
        </div>
      )}
    </div>
  );
}
