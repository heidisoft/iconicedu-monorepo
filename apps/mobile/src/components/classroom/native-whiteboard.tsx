import { useNativeWhiteboardLasers } from './use-native-whiteboard-lasers';
import { exportClassroomImage } from '@/lib/classroom/export-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Minimize2, Maximize2, SlidersHorizontal } from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type {
  WhiteboardElementVM,
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
}: {
  token: string;
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
  const webview = useRef<WebView>(null);
  const [snapshot, setSnapshot] = useState<WhiteboardSnapshotVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [boardWidth, setBoardWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const button = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ padding: 12, minHeight: 44 }}
    >
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
  const Container = embedded ? View : Modal;
  const Insets = embedded ? View : SafeAreaView;
  return (
    <Container
      {...(embedded
        ? { style: { flex: 1 } }
        : { visible, animationType: 'slide' as const, onRequestClose: close })}
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
              <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
                {saving ? 'Saving…' : 'Saved'}
              </Text>
              {snapshot?.role === 'student' && !snapshot.document.studentEditing && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: colors.textMuted, padding: 12 }}
                >
                  View only. Ask the host to allow editing.
                </Text>
              )}
              {button('Educational library', () => {
                webview.current?.injectJavaScript(
                  'window.classroomAction?.("library"); true;',
                );
                setOptionsOpen(false);
              })}
              {button('Export whiteboard image', () => {
                webview.current?.injectJavaScript(
                  'window.classroomAction?.("export"); true;',
                );
                setOptionsOpen(false);
              })}
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
                  {button('Clear board', () =>
                    Alert.alert('Clear whiteboard?', 'This clears the class drawing.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: () =>
                          save({
                            id: generateClientMessageId(),
                            type: 'clear-page',
                            pageId: snapshot.document.pages[0].id,
                          }),
                      },
                    ]),
                  )}
                </>
              )}
            </ScrollView>
          )}
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
                  elements?: WhiteboardElementVM[];
                  dataUrl?: string;
                  x?: number;
                  y?: number;
                  button?: 'down' | 'up';
                };
                if (message.type === 'laser') {
                  if (
                    typeof message.x === 'number' &&
                    Number.isFinite(message.x) &&
                    typeof message.y === 'number' &&
                    Number.isFinite(message.y) &&
                    (message.button === 'down' || message.button === 'up')
                  )
                    publishLaser({ x: message.x, y: message.y, button: message.button });
                  return;
                }
                if (message.type === 'export-error') {
                  Alert.alert(
                    'Unable to export whiteboard',
                    'Please try exporting the drawing again.',
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
