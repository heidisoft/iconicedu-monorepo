import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, {
  Circle,
  Ellipse,
  G,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import type {
  AnnotationContext,
  AnnotationCommit,
  AnnotationObject,
  AnnotationOperation,
  AnnotationPoint,
  AnnotationTool,
  AnnotationLaserStroke,
} from '@iconicedu/shared-types';
import {
  applyAnnotationCommit,
  participantColor,
  moveAnnotation,
} from '@iconicedu/utils';
import { nativeAnnotationApi } from '@/lib/classroom/annotation-api';
import { generateClientMessageId } from '@/lib/messages/client-message-id';
import {
  NativeAnnotationHistory,
  type HistoryDirection,
} from '@/lib/classroom/annotation-history';
import {
  nativeAnnotationBounds,
  hitNativeAnnotation,
  scaleNativeAnnotation,
} from '@/lib/classroom/annotation-geometry';
import { exportClassroomImage } from '@/lib/classroom/export-image';
import { useTheme } from '@/providers/theme-provider';

const tools: AnnotationTool[] = [
  'cursor',
  'select',
  'pen',
  'highlighter',
  'vanishingPen',
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
  'eraser',
  'spotlight',
  'pointerArrow',
  'stampCheck',
  'stampX',
  'stampStar',
  'stampHeart',
  'stampQuestion',
  'stampArrow',
];
const stamps: Record<string, string> = {
  stampCheck: '✓',
  stampX: '✕',
  stampStar: '★',
  stampHeart: '♥',
  stampQuestion: '?',
  stampArrow: '➜',
};
function ShapeContent({
  object,
  width,
  height,
}: {
  object: AnnotationObject;
  width: number;
  height: number;
}) {
  const points = object.points.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  }));
  if (!points.length) return null;
  const first = points[0],
    last = points[points.length - 1];
  const left = Math.min(...points.map((point) => point.x)),
    top = Math.min(...points.map((point) => point.y));
  const w = Math.max(1, Math.max(...points.map((point) => point.x)) - left),
    h = Math.max(1, Math.max(...points.map((point) => point.y)) - top);
  const style = {
    stroke: object.style.color,
    strokeWidth: (object.style.width * width) / 1000,
    opacity: object.style.opacity,
    fill: 'none',
  };
  if (object.type === 'text' || object.type.startsWith('stamp'))
    return (
      <SvgText
        x={left}
        y={top + (object.style.fontSize * width) / 1000}
        fill={object.style.color}
        fontSize={((object.type === 'text' ? object.style.fontSize : 36) * width) / 1000}
        fontWeight={object.style.bold ? 'bold' : 'normal'}
        fontStyle={object.style.italic ? 'italic' : 'normal'}
      >
        {object.type === 'text' ? object.text : stamps[object.type]}
      </SvgText>
    );
  if (object.type.startsWith('rectangle'))
    return (
      <Rect
        {...style}
        x={left}
        y={top}
        width={w}
        height={h}
        fill={object.type === 'rectangle' ? 'none' : object.style.color}
      />
    );
  if (object.type.startsWith('ellipse'))
    return (
      <Ellipse
        {...style}
        cx={left + w / 2}
        cy={top + h / 2}
        rx={w / 2}
        ry={h / 2}
        fill={object.type === 'ellipse' ? 'none' : object.style.color}
      />
    );
  if (object.type === 'diamond')
    return (
      <Polygon
        {...style}
        points={`${left + w / 2},${top} ${left + w},${top + h / 2} ${left + w / 2},${top + h} ${left},${top + h / 2}`}
      />
    );
  const path = points
    .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
    .join(' ');
  if (object.type === 'arrow' || object.type === 'doubleArrow') {
    const angle = Math.atan2(last.y - first.y, last.x - first.x),
      size = Math.max(8, style.strokeWidth * 3);
    const head = (point: { x: number; y: number }, direction: number) => (
      <Path
        {...style}
        d={`M ${point.x - size * Math.cos(direction - 0.5)} ${point.y - size * Math.sin(direction - 0.5)} L ${point.x} ${point.y} L ${point.x - size * Math.cos(direction + 0.5)} ${point.y - size * Math.sin(direction + 0.5)}`}
      />
    );
    return (
      <G>
        <Path {...style} d={path} />
        {head(last, angle)}
        {object.type === 'doubleArrow' && head(first, angle + Math.PI)}
      </G>
    );
  }
  return <Path {...style} d={path} strokeLinecap="round" strokeLinejoin="round" />;
}
function Shape(props: { object: AnnotationObject; width: number; height: number }) {
  const box = nativeAnnotationBounds(props.object, props.width, props.height);
  return (
    <G
      transform={`rotate(${props.object.rotation} ${box.x + box.width / 2} ${box.y + box.height / 2})`}
    >
      <ShapeContent {...props} />
    </G>
  );
}
const recoveryKey = (value: AnnotationContext) =>
  `classroom-annotations:${value.snapshot.roomId}:${value.actor.userId}`;
/** Screen annotations use the same room, objects and permission checks as web. */
export function NativeScreenAnnotations({
  sessionId,
  shareKey,
  token,
  width,
  height,
  active,
  composited = false,
  apiOverride,
  onContext,
}: {
  sessionId: string;
  shareKey: string;
  token?: string;
  width: number;
  height: number;
  active: boolean;
  composited?: boolean;
  apiOverride?: ReturnType<typeof nativeAnnotationApi>;
  onContext?: (context: AnnotationContext) => void;
}) {
  const api = useMemo(
    () => apiOverride ?? nativeAnnotationApi(sessionId, shareKey, token),
    [sessionId, shareKey, token, apiOverride],
  );
  const { colors } = useTheme();
  const [context, setContext] = useState<AnnotationContext | null>(null);
  useEffect(() => {
    if (context) onContext?.(context);
  }, [context, onContext]);
  const contextRef = useRef(context);
  contextRef.current = context;
  const [tool, setTool] = useState<AnnotationTool>('pen');
  const [lasers, setLasers] = useState<AnnotationLaserStroke[]>([]);
  const outgoingLasers = useRef<AnnotationLaserStroke[]>([]);
  const laserSending = useRef(false);
  const laserDirty = useRef(false);
  const laserSequence = useRef(0);
  const lastPointer = useRef(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const publishLaser = async () => {
    laserDirty.current = true;
    if (laserSending.current) return;
    laserSending.current = true;
    try {
      while (laserDirty.current) {
        laserDirty.current = false;
        await api.laser(
          outgoingLasers.current.filter((stroke) => stroke.expiresAt > Date.now()),
        );
      }
    } catch {
      setError('Unable to share laser. Try drawing again.');
    } finally {
      laserSending.current = false;
    }
  };
  const updateLaser = (object: AnnotationObject, finished: boolean) => {
    const stroke: AnnotationLaserStroke = {
      object: { ...object, points: object.points.slice(-128) },
      sequence: ++laserSequence.current,
      finished,
      expiresAt: Date.now() + 3000,
    };
    outgoingLasers.current = [
      ...outgoingLasers.current.filter(
        (value) => value.object.id !== object.id && value.expiresAt > Date.now(),
      ),
      stroke,
    ].slice(-8);
    setLasers([...outgoingLasers.current]);
    void publishLaser();
  };
  const [draft, setDraft] = useState<AnnotationObject | null>(null);
  const drawing = useRef<AnnotationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const svg = useRef<Svg>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selection = useRef<{ object: AnnotationObject; start: AnnotationPoint } | null>(
    null,
  );
  const [style, setStyle] = useState<AnnotationObject['style']>({
    color: '#008000',
    width: 3,
    opacity: 1,
    fontSize: 24,
    bold: false,
    italic: false,
  });
  const history = useRef(new NativeAnnotationHistory());
  const [, setHistoryVersion] = useState(0);
  const callbacks = useRef(
    new Map<string, (commit: AnnotationCommit, before: AnnotationObject[]) => void>(),
  );
  const queue = useRef<AnnotationOperation[]>([]);
  const busy = useRef(false);
  const recovered = useRef<string | null>(null);

  const [pending, setPending] = useState(false);
  const flush = useCallback(async () => {
    if (busy.current || !contextRef.current) return;
    busy.current = true;
    try {
      const key = recoveryKey(contextRef.current);
      while (queue.current.length) {
        await AsyncStorage.setItem(
          key,
          JSON.stringify({ savedAt: Date.now(), operations: queue.current }),
        );
        const operation = queue.current[0];
        const current: AnnotationContext | null = contextRef.current;
        if (!current) return;
        const before = current.snapshot.objects;
        const commit = await api.save(current.snapshot.roomId, operation);
        callbacks.current.get(operation.eventId)?.(commit, before);
        callbacks.current.delete(operation.eventId);
        setHistoryVersion((version) => version + 1);
        queue.current.shift();
        if (queue.current.length)
          await AsyncStorage.setItem(
            key,
            JSON.stringify({ savedAt: Date.now(), operations: queue.current }),
          );
        else await AsyncStorage.removeItem(key);
        const updated: AnnotationContext = {
          ...current,
          snapshot: applyAnnotationCommit(current.snapshot, commit),
        };
        contextRef.current = updated;
        setContext(updated);
      }
      setError(null);
    } catch {
      setError('Annotation changes are waiting to save. Tap Retry.');
    } finally {
      busy.current = false;
      setPending(queue.current.length > 0);
    }
  }, [api]);
  const save = (
    operation: Omit<AnnotationOperation, 'eventId'> | AnnotationOperation,
  ) => {
    if (pending || !contextRef.current || contextRef.current.snapshot.ended) return;
    const value = {
      ...operation,
      eventId: generateClientMessageId(),
    } as AnnotationOperation;
    callbacks.current.set(value.eventId, (commit, before) =>
      history.current.record(before, value, commit),
    );
    queue.current.push(value);
    setPending(true);
    void flush();
  };
  const changeHistory = (direction: HistoryDirection) => {
    if (!context || !editable) return;
    try {
      const plan = history.current.prepare(direction, context.snapshot);
      if (!plan) return;
      const commits: AnnotationCommit[] = [];
      for (const operation of plan.operations) {
        if (pending || !contextRef.current || contextRef.current.snapshot.ended) return;
        const value = { ...operation, eventId: generateClientMessageId() };
        callbacks.current.set(value.eventId, (commit) => {
          commits.push(commit);
          if (commits.length === plan.operations.length)
            history.current.complete(plan, commits);
        });
        queue.current.push(value);
      }
      setPending(true);
      void flush();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to change drawing history.',
      );
      setHistoryVersion((version) => version + 1);
    }
  };
  useEffect(() => {
    let mounted = true;
    const load = () => {
      if (busy.current || queue.current.length) return;
      void api
        .load()
        .then(async (value) => {
          if (!mounted) return;
          const key = recoveryKey(value);
          if (recovered.current !== key) {
            recovered.current = key;
            setStyle((previous) => ({
              ...previous,
              color: participantColor(value.actor.userId),
            }));
            const cached = await AsyncStorage.getItem(key);
            if (!mounted) return;
            if (cached && !value.snapshot.ended) {
              const recovery = JSON.parse(cached) as {
                savedAt: number;
                operations: AnnotationOperation[];
              };
              if (
                Date.now() - recovery.savedAt < 86400000 &&
                Array.isArray(recovery.operations)
              ) {
                contextRef.current = value;
                queue.current.push(...recovery.operations);
                setPending(queue.current.length > 0);
                void flush();
              }
            }
          }
          if (mounted)
            setContext((previous) =>
              previous && previous.snapshot.revision > value.snapshot.revision
                ? previous
                : value,
            );
        })
        .catch(() => {
          if (mounted) setError('Unable to load annotations. Check your connection.');
        });
    };
    load();
    const timer = setInterval(load, 750);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [api, flush]);
  const editable =
    !!context &&
    !pending &&
    !context.snapshot.ended &&
    (context.actor.role === 'educator' || context.snapshot.studentsEnabled);
  const selectedObject = context?.snapshot.objects.find(
    (object) => object.id === selected && !object.deleted,
  );
  const changeSelected = (transform: (object: AnnotationObject) => AnnotationObject) => {
    if (
      !selectedObject ||
      !editable ||
      !context ||
      (context.actor.role !== 'educator' &&
        selectedObject.creatorId !== context.actor.userId)
    )
      return;
    const transformed = transform(selectedObject);
    if (JSON.stringify(transformed) === JSON.stringify(selectedObject)) return;
    const object = {
      ...transformed,
      version: selectedObject.version + 1,
      updatedAt: Date.now(),
    };
    save({ eventId: '', kind: 'put', object, baseVersion: selectedObject.version });
  };
  const changeStyle = (patch: Partial<AnnotationObject['style']>) => {
    setStyle((previous) => ({ ...previous, ...patch }));
    changeSelected((object) => ({ ...object, style: { ...object.style, ...patch } }));
  };
  const point = (x: number, y: number): AnnotationPoint => ({
    x: Math.min(1, Math.max(0, x / width)),
    y: Math.min(1, Math.max(0, y / height)),
  });
  const start = (p: AnnotationPoint) => {
    if (!context || !editable) return;
    if (tool === 'spotlight' || tool === 'pointerArrow') {
      lastPointer.current = Date.now();
      void api
        .pointer({ point: p, tool, color: participantColor(context.actor.userId) })
        .catch(() => setError('Unable to share pointer.'));
      return;
    }
    if (tool === 'eraser') {
      const match = [...context.snapshot.objects]
        .reverse()
        .find(
          (object) =>
            !object.deleted &&
            (context.actor.role === 'educator' ||
              object.creatorId === context.actor.userId) &&
            object.points.some(
              (candidate) =>
                Math.hypot((candidate.x - p.x) * width, (candidate.y - p.y) * height) <
                24,
            ),
        );
      if (match)
        save({ eventId: '', kind: 'delete', id: match.id, baseVersion: match.version });
      return;
    }
    if (tool === 'select') {
      const match = [...context.snapshot.objects]
        .reverse()
        .find(
          (object) =>
            (context.actor.role === 'educator' ||
              object.creatorId === context.actor.userId) &&
            hitNativeAnnotation(object, p, width, height),
        );
      setSelected(match?.id ?? null);
      if (match) {
        selection.current = { object: match, start: p };
        drawing.current = match;
        setStyle(match.style);
        setText(match.text ?? '');
        setDraft(match);
      }
      return;
    }
    if (tool === 'cursor') return;
    setSelected(null);
    if (tool === 'text' && !text.trim()) {
      setError('Enter annotation text before placing it.');
      return;
    }
    const now = Date.now();
    const object: AnnotationObject = {
      id: generateClientMessageId(),
      roomId: context.snapshot.roomId,
      shareSessionId: context.snapshot.shareSessionId,
      type: tool,
      creatorId: context.actor.userId,
      creatorName: context.actor.name,
      creatorRole: context.actor.role,
      points: [p],
      style: {
        ...style,
        width: tool === 'highlighter' ? 12 : style.width,
        opacity:
          tool === 'highlighter' || tool.endsWith('Highlight') ? 0.35 : style.opacity,
      },
      rotation: 0,
      createdAt: now,
      updatedAt: now,
      version: 1,
      ...(tool === 'text' ? { text } : {}),
    };
    drawing.current = object;
    setDraft(object);
    if (tool === 'vanishingPen') updateLaser(object, false);
  };
  const move = (p: AnnotationPoint) => {
    if ((tool === 'spotlight' || tool === 'pointerArrow') && editable && context) {
      if (Date.now() - lastPointer.current >= 100) {
        lastPointer.current = Date.now();
        void api
          .pointer({ point: p, tool, color: participantColor(context.actor.userId) })
          .catch(() => setError('Unable to share pointer.'));
      }
      return;
    }
    const value = drawing.current;
    if (!value) return;
    if (selection.current) {
      const next = moveAnnotation(
        selection.current.object,
        p.x - selection.current.start.x,
        p.y - selection.current.start.y,
      );
      drawing.current = next;
      setDraft(next);
      return;
    }
    if (value.points.length >= 4900) return;
    const next = {
      ...value,
      points:
        value.type === 'pen' ||
        value.type === 'highlighter' ||
        value.type === 'vanishingPen'
          ? [...value.points, p]
          : [value.points[0], p],
    };
    drawing.current = next;
    setDraft(next);
    if (next.type === 'vanishingPen') updateLaser(next, false);
  };
  const finish = () => {
    const value = drawing.current;
    drawing.current = null;
    setDraft(null);
    if (value?.type === 'vanishingPen') {
      updateLaser(value, true);
      return;
    }
    const original = selection.current?.object;
    selection.current = null;
    if (
      value &&
      (!original || JSON.stringify(value.points) !== JSON.stringify(original.points))
    )
      save({
        eventId: '',
        kind: 'put',
        object: {
          ...value,
          version: (original?.version ?? 0) + 1,
          updatedAt: Date.now(),
        },
        baseVersion: original?.version ?? 0,
      });
  };
  return (
    <View
      style={{ position: 'absolute', width, height }}
      pointerEvents={active ? 'auto' : 'box-none'}
    >
      <View
        testID="annotation-drawing-surface"
        style={{ width, height }}
        pointerEvents={active && editable && tool !== 'cursor' ? 'auto' : 'none'}
        onStartShouldSetResponder={() => active && editable && tool !== 'cursor'}
        onResponderGrant={(event) =>
          start(point(event.nativeEvent.locationX, event.nativeEvent.locationY))
        }
        onResponderMove={(event) =>
          move(point(event.nativeEvent.locationX, event.nativeEvent.locationY))
        }
        onResponderTerminationRequest={() => false}
        onResponderRelease={finish}
        onResponderTerminate={finish}
      >
        <Svg ref={svg} width={width} height={height}>
          {!composited &&
            context?.snapshot.objects
              .filter((object) => !object.deleted)
              .map((object) => (
                <Shape key={object.id} object={object} width={width} height={height} />
              ))}
          {[
            ...lasers,
            ...(context?.lasers ?? [])
              .filter((peer) => peer.userId !== context?.actor.userId)
              .flatMap((peer) => peer.strokes),
          ]
            .filter((stroke) => stroke.expiresAt > now)
            .map((stroke) => (
              <Shape
                key={stroke.object.id}
                object={stroke.object}
                width={width}
                height={height}
              />
            ))}
          {selectedObject &&
            (() => {
              const box = nativeAnnotationBounds(draft ?? selectedObject, width, height);
              return (
                <Rect
                  x={box.x - 5}
                  y={box.y - 5}
                  width={box.width + 10}
                  height={box.height + 10}
                  stroke="#2563eb"
                  strokeDasharray="5,5"
                  fill="none"
                />
              );
            })()}
          {draft && <Shape object={draft} width={width} height={height} />}
          {context?.pointers
            ?.filter((pointer) => pointer.expiresAt > now)
            .map((pointer) => (
              <G key={pointer.userId}>
                <Circle
                  cx={pointer.point.x * width}
                  cy={pointer.point.y * height}
                  r={pointer.tool === 'spotlight' ? 18 : 5}
                  fill={pointer.color}
                  opacity={0.6}
                />
                <SvgText
                  x={pointer.point.x * width + 10}
                  y={pointer.point.y * height}
                  fill={pointer.color}
                >
                  {pointer.name}
                </SvgText>
              </G>
            ))}
        </Svg>
      </View>
      {active && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.card,
          }}
        >
          {error && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void flush();
              }}
            >
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                {error} Retry
              </Text>
            </Pressable>
          )}
          {context?.actor.role === 'student' && !context.snapshot.studentsEnabled && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.textMuted, padding: 12 }}
            >
              The host has turned off participant annotations.
            </Text>
          )}
          {pending && (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
              Saving annotations…
            </Text>
          )}
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
            {context?.snapshot.objects.filter((object) => !object.deleted).length ?? 0}{' '}
            {(context?.snapshot.objects.filter((object) => !object.deleted).length ??
              0) === 1
              ? 'annotation'
              : 'annotations'}
          </Text>
          <ScrollView horizontal>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo annotation"
              disabled={!editable || !history.current.counts.undo}
              onPress={() => changeHistory('undo')}
              style={{ padding: 12 }}
            >
              <Text style={{ color: colors.text }}>Undo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Redo annotation"
              disabled={!editable || !history.current.counts.redo}
              onPress={() => changeHistory('redo')}
              style={{ padding: 12 }}
            >
              <Text style={{ color: colors.text }}>Redo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export annotations image"
              disabled={pending || !!draft}
              onPress={() => {
                setSelected(null);
                requestAnimationFrame(() =>
                  requestAnimationFrame(() =>
                    svg.current?.toDataURL((value) => {
                      void exportClassroomImage(`data:image/png;base64,${value}`).catch(
                        () =>
                          Alert.alert(
                            'Unable to export annotations',
                            'Please try again.',
                          ),
                      );
                    }),
                  ),
                );
              }}
              style={{ padding: 12 }}
            >
              <Text style={{ color: colors.text }}>Export image</Text>
            </Pressable>
            {selectedObject && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Rotate selected annotation"
                  disabled={pending}
                  onPress={() =>
                    changeSelected((object) => ({
                      ...object,
                      rotation: (object.rotation + 15) % 360,
                    }))
                  }
                  style={{ padding: 12 }}
                >
                  <Text style={{ color: colors.text }}>Rotate</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Enlarge selected annotation"
                  disabled={pending}
                  onPress={() =>
                    changeSelected((object) => scaleNativeAnnotation(object, 1.1))
                  }
                  style={{ padding: 12 }}
                >
                  <Text style={{ color: colors.text }}>Larger</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Shrink selected annotation"
                  disabled={pending}
                  onPress={() =>
                    changeSelected((object) => scaleNativeAnnotation(object, 0.9))
                  }
                  style={{ padding: 12 }}
                >
                  <Text style={{ color: colors.text }}>Smaller</Text>
                </Pressable>
              </>
            )}
            {Object.entries({
              Black: '#000000',
              Red: '#dc2626',
              Blue: '#2563eb',
              Green: '#008000',
              Purple: '#9333ea',
            }).map(([name, color]) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`${name} annotation color`}
                disabled={pending}
                accessibilityState={{ selected: style.color === color }}
                onPress={() => changeStyle({ color })}
                style={{ padding: 12 }}
              >
                <Text style={{ color }}>{name}</Text>
              </Pressable>
            ))}
            {[2, 4, 8].map((width) => (
              <Pressable
                key={width}
                accessibilityRole="button"
                accessibilityLabel={`Annotation stroke width ${width}`}
                disabled={pending}
                onPress={() => changeStyle({ width })}
                style={{ padding: 12 }}
              >
                <Text style={{ color: colors.text }}>{width}px</Text>
              </Pressable>
            ))}
            {(tool === 'text' || selectedObject?.type === 'text') && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bold annotation text"
                  disabled={pending}
                  onPress={() => changeStyle({ bold: !style.bold })}
                  style={{ padding: 12 }}
                >
                  <Text style={{ color: colors.text }}>Bold</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Italic annotation text"
                  disabled={pending}
                  onPress={() => changeStyle({ italic: !style.italic })}
                  style={{ padding: 12 }}
                >
                  <Text style={{ color: colors.text }}>Italic</Text>
                </Pressable>
                {[16, 24, 32, 48].map((fontSize) => (
                  <Pressable
                    key={fontSize}
                    accessibilityRole="button"
                    accessibilityLabel={`Annotation text size ${fontSize}`}
                    disabled={pending}
                    onPress={() => changeStyle({ fontSize })}
                    style={{ padding: 12 }}
                  >
                    <Text style={{ color: colors.text }}>{fontSize}pt</Text>
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
          <ScrollView horizontal>
            {tools.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: value === tool }}
                onPress={() => {
                  setTool(value);
                  if (value !== 'select') setSelected(null);
                }}
                style={{ padding: 12, minHeight: 44 }}
              >
                <Text style={{ color: colors.text }}>
                  {value
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (letter) => letter.toUpperCase())}
                </Text>
              </Pressable>
            ))}
            {context?.actor.role === 'educator' && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  save({
                    eventId: '',
                    kind: 'permissions',
                    enabled: !context.snapshot.studentsEnabled,
                  })
                }
                style={{ padding: 12 }}
              >
                <Text style={{ color: colors.text }}>
                  {context.snapshot.studentsEnabled
                    ? 'Disable student annotations'
                    : 'Allow student annotations'}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={!editable}
              onPress={() =>
                Alert.alert(
                  'Clear annotations?',
                  'Clear your annotations from this screen share.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear mine',
                      style: 'destructive',
                      onPress: () => save({ eventId: '', kind: 'clear', scope: 'mine' }),
                    },
                  ],
                )
              }
              style={{ padding: 12 }}
            >
              <Text style={{ color: colors.text }}>Clear mine</Text>
            </Pressable>
            {context?.actor.role === 'educator' &&
              (['students', 'all'] as const).map((scope) => (
                <Pressable
                  key={scope}
                  accessibilityRole="button"
                  disabled={!editable}
                  accessibilityLabel={
                    scope === 'all'
                      ? 'Clear all annotations'
                      : 'Clear student annotations'
                  }
                  onPress={() =>
                    Alert.alert(
                      'Clear annotations?',
                      scope === 'all'
                        ? 'Clear every annotation on this shared screen.'
                        : 'Clear student annotations on this shared screen.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear',
                          style: 'destructive',
                          onPress: () => save({ eventId: '', kind: 'clear', scope }),
                        },
                      ],
                    )
                  }
                  style={{ padding: 12 }}
                >
                  <Text style={{ color: colors.text }}>
                    {scope === 'all' ? 'Clear all' : 'Clear students'}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
          {(tool === 'text' || selectedObject?.type === 'text') && (
            <>
              <TextInput
                accessibilityLabel="Annotation text"
                value={text}
                onChangeText={setText}
                maxLength={4000}
                style={{ color: colors.text, padding: 8 }}
              />
              {selectedObject?.type === 'text' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Apply annotation text"
                  disabled={pending || !text.trim()}
                  onPress={() => changeSelected((object) => ({ ...object, text }))}
                >
                  <Text style={{ color: colors.text }}>Apply text</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}
