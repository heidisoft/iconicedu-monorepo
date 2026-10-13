import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  AnnotationObject,
  AnnotationOperation,
  AnnotationPoint,
  AnnotationTool,
} from '@iconicedu/shared-types';
import { applyAnnotationCommit, participantColor } from '@iconicedu/utils';
import { nativeAnnotationApi } from '@/lib/classroom/annotation-api';
import { generateClientMessageId } from '@/lib/messages/client-message-id';
import { useTheme } from '@/providers/theme-provider';

const tools: AnnotationTool[] = [
  'cursor',
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
function Shape({
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
/** Screen annotations use the same room, objects and permission checks as web. */
export function NativeScreenAnnotations({
  sessionId,
  shareKey,
  token,
  width,
  height,
  active,
  composited = false,
}: {
  sessionId: string;
  shareKey: string;
  token?: string;
  width: number;
  height: number;
  active: boolean;
  composited?: boolean;
}) {
  const api = useMemo(
    () => nativeAnnotationApi(sessionId, shareKey, token),
    [sessionId, shareKey, token],
  );
  const { colors } = useTheme();
  const [context, setContext] = useState<AnnotationContext | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const [tool, setTool] = useState<AnnotationTool>('pen');
  const [draft, setDraft] = useState<AnnotationObject | null>(null);
  const drawing = useRef<AnnotationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const queue = useRef<AnnotationOperation[]>([]);
  const busy = useRef(false);
  const recovered = useRef<string | null>(null);
  const recoveryKey = (value: AnnotationContext) =>
    `classroom-annotations:${value.snapshot.roomId}:${value.actor.userId}`;
  const [pending, setPending] = useState(false);
  const flush = async () => {
    if (busy.current || !contextRef.current) return;
    busy.current = true;
    try {
      const key = recoveryKey(contextRef.current);
      while (queue.current.length) {
        await AsyncStorage.setItem(
          key,
          JSON.stringify({ savedAt: Date.now(), operations: queue.current }),
        );
        const commit = await api.save(
          contextRef.current.snapshot.roomId,
          queue.current[0],
        );
        queue.current.shift();
        if (queue.current.length)
          await AsyncStorage.setItem(
            key,
            JSON.stringify({ savedAt: Date.now(), operations: queue.current }),
          );
        else await AsyncStorage.removeItem(key);
        setContext((previous) =>
          previous
            ? { ...previous, snapshot: applyAnnotationCommit(previous.snapshot, commit) }
            : previous,
        );
      }
      setError(null);
    } catch {
      setError('Annotation changes are waiting to save. Tap Retry.');
    } finally {
      busy.current = false;
      setPending(queue.current.length > 0);
    }
  };
  const save = (
    operation: Omit<AnnotationOperation, 'eventId'> | AnnotationOperation,
  ) => {
    queue.current.push({
      ...operation,
      eventId: generateClientMessageId(),
    } as AnnotationOperation);
    setPending(true);
    void flush();
  };
  useEffect(() => {
    let mounted = true;
    const load = () => {
      if (drawing.current || busy.current || queue.current.length) return;
      void api
        .load()
        .then(async (value) => {
          if (!mounted) return;
          const key = recoveryKey(value);
          if (recovered.current !== key) {
            recovered.current = key;
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
  }, [api]);
  const editable =
    !!context &&
    !context.snapshot.ended &&
    (context.actor.role === 'educator' || context.snapshot.studentsEnabled);
  const point = (x: number, y: number): AnnotationPoint => ({
    x: Math.min(1, Math.max(0, x / width)),
    y: Math.min(1, Math.max(0, y / height)),
  });
  const start = (p: AnnotationPoint) => {
    if (!context || !editable) return;
    if (tool === 'spotlight' || tool === 'pointerArrow') {
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
    if (tool === 'cursor') return;
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
        color: participantColor(context.actor.userId),
        width: tool === 'highlighter' ? 12 : 3,
        opacity: tool === 'highlighter' || tool.endsWith('Highlight') ? 0.35 : 1,
        fontSize: 24,
        bold: false,
        italic: false,
      },
      rotation: 0,
      createdAt: now,
      updatedAt: now,
      version: 1,
      ...(tool === 'text' ? { text } : {}),
    };
    drawing.current = object;
    setDraft(object);
  };
  const move = (p: AnnotationPoint) => {
    const value = drawing.current;
    if (!value) return;
    if (value.points.length >= 4900) return;
    const next = {
      ...value,
      points:
        value.type === 'pen' || value.type === 'highlighter'
          ? [...value.points, p]
          : [value.points[0], p],
    };
    drawing.current = next;
    setDraft(next);
  };
  const finish = () => {
    const value = drawing.current;
    drawing.current = null;
    setDraft(null);
    if (value) save({ eventId: '', kind: 'put', object: value, baseVersion: 0 });
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
        <Svg width={width} height={height}>
          {!composited &&
            context?.snapshot.objects
              .filter((object) => !object.deleted)
              .map((object) => (
                <Shape key={object.id} object={object} width={width} height={height} />
              ))}
          {draft && <Shape object={draft} width={width} height={height} />}
          {context?.pointers?.map((pointer) => (
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
          {pending && (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
              Saving annotations…
            </Text>
          )}
          <ScrollView horizontal>
            {tools.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: value === tool }}
                onPress={() => setTool(value)}
                style={{ padding: 12, minHeight: 44 }}
              >
                <Text style={{ color: colors.text }}>{value}</Text>
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
          </ScrollView>
          {tool === 'text' && (
            <TextInput
              accessibilityLabel="Annotation text"
              value={text}
              onChangeText={setText}
              maxLength={4000}
              style={{ color: colors.text, padding: 8 }}
            />
          )}
        </View>
      )}
    </View>
  );
}
