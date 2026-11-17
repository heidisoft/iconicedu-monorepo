import { useMeetingAlert } from './use-meeting-alert';
import { NativeClassroomError } from './native-classroom-error';
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
import { findNodeHandle, Modal, Pressable, Text, View } from 'react-native';
import {
  Fullscreen,
  Binoculars,
  Scan,
  ZoomIn,
  ZoomOut,
  Minimize,
  Download,
  RotateCcw,
  Trash2,
  Presentation,
  Square,
  Users,
  Eye,
  Pencil,
} from 'lucide-react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
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
const CANVAS_SOURCE = { html: classroomCanvasHtml };

export function NativeWhiteboard({
  token,
  repository,
  onPresentation,
  onPending,
  visible = true,
  onClose,
  onExpand,
  expanded = false,
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
  onExpand?: () => void;
  expanded?: boolean;
  controls?: React.ReactNode;
  embedded?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const showAlert = useMeetingAlert();
  const reducedMotion = useReducedMotion();
  const safeArea = useSafeAreaInsets();
  const webview = useRef<WebView>(null);
  const shareView = useRef<View>(null);
  const [snapshot, setSnapshot] = useState<WhiteboardSnapshotVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toolbarMenu, setToolbarMenu] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  const [boardHeight, setBoardHeight] = useState(0);
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
  const receiveViewport = useCallback(
    (viewport: WhiteboardViewportVM, sourceKey?: string) => {
      if (drawing.current) return;
      webview.current?.injectJavaScript(
        `window.classroomViewport?.(${JSON.stringify(viewport)}, ${JSON.stringify(sourceKey ?? null)}); true;`,
      );
    },
    [],
  );
  const follow = useNativeWhiteboardFollow(
    token,
    repository,
    snapshot,
    ready && visible,
    receiveViewport,
  );
  useEffect(() => {
    if (ready)
      webview.current?.injectJavaScript(
        `window.classroomWriters?.(${JSON.stringify(follow.writers ?? [])}, ${JSON.stringify(snapshot?.presence ?? []).replaceAll('<', '\\u003c')}); true;`,
      );
  }, [ready, follow.writers, snapshot?.presence]);
  useEffect(() => {
    if (follow.following === 'free')
      webview.current?.injectJavaScript('window.classroomCancelFollow?.(); true;');
  }, [follow.following]);
  const actorId = snapshot?.actorId;
  const receiveLasers = useCallback(
    (presence: WhiteboardLaserPresenceVM[]) => {
      const peers = presence
        .filter((peer) => peer.actorId !== actorId)
        .map((peer) => ({
          ...peer,
          name: current.current?.presence.find((person) => person.id === peer.actorId)
            ?.name,
        }));
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
      showAlert('Finishing your drawing', 'Wait a moment for the last stroke to save.');
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
    const Icon = label.startsWith('Stop sharing')
      ? Square
      : label.startsWith('Export') || label.startsWith('Download')
        ? Download
        : label.startsWith('Discard')
          ? Trash2
          : label.startsWith('Retry')
            ? RotateCcw
            : label.toLowerCase().includes('present')
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
          onLayout={(event) => {
            setBoardWidth(event.nativeEvent.layout.width);
            setBoardHeight(event.nativeEvent.layout.height);
          }}
        >
          {error && <NativeClassroomError message={error} />}
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              top: 12 + (embedded ? 0 : (safeArea?.top ?? 0)),
              zIndex: 4,
            }}
          >
            <NativeWhiteboardToolbar
              availableWidth={boardWidth}
              availableHeight={boardHeight}
              menu={toolbarMenu}
              onMenuChange={setToolbarMenu}
              moreContent={
                <>
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
                  {snapshot?.role === 'student' && !snapshot.document.studentEditing && (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={{ color: colors.textMuted, padding: 12 }}
                    >
                      View only. Ask the host to allow editing.
                    </Text>
                  )}
                  {button('Export whiteboard image', () => {
                    webview.current?.injectJavaScript(
                      'window.classroomAction?.("export"); true;',
                    );
                    setToolbarMenu(null);
                  })}
                  {button('Export whiteboard SVG', () => {
                    webview.current?.injectJavaScript(
                      'window.classroomAction?.("export-svg"); true;',
                    );
                    setToolbarMenu(null);
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
                          showAlert(
                            'Export failed',
                            'Unable to export unsaved edits. Please retry.',
                          ),
                        );
                      })}
                      {button('Discard unsaved edits', () =>
                        showAlert(
                          'Discard unsaved edits?',
                          'This removes only your pending changes. Saved class drawings remain.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Discard',
                              style: 'destructive',
                              onPress: () => {
                                if (busy.current || drawing.current) {
                                  showAlert(
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
                      (!!snapshot.actorId &&
                        snapshot.actorId ===
                          snapshot.document.presentation?.presenterId)) && (
                      <>
                        {button(
                          snapshot.presentationActive
                            ? 'Stop sharing for everyone'
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
                </>
              }
              onFollow={follow.focusTutor}
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
                showAlert('Clear whiteboard?', 'This clears the class drawing.', [
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
          </View>
          <View
            ref={shareView}
            onTouchStart={() => setToolbarMenu(null)}
            collapsable={false}
            pointerEvents={discarding ? 'none' : 'auto'}
            style={{ flex: 1 }}
          >
            <WebView
              ref={webview}
              source={CANVAS_SOURCE}
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
                    showAlert(
                      'Unable to export whiteboard',
                      'Please try exporting the drawing again.',
                    );
                    return;
                  }
                  if (message.type === 'export-svg' && typeof message.svg === 'string') {
                    void exportClassroomDocument(message.svg, 'svg').catch(() =>
                      showAlert(
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
              bottom: 12,
              flexDirection: 'row',
              gap: 0,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Focus active participant"
              accessibilityHint="Center once on the participant currently writing."
              onLongPress={() =>
                showAlert(
                  'Focus active participant',
                  'Center once on the participant currently writing.',
                )
              }
              onPress={follow.focusActive}
              disabled={!ready}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Binoculars size={20} color={colors.text} />
            </Pressable>
            {(
              [
                ['Fit content', Scan, { type: 'fit' }],
                ['Zoom in', ZoomIn, { type: 'zoom', delta: 0.1 }],
                ['Zoom out', ZoomOut, { type: 'zoom', delta: -0.1 }],
                ['Reset zoom to 100%', RotateCcw, { type: 'reset-zoom' }],
              ] as const
            ).map(([label, Icon, command]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={label}
                disabled={!ready}
                onPress={() =>
                  webview.current?.injectJavaScript(
                    `window.classroomCommand?.(${JSON.stringify(command)}); true;`,
                  )
                }
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.card,

                  opacity: ready ? 1 : 0.5,
                }}
              >
                <Icon size={20} color={colors.text} />
              </Pressable>
            ))}
            {(onExpand || (!embedded && onClose)) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  expanded || (!onExpand && !embedded)
                    ? 'Collapse whiteboard'
                    : 'Expand whiteboard to full screen'
                }
                onPress={() => {
                  if (drawing.current) {
                    showAlert(
                      'Finishing your drawing',
                      'Wait a moment for the last stroke to save.',
                    );
                    return;
                  }
                  (onExpand ?? onClose)?.();
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.card,
                }}
              >
                {expanded || (!onExpand && !embedded) ? (
                  <Minimize size={20} color={colors.text} />
                ) : (
                  <Fullscreen size={20} color={colors.text} />
                )}
              </Pressable>
            )}
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
