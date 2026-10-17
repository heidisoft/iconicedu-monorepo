import { useReducedMotion } from './use-reduced-motion';
import { NativeWhiteboardToolbar, type Tool } from './native-whiteboard-toolbar';
import { useNativeWhiteboardFollow } from './use-native-whiteboard-follow';
import { useNativeWhiteboardLasers } from './use-native-whiteboard-lasers';
import {
  exportClassroomImage,
  exportClassroomDocument,
} from '@/lib/classroom/export-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  Minimize2,
  Maximize2,
  SlidersHorizontal,
  Download,
  RotateCcw,
  Trash2,
  Presentation,
  Users,
  Eye,
  Pencil,
} from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type {
  WhiteboardElementVM,
  WhiteboardViewportVM,
  WhiteboardViewportPresenceVM,
  WhiteboardLaserPresenceVM,
  WhiteboardLaserSampleVM,
  WhiteboardOperationVM,
  WhiteboardSnapshotVM,
} from '@iconicedu/shared-types';
import { capabilityGet, capabilityPost } from '@/lib/api/http-client';
import { useTheme } from '@/providers/theme-provider';
import { generateClientMessageId } from '@/lib/messages/client-message-id';
import { classroomCanvasHtml } from './canvas/canvas.generated';

export interface NativeWhiteboardRepository {
  viewports?(): Promise<WhiteboardViewportPresenceVM[]>;
  publishViewport?(viewport: WhiteboardViewportVM): Promise<unknown>;
  lasers?(): Promise<WhiteboardLaserPresenceVM[]>;
  publishLaser?(samples: WhiteboardLaserSampleVM[]): Promise<unknown>;
  load(): Promise<WhiteboardSnapshotVM>;
  save(operation: WhiteboardOperationVM): Promise<WhiteboardSnapshotVM>;
}

/** Offline canvas only; capability and API transport never enter the WebView. */
export function NativeWhiteboard({
  token,
  repository,
  onPresentation,
  onPending,
  visible = true,
  onClose,
  closeLabel = 'Return to video',
  onExpand,
  controls,
  embedded = false,
  onPublisher,
  publishView,
}: {
  token: string;
  onPublisher?: (publish: (() => Promise<void>) | null) => void;
  publishView?: (tag: number) => Promise<void>;
  repository?: NativeWhiteboardRepository;
  onPresentation?: (active: boolean) => void;
  onPending?: (pending: boolean) => void;
  visible?: boolean;
  onClose?: () => void;
  closeLabel?: string;
  onExpand?: () => void;
  controls?: React.ReactNode;
  embedded?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const webview = useRef<WebView>(null);
  const shareView = useRef<View>(null);
  const [snapshot, setSnapshot] = useState<WhiteboardSnapshotVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [boardWidth, setBoardWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [styleState, setStyleState] = useState<{
    tool: Tool;
    color: string;
    width: number;
    fill: string;
    selectionType?: string;
  }>();
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const publisher = useCallback(async () => {
    const tag = findNodeHandle(shareView.current);
    if (!ready || !tag || !publishView)
      throw new Error('Wait for the whiteboard to load before recording.');
    await publishView(tag);
  }, [publishView, ready]);
  useEffect(() => {
    onPublisher?.(publisher);
    return () => onPublisher?.(null);
  }, [onPublisher, publisher]);
  const receiveViewport = useCallback((viewport: WhiteboardViewportVM) => {
    if (drawing.current) return;
    webview.current?.injectJavaScript(
      `window.classroomViewport?.(${JSON.stringify(viewport)}); true;`,
    );
  }, []);
  const follow = useNativeWhiteboardFollow(
    token,
    repository,
    snapshot,
    ready && visible,
    receiveViewport,
  );
  const actorId = snapshot?.actorId;
  const receiveLasers = useCallback(
    (presence: WhiteboardLaserPresenceVM[]) => {
      const peers = presence.filter((peer) => peer.actorId !== actorId);
      webview.current?.injectJavaScript(
        `window.classroomLasers && window.classroomLasers(${JSON.stringify(peers).replaceAll('<', '\\u003c')}); true;`,
      );
    },
    [actorId],
  );
  const publishLaser = useNativeWhiteboardLasers(
    token,
    repository,
    ready && visible,
    receiveLasers,
  );

  const queue = useRef<WhiteboardOperationVM[]>([]);
  const busy = useRef(false);
  const drawing = useRef(false);
  const recovered = useRef<string | null>(null);
  const recoveryKey = () =>
    current.current
      ? `classroom-drawing:${current.current.id}:${current.current.role}`
      : null;
  const current = useRef(snapshot);
  current.current = snapshot;
  const flush = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length) {
        setSaving(true);
        const key = recoveryKey();
        if (key && !repository)
          await AsyncStorage.setItem(
            key,
            JSON.stringify({ savedAt: Date.now(), operations: queue.current }),
          );
        const value = repository
          ? await repository.save(queue.current[0])
          : await capabilityPost<WhiteboardSnapshotVM>(
              '/whiteboards/current/operations',
              token,
              queue.current[0],
            );
        queue.current.shift();
        setSnapshot((previous) =>
          previous && previous.revision > value.revision ? previous : value,
        );
        setError(null);
        if (key && !repository) {
          if (queue.current.length)
            await AsyncStorage.setItem(
              key,
              JSON.stringify({ savedAt: Date.now(), operations: queue.current }),
            );
          else await AsyncStorage.removeItem(key);
        }
      }
    } catch {
      setError('Changes are waiting to save. Keep this board open and tap Retry.');
    } finally {
      busy.current = false;
      setSaving(queue.current.length > 0);
    }
  }, [token, repository]);
  const save = (operation: WhiteboardOperationVM) => {
    queue.current.push(operation);
    setSaving(true);
    void flush();
  };
  useEffect(() => {
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const value = repository
          ? await repository.load()
          : await capabilityGet<WhiteboardSnapshotVM>('/whiteboards/current', token);
        if (active) {
          if (!repository && recovered.current !== value.id) {
            recovered.current = value.id;
            const cached = await AsyncStorage.getItem(
              `classroom-drawing:${value.id}:${value.role}`,
            );
            if (cached) {
              const recovery = JSON.parse(cached) as {
                savedAt: number;
                operations: WhiteboardOperationVM[];
              };
              if (
                Date.now() - recovery.savedAt < 86400000 &&
                Array.isArray(recovery.operations)
              ) {
                current.current = value;
                queue.current.push(...recovery.operations);
                setSaving(queue.current.length > 0);
                void flush();
              }
            }
          }
          setSnapshot((previous) => {
            if (previous && previous.revision > value.revision) return previous;
            // Follow presentation stops even while local strokes are drawing or retrying.
            // Preserve unsaved canvas content until the edit queue has finished.
            if (previous && (busy.current || queue.current.length || drawing.current))
              return {
                ...previous,
                revision: value.revision,
                role: value.role,
                actorId: value.actorId,
                presence: value.presence,
                presentationActive: value.presentationActive,
                document: {
                  ...previous.document,
                  presenting: value.document.presenting,
                  presentation: value.document.presentation,
                },
              };
            return value;
          });
          if (!busy.current && !queue.current.length && !drawing.current) setError(null);
        }
      } catch {
        if (active) setError('Unable to load the whiteboard. Check your connection.');
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, repository, flush]);
  useEffect(() => {
    if (!ready || !snapshot || queue.current.length || drawing.current) return;
    const message = {
      elements: snapshot.document.pages[0]?.elements ?? [],
      editable: snapshot.role === 'teacher' || snapshot.document.studentEditing,
      dark: isDark,
    };
    webview.current?.injectJavaScript(
      `window.classroomScene && window.classroomScene(${JSON.stringify(message).replaceAll('<', '\\u003c')}); true;`,
    );
  }, [snapshot, ready, isDark]);
  useEffect(() => {
    if (!visible && !embedded) setReady(false);
  }, [visible, embedded]);
  const close = () => {
    if (drawing.current) {
      Alert.alert('Finishing your drawing', 'Wait a moment for the last stroke to save.');
      return;
    }
    onClose?.();
  };
  useEffect(() => {
    setReady(false);
  }, [embedded]);
  const lastPresentation = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!snapshot) return;
    const active = snapshot.presentationActive === true;
    const key = active
      ? (snapshot.document.presentation?.presentationId ??
        snapshot.document.presentation?.presenterId ??
        'active')
      : 'closed';
    if (key !== lastPresentation.current) {
      lastPresentation.current = key;
      onPresentation?.(active);
    }
  }, [snapshot, onPresentation]);
  useEffect(() => {
    onPending?.(saving);
  }, [saving, onPending]);
  const button = (label: string, onPress: () => void) => {
    const Icon =
      label.startsWith('Export') || label.startsWith('Download')
        ? Download
        : label.startsWith('Discard')
          ? Trash2
          : label.startsWith('Retry')
            ? RotateCcw
            : label.includes('present')
              ? Presentation
              : label.includes('editing') || label.includes('annotate')
                ? Pencil
                : Eye;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          padding: 12,
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Icon size={20} color={colors.text} />
        <Text style={{ color: colors.text, flexShrink: 1 }}>{label}</Text>
      </Pressable>
    );
  };
  const Container = embedded ? View : Modal;
  const Insets = embedded ? View : SafeAreaView;
  return (
    <Container
      {...(embedded
        ? { style: { flex: 1 } }
        : {
            visible,
            animationType: reducedMotion ? ('none' as const) : ('slide' as const),
            onRequestClose: close,
          })}
    >
      <SafeAreaProvider>
        <Insets
          style={{ flex: 1, backgroundColor: colors.card }}
          testID={`whiteboard-saved-elements-${snapshot?.document.pages[0]?.elements.filter((element) => !element.deleted).length ?? 0}`}
          accessibilityLabel="Class whiteboard"
          onLayout={(event) => setBoardWidth(event.nativeEvent.layout.width)}
        >
          {error && (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {error}
            </Text>
          )}
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 10,
              flexWrap: 'wrap',
            }}
          >
            <Text accessibilityRole="text" style={{ color: colors.text }}>
              {error
                ? saving
                  ? 'Unsaved · retrying'
                  : 'Reconnecting…'
                : saving
                  ? 'Saving…'
                  : snapshot
                    ? 'Saved'
                    : 'Connecting…'}
            </Text>
            <View
              accessible
              accessibilityLabel={`Whiteboard participants: ${snapshot?.presence.map((person) => person.name).join(', ') || 'Waiting for participants'}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Users size={16} color={colors.text} />
              {snapshot?.presence.slice(0, 4).map((person) => (
                <View
                  key={person.id}
                  style={{
                    borderRadius: 16,
                    minWidth: 28,
                    minHeight: 28,
                    padding: 4,
                    backgroundColor: colors.actionSubtle,
                  }}
                >
                  <Text style={{ color: colors.text }}>
                    {person.name
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase() || '?'}
                  </Text>
                </View>
              ))}
              {!!snapshot && snapshot.presence.length > 4 && (
                <Text style={{ color: colors.text }}>
                  +{snapshot.presence.length - 4}
                </Text>
              )}
            </View>
          </View>
          {error &&
            button('Retry saving', () => {
              void flush();
            })}
          {optionsOpen && (
            <ScrollView
              style={{
                position: 'absolute',
                zIndex: 3,
                bottom: 132,
                maxHeight: '65%',
                right: 12,
                width: Math.min(300, Math.max(0, boardWidth - 24)),
                padding: 12,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 4, paddingBottom: 12 }}
            >
              {snapshot?.role === 'student' && !snapshot.document.studentEditing && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: colors.textMuted, padding: 12 }}
                >
                  View only. Ask the host to allow editing.
                </Text>
              )}
              <Text style={{ color: colors.text, padding: 12 }}>Follow viewport</Text>
              {follow.following !== 'free' && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: colors.textMuted, padding: 12 }}
                >
                  {follow.status === 'following'
                    ? 'Following participant’s view'
                    : follow.status === 'reconnecting'
                      ? 'Unable to sync views. Check your connection.'
                      : 'Waiting for participant’s view…'}
                </Text>
              )}
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: follow.following === 'tutor' }}
                onPress={() => follow.setFollowing('tutor')}
                style={{ padding: 12 }}
              >
                <Text style={{ color: colors.text }}>
                  {follow.following === 'tutor' ? '✓ ' : ''}Follow tutor (default)
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: follow.following === 'free' }}
                onPress={() => follow.setFollowing('free')}
                style={{ padding: 12 }}
              >
                <Text style={{ color: colors.text }}>
                  {follow.following === 'free' ? '✓ ' : ''}Explore freely
                </Text>
              </Pressable>
              {snapshot?.presence
                .filter((person) => person.id !== snapshot.actorId)
                .map((person) => (
                  <Pressable
                    key={person.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`Follow ${person.name}`}
                    accessibilityState={{ checked: follow.following === person.id }}
                    onPress={() => follow.setFollowing(person.id)}
                    style={{ padding: 12 }}
                  >
                    <Text style={{ color: colors.text }}>
                      {follow.following === person.id ? '✓ ' : ''}Follow {person.name}
                    </Text>
                  </Pressable>
                ))}
              {button('Export whiteboard image', () => {
                webview.current?.injectJavaScript(
                  'window.classroomAction?.("export"); true;',
                );
                setOptionsOpen(false);
              })}
              {button('Export whiteboard SVG', () => {
                webview.current?.injectJavaScript(
                  'window.classroomAction?.("export-svg"); true;',
                );
                setOptionsOpen(false);
              })}
              {saving && (
                <>
                  {button('Download unsaved edits', () => {
                    void exportClassroomDocument(
                      JSON.stringify({
                        schemaVersion: 1,
                        boardId: snapshot?.id,
                        savedAt: Date.now(),
                        operations: queue.current,
                      }),
                      'json',
                    ).catch(() =>
                      Alert.alert(
                        'Export failed',
                        'Unable to export unsaved edits. Please retry.',
                      ),
                    );
                  })}
                  {button('Discard unsaved edits', () =>
                    Alert.alert(
                      'Discard unsaved edits?',
                      'This removes only your pending changes. Saved class drawings remain.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Discard',
                          style: 'destructive',
                          onPress: () => {
                            if (busy.current || drawing.current) {
                              Alert.alert(
                                'Please wait',
                                'Wait until the current save or stroke finishes, then retry.',
                              );
                              return;
                            }
                            busy.current = true;
                            setDiscarding(true);
                            void (async () => {
                              try {
                                const value = repository
                                  ? await repository.load()
                                  : await capabilityGet<WhiteboardSnapshotVM>(
                                      '/whiteboards/current',
                                      token,
                                    );
                                const key = recoveryKey();
                                if (key && !repository)
                                  await AsyncStorage.removeItem(key);
                                queue.current = [];
                                setSaving(false);
                                setError(null);
                                setSnapshot(value);
                              } catch {
                                setError(
                                  'Unable to discard unsaved edits. Please retry.',
                                );
                              } finally {
                                busy.current = false;
                                setDiscarding(false);
                              }
                            })();
                          },
                        },
                      ],
                    ),
                  )}
                </>
              )}
              {snapshot &&
                (!snapshot.presentationActive ||
                  snapshot.role === 'teacher' ||
                  snapshot.actorId === snapshot.document.presentation?.presenterId) && (
                  <>
                    {button(
                      snapshot.presentationActive
                        ? 'Stop presenting board'
                        : 'Present board',
                      () =>
                        save({
                          id: generateClientMessageId(),
                          type: 'presentation',
                          enabled: !snapshot.presentationActive,
                        }),
                    )}
                  </>
                )}
              {snapshot?.role === 'teacher' && (
                <>
                  {button(
                    snapshot.document.studentEditing
                      ? 'Disable student editing'
                      : 'Allow student editing',
                    () =>
                      save({
                        id: generateClientMessageId(),
                        type: 'student-editing',
                        enabled: !snapshot.document.studentEditing,
                      }),
                  )}
                </>
              )}
            </ScrollView>
          )}
          <NativeWhiteboardToolbar
            onFollow={() => setOptionsOpen(true)}
            followLabel={
              follow.following === 'tutor'
                ? 'Follow tutor'
                : follow.following === 'free'
                  ? 'Explore freely'
                  : `Follow ${snapshot?.presence.find((person) => person.id === follow.following)?.name ?? 'participant'}`
            }
            styleState={styleState}
            ready={ready}
            editable={
              snapshot?.role === 'teacher' || snapshot?.document.studentEditing === true
            }
            canClear={snapshot?.role === 'teacher'}
            onCommand={(command) =>
              webview.current?.injectJavaScript(
                `window.classroomCommand?.(${JSON.stringify(command)}); true;`,
              )
            }
            onClear={() =>
              Alert.alert('Clear whiteboard?', 'This clears the class drawing.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: () => {
                    if (snapshot)
                      save({
                        id: generateClientMessageId(),
                        type: 'clear-page',
                        pageId: snapshot.document.pages[0].id,
                      });
                  },
                },
              ])
            }
          />
          <View
            ref={shareView}
            collapsable={false}
            pointerEvents={discarding ? 'none' : 'auto'}
            style={{ flex: 1 }}
          >
            <WebView
              ref={webview}
              source={{ html: classroomCanvasHtml }}
              originWhitelist={['about:blank']}
              javaScriptEnabled
              scrollEnabled={false}
              nestedScrollEnabled
              style={{ flex: 1 }}
              onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
              onMessage={(event) => {
                try {
                  const message = JSON.parse(event.nativeEvent.data) as {
                    type?: string;
                    viewport?: WhiteboardViewportVM;
                    tool?: Tool;
                    color?: string;
                    width?: number;
                    fill?: string;
                    selectionType?: string;
                    elements?: WhiteboardElementVM[];
                    dataUrl?: string;
                    svg?: string;
                    x?: number;
                    y?: number;
                    button?: 'down' | 'up';
                  };
                  if (
                    message.type === 'tool-state' &&
                    message.tool &&
                    typeof message.color === 'string' &&
                    typeof message.width === 'number' &&
                    typeof message.fill === 'string'
                  ) {
                    setStyleState({
                      tool: message.tool,
                      color: message.color,
                      width: message.width,
                      fill: message.fill,
                      selectionType: message.selectionType,
                    });
                    return;
                  }
                  if (message.type === 'viewport' && message.viewport) {
                    const v = message.viewport;
                    if (
                      Number.isFinite(v.centerX) &&
                      Number.isFinite(v.centerY) &&
                      Number.isFinite(v.zoom)
                    )
                      follow.publish(v);
                    return;
                  }
                  if (message.type === 'laser') {
                    if (
                      typeof message.x === 'number' &&
                      Number.isFinite(message.x) &&
                      typeof message.y === 'number' &&
                      Number.isFinite(message.y) &&
                      (message.button === 'down' || message.button === 'up')
                    )
                      publishLaser({
                        x: message.x,
                        y: message.y,
                        button: message.button,
                      });
                    return;
                  }
                  if (message.type === 'export-error') {
                    Alert.alert(
                      'Unable to export whiteboard',
                      'Please try exporting the drawing again.',
                    );
                    return;
                  }
                  if (message.type === 'export-svg' && typeof message.svg === 'string') {
                    void exportClassroomDocument(message.svg, 'svg').catch(() =>
                      Alert.alert(
                        'Export failed',
                        'Unable to export this drawing. Please retry.',
                      ),
                    );
                    return;
                  }
                  if (message.type === 'export') {
                    if (typeof message.dataUrl !== 'string') return;
                    void exportClassroomImage(message.dataUrl).catch((cause) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : 'Unable to export this drawing. Please retry.',
                      ),
                    );
                    return;
                  }
                  if (message.type === 'drawing') {
                    drawing.current = true;
                    setSaving(true);
                    onPending?.(true);
                    return;
                  }
                  if (message.type === 'ready') {
                    setReady(true);
                    return;
                  }
                  if (
                    message.type === 'elements' &&
                    Array.isArray(message.elements) &&
                    current.current
                  ) {
                    drawing.current = false;
                    save({
                      id: generateClientMessageId(),
                      type: 'elements',
                      pageId: current.current.document.pages[0].id,
                      elements: message.elements,
                    });
                  }
                } catch {
                  setError('Unable to read drawing changes. Please retry.');
                }
              }}
              onError={() => setError('Unable to open the drawing canvas. Please retry.')}
            />
          </View>
          <View
            style={{
              position: 'absolute',
              zIndex: 2,
              right: 12,
              bottom: 76,
              flexDirection: 'row-reverse',
              gap: 8,
            }}
          >
            {onExpand && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Expand whiteboard to full screen"
                onPress={() => {
                  if (drawing.current) {
                    Alert.alert(
                      'Finishing your drawing',
                      'Wait a moment for the last stroke to save.',
                    );
                    return;
                  }
                  onExpand();
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Maximize2 size={20} color={colors.text} />
              </Pressable>
            )}
            {onClose && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                onPress={close}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Minimize2 size={20} color={colors.text} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                optionsOpen ? 'Close whiteboard options' : 'Whiteboard options'
              }
              accessibilityState={{ expanded: optionsOpen }}
              onPress={() => setOptionsOpen((previous) => !previous)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <SlidersHorizontal size={20} color={colors.text} />
            </Pressable>
          </View>
          {controls && (
            <View style={{ position: 'absolute', zIndex: 2, left: 12, bottom: 76 }}>
              {controls}
            </View>
          )}
        </Insets>
      </SafeAreaProvider>
    </Container>
  );
}
