import { useNativeWhiteboardLasers } from './use-native-whiteboard-lasers';
import { exportClassroomImage } from '@/lib/classroom/export-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
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
  controls,
}: {
  token: string;
  repository?: NativeWhiteboardRepository;
  onPresentation?: (active: boolean) => void;
  onPending?: (pending: boolean) => void;
  visible?: boolean;
  onClose?: () => void;
  controls?: React.ReactNode;
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
        setSnapshot(value);
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
    const refresh = async () => {
      if (busy.current || queue.current.length || drawing.current) return;
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
          setSnapshot((previous) =>
            previous && previous.revision > value.revision ? previous : value,
          );
          setError(null);
        }
      } catch {
        if (active) setError('Unable to load the whiteboard. Check your connection.');
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
    if (!visible) setReady(false);
  }, [visible]);
  const close = () => {
    if (drawing.current) {
      Alert.alert('Finishing your drawing', 'Wait a moment for the last stroke to save.');
      return;
    }
    onClose?.();
  };
  const lastPresentation = useRef(false);
  useEffect(() => {
    if (!snapshot) return;
    const active = snapshot.presentationActive === true;
    if (active !== lastPresentation.current) {
      lastPresentation.current = active;
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
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.card }}
          onLayout={(event) => setBoardWidth(event.nativeEvent.layout.width)}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {onClose && button('Close whiteboard', close)}
            <Text accessibilityRole="header" style={{ color: colors.text, padding: 12 }}>
              Class whiteboard
            </Text>
          </View>
          {boardWidth < 600 &&
            button('Whiteboard options', () => setOptionsOpen((previous) => !previous))}
          {error && (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {error}
            </Text>
          )}
          {error &&
            button('Retry saving', () => {
              void flush();
            })}
          {(boardWidth >= 600 || optionsOpen) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
                {saving ? 'Saving…' : 'Saved'}
              </Text>
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
            </View>
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
          {controls}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
