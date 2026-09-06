import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Image as SvgImage, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Download, Pencil, RotateCcw, Send, Share2, X } from 'lucide-react-native';
import type { AppColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase/client';
import type { AttachmentPayload } from './attachment-sheet';

const CHANNEL_FILES_BUCKET = 'channel-files';
const MAX_ZOOM = 4;
const IMAGE_CACHE_DIR = 'chat-image-viewer';
const ANNOTATION_CACHE_DIR = 'annotations';

const PEN_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#000000'];
const PEN_WIDTH = 4;

type AnnotationStroke = { d: string; color: string };

export type ChatImageViewerItem = {
  key: string;
  originalUrl: string;
  previewUrl?: string | null;
  storagePath?: string | null;
  filename?: string | null;
  mimeType?: string | null;
};

type ChatImageViewerProps = {
  visible: boolean;
  items: ChatImageViewerItem[];
  initialIndex: number;
  colors: AppColors;
  onClose: () => void;
  onSend?: (attachment: AttachmentPayload) => void;
};

function sanitizeFilename(
  filename: string | null | undefined,
  index: number,
  url: string,
): string {
  const fallbackExt = (() => {
    const cleanUrl = url.split('?')[0] ?? '';
    const ext = cleanUrl.includes('.') ? cleanUrl.slice(cleanUrl.lastIndexOf('.')) : '';
    return ext || '.jpg';
  })();
  const base = Array.from(filename ?? `image-${index + 1}${fallbackExt}`)
    .map((char) => {
      const code = char.charCodeAt(0);
      if ('<>:"/\\|?*'.includes(char) || code <= 31) return '-';
      return char;
    })
    .join('')
    .trim();
  return base.length ? base : `image-${index + 1}${fallbackExt}`;
}

function inferImageMimeType(item: ChatImageViewerItem, index: number): string {
  if (item.mimeType) return item.mimeType;
  const filename = sanitizeFilename(
    item.filename,
    index,
    item.storagePath ?? item.originalUrl,
  );
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

async function resolveSignedImageUrl(item: ChatImageViewerItem): Promise<string> {
  if (!item.storagePath) return item.originalUrl;
  const { data, error } = await supabase.storage
    .from(CHANNEL_FILES_BUCKET)
    .createSignedUrl(item.storagePath, 3600);
  if (error || !data?.signedUrl) throw error ?? new Error('Unable to resolve image URL');
  return data.signedUrl;
}

async function downloadImageToCache(url: string, filename: string): Promise<File> {
  const cacheDir = new Directory(Paths.cache, IMAGE_CACHE_DIR);
  if (!cacheDir.exists) {
    cacheDir.create({ idempotent: true, intermediates: true });
  }
  const target = new File(cacheDir, filename);
  if (target.exists) target.delete();
  return File.downloadFileAsync(url, target, { idempotent: true });
}

function ZoomableImage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, 1, MAX_ZOOM);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        scale.value = 1;
        savedScale.value = 1;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pinch}>
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Image
          source={{ uri }}
          style={[{ width, height, resizeMode: 'contain' }, animatedStyle]}
        />
      </View>
    </GestureDetector>
  );
}

export function ChatImageViewer({
  visible,
  items,
  initialIndex,
  colors,
  onClose,
  onSend,
}: ChatImageViewerProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<ChatImageViewerItem>>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});
  const [errorKeys, setErrorKeys] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState<'share' | 'save' | null>(null);
  const [mediaStageHeight, setMediaStageHeight] = useState(0);

  // Annotation state
  const [annotationMode, setAnnotationMode] = useState(false);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]!);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [sendAnnotationBusy, setSendAnnotationBusy] = useState(false);
  const currentPathRef = useRef('');
  const svgRef = useRef<Svg>(null);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    setAnnotationMode(false);
    setStrokes([]);
    setCurrentPath('');
    currentPathRef.current = '';
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: false, index: initialIndex });
    });
  }, [visible, initialIndex]);

  // Exit annotation mode when swiping to a different image
  useEffect(() => {
    setAnnotationMode(false);
    setStrokes([]);
    setCurrentPath('');
    currentPathRef.current = '';
  }, [currentIndex]);

  const resolveItemUrl = useCallback(async (item: ChatImageViewerItem) => {
    setLoadingKeys((prev) => ({ ...prev, [item.key]: true }));
    setErrorKeys((prev) => {
      const next = { ...prev };
      delete next[item.key];
      return next;
    });
    try {
      const nextUrl = await resolveSignedImageUrl(item);
      setResolvedUrls((prev) => ({ ...prev, [item.key]: nextUrl }));
      return nextUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load image';
      setErrorKeys((prev) => ({ ...prev, [item.key]: message }));
      throw error;
    } finally {
      setLoadingKeys((prev) => ({ ...prev, [item.key]: false }));
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const pending = items.filter((item) => item.storagePath && !resolvedUrls[item.key]);
    if (!pending.length) return;
    let cancelled = false;
    void Promise.allSettled(
      pending.map(async (item) => {
        if (cancelled) return;
        await resolveItemUrl(item);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [visible, items, resolvedUrls, resolveItemUrl]);

  const activeItem = items[currentIndex];
  const activeResolvedUrl = activeItem
    ? (resolvedUrls[activeItem.key] ?? activeItem.previewUrl ?? activeItem.originalUrl)
    : null;

  const ensureActiveLocalFile = useCallback(async () => {
    if (!activeItem || !activeResolvedUrl) throw new Error('No image selected');
    const filename = sanitizeFilename(
      activeItem.filename,
      currentIndex,
      activeItem.storagePath ?? activeItem.originalUrl,
    );
    return downloadImageToCache(activeResolvedUrl, filename);
  }, [activeItem, activeResolvedUrl, currentIndex]);

  const handleShare = useCallback(async () => {
    if (!activeItem || !activeResolvedUrl || actionBusy) return;
    setActionBusy('share');
    try {
      const localFile = await ensureActiveLocalFile();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(localFile.uri, {
        mimeType: inferImageMimeType(activeItem, currentIndex),
      });
    } catch (error) {
      Alert.alert(
        'Unable to share image',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, activeItem, activeResolvedUrl, currentIndex, ensureActiveLocalFile]);

  const handleSave = useCallback(async () => {
    if (!activeItem || !activeResolvedUrl || actionBusy) return;
    setActionBusy('save');
    try {
      const localFile = await ensureActiveLocalFile();
      const selectedDirectory = await Directory.pickDirectoryAsync();
      const filename = sanitizeFilename(
        activeItem.filename,
        currentIndex,
        activeItem.storagePath ?? activeItem.originalUrl,
      );
      const destinationFile = new File(selectedDirectory, filename);
      if (destinationFile.exists) destinationFile.delete();
      localFile.copy(destinationFile);
      Alert.alert('Saved', 'Image saved to the selected folder.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Unable to save image', message);
      }
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, activeItem, activeResolvedUrl, currentIndex, ensureActiveLocalFile]);

  const handleRetry = useCallback(() => {
    if (!activeItem) return;
    void resolveItemUrl(activeItem);
  }, [activeItem, resolveItemUrl]);

  // ── Annotation ────────────────────────────────────────────────────────────

  const drawGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((e) => {
          const p = `M${e.x.toFixed(1)},${e.y.toFixed(1)}`;
          currentPathRef.current = p;
          setCurrentPath(p);
        })
        .onUpdate((e) => {
          const p = `${currentPathRef.current} L${e.x.toFixed(1)},${e.y.toFixed(1)}`;
          currentPathRef.current = p;
          setCurrentPath(p);
        })
        .onEnd(() => {
          if (currentPathRef.current) {
            const d = currentPathRef.current;
            setStrokes((prev) => [...prev, { d, color: penColor }]);
          }
          currentPathRef.current = '';
          setCurrentPath('');
        })
        .onFinalize(() => {
          currentPathRef.current = '';
          setCurrentPath('');
        }),
    [penColor],
  );

  const handleEnterAnnotation = useCallback(() => {
    setAnnotationMode(true);
  }, []);

  const handleCancelAnnotation = useCallback(() => {
    setAnnotationMode(false);
    setStrokes([]);
    setCurrentPath('');
    currentPathRef.current = '';
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const handleSendAnnotation = useCallback(async () => {
    if (!svgRef.current || strokes.length === 0 || sendAnnotationBusy) return;
    setSendAnnotationBusy(true);
    try {
      await new Promise<void>((resolve, reject) => {
        (
          svgRef.current as Svg & { toDataURL(cb: (b64: string) => void): void }
        ).toDataURL((base64) => {
          const annotFilename = `annotation-${Date.now()}.png`;
          const dir = `${FileSystem.cacheDirectory ?? ''}${ANNOTATION_CACHE_DIR}/`;
          void FileSystem.makeDirectoryAsync(dir, { intermediates: true })
            .then(() =>
              FileSystem.writeAsStringAsync(`${dir}${annotFilename}`, base64, {
                encoding: FileSystem.EncodingType.Base64,
              }),
            )
            .then(() => {
              onSend?.({
                uri: `${dir}${annotFilename}`,
                name: annotFilename,
                mimeType: 'image/png',
              });
              resolve();
            })
            .catch(reject);
        });
      });
      setAnnotationMode(false);
      setStrokes([]);
      onClose();
    } catch (err) {
      Alert.alert(
        'Unable to send',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSendAnnotationBusy(false);
    }
  }, [strokes.length, sendAnnotationBusy, onSend, onClose]);

  // ─────────────────────────────────────────────────────────────────────────

  const pageWidth = Math.max(width, 1);
  const viewerHorizontalPadding = 12;
  const mediaWidth = Math.max(pageWidth - viewerHorizontalPadding * 2, 1);
  const pageHeight = Math.max(mediaStageHeight || height * 0.6, 1);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={annotationMode ? handleCancelAnnotation : onClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View
          style={[
            styles.safeArea,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.backdrop}>
            {/* Annotation toolbar */}
            {annotationMode && (
              <View style={styles.annotationToolbar}>
                <View style={styles.colorRow}>
                  {PEN_COLORS.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => setPenColor(color)}
                      style={[
                        styles.colorDot,
                        { backgroundColor: color },
                        penColor === color && styles.colorDotActive,
                      ]}
                      accessibilityLabel={`Pen color ${color}`}
                    />
                  ))}
                </View>
                <Pressable
                  onPress={handleUndo}
                  disabled={strokes.length === 0}
                  style={[
                    styles.toolbarIconBtn,
                    strokes.length === 0 && styles.buttonDisabled,
                  ]}
                  accessibilityLabel="Undo last stroke"
                >
                  <RotateCcw size={20} color="#fff" />
                </Pressable>
              </View>
            )}

            <View
              style={styles.mediaStage}
              onLayout={(event) => {
                const nextHeight = Math.round(event.nativeEvent.layout.height);
                setMediaStageHeight((prev) => (prev === nextHeight ? prev : nextHeight));
              }}
            >
              <FlatList
                ref={listRef}
                data={items}
                keyExtractor={(item) => item.key}
                horizontal
                pagingEnabled
                scrollEnabled={!annotationMode}
                initialScrollIndex={initialIndex}
                getItemLayout={(_, index) => ({
                  length: pageWidth,
                  offset: pageWidth * index,
                  index,
                })}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(
                    event.nativeEvent.contentOffset.x / pageWidth,
                  );
                  setCurrentIndex(clamp(nextIndex, 0, Math.max(items.length - 1, 0)));
                }}
                renderItem={({ item }) => {
                  const uri =
                    resolvedUrls[item.key] ?? item.previewUrl ?? item.originalUrl;
                  const isLoading = !!loadingKeys[item.key] && !resolvedUrls[item.key];
                  const error = errorKeys[item.key];
                  const isActive = item.key === activeItem?.key;
                  return (
                    <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
                      {error ? (
                        <View style={styles.centerState}>
                          <Text style={styles.errorTitle}>Unable to load image</Text>
                          <Text style={styles.errorBody}>{error}</Text>
                          <Pressable
                            onPress={handleRetry}
                            style={[
                              styles.retryButton,
                              { backgroundColor: colors.action },
                            ]}
                          >
                            <Text
                              style={[
                                styles.retryButtonText,
                                { color: colors.actionForeground },
                              ]}
                            >
                              Retry
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          {/* Normal view — disable zoom in annotation mode */}
                          {annotationMode && isActive ? (
                            <View
                              style={{ width: mediaWidth, height: pageHeight }}
                              onLayout={(e) =>
                                setOverlaySize({
                                  width: Math.round(e.nativeEvent.layout.width),
                                  height: Math.round(e.nativeEvent.layout.height),
                                })
                              }
                            >
                              {/* Plain image (no zoom) under the SVG */}
                              <Image
                                source={{ uri }}
                                style={{
                                  width: mediaWidth,
                                  height: pageHeight,
                                  resizeMode: 'contain',
                                }}
                              />
                              {/* Drawing overlay — SVG includes image as background for capture */}
                              {overlaySize.width > 0 && (
                                <GestureDetector gesture={drawGesture}>
                                  <View style={StyleSheet.absoluteFill}>
                                    <Svg
                                      ref={svgRef}
                                      width={overlaySize.width}
                                      height={overlaySize.height}
                                      style={StyleSheet.absoluteFill}
                                    >
                                      {/* Image background baked into the SVG capture */}
                                      <SvgImage
                                        x={0}
                                        y={0}
                                        width={overlaySize.width}
                                        height={overlaySize.height}
                                        href={{ uri }}
                                        preserveAspectRatio="xMidYMid meet"
                                      />
                                      {strokes.map((stroke, i) => (
                                        <Path
                                          key={i}
                                          d={stroke.d}
                                          stroke={stroke.color}
                                          strokeWidth={PEN_WIDTH}
                                          fill="none"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      ))}
                                      {!!currentPath && (
                                        <Path
                                          d={currentPath}
                                          stroke={penColor}
                                          strokeWidth={PEN_WIDTH}
                                          fill="none"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      )}
                                    </Svg>
                                  </View>
                                </GestureDetector>
                              )}
                            </View>
                          ) : (
                            <ZoomableImage
                              uri={uri}
                              width={mediaWidth}
                              height={pageHeight}
                            />
                          )}
                          {isLoading && (
                            <View style={styles.loadingOverlay}>
                              <ActivityIndicator size="large" color="#fff" />
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  );
                }}
              />
            </View>

            <View style={styles.bottomBar}>
              {annotationMode ? (
                <View style={styles.bottomBarTopRow}>
                  <Pressable
                    onPress={handleCancelAnnotation}
                    style={styles.bottomBarButton}
                    accessibilityLabel="Cancel annotation"
                  >
                    <X size={22} color="#fff" />
                  </Pressable>

                  <View style={styles.bottomBarPagination}>
                    <Text style={styles.annotationHint}>
                      {strokes.length > 0
                        ? `${strokes.length} stroke${strokes.length > 1 ? 's' : ''}`
                        : 'Start drawing'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleSendAnnotation}
                    disabled={strokes.length === 0 || sendAnnotationBusy}
                    style={[
                      styles.sendButton,
                      { backgroundColor: colors.action },
                      (strokes.length === 0 || sendAnnotationBusy) &&
                        styles.buttonDisabled,
                    ]}
                    accessibilityLabel="Send annotation"
                    accessibilityState={{
                      disabled: strokes.length === 0 || sendAnnotationBusy,
                    }}
                  >
                    {sendAnnotationBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Send size={20} color="#fff" />
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.bottomBarTopRow}>
                  <Pressable
                    onPress={onClose}
                    style={styles.bottomBarButton}
                    accessibilityLabel="Close image viewer"
                  >
                    <X size={22} color="#fff" />
                  </Pressable>
                  <View style={styles.bottomBarPagination}>
                    {items.length > 1 ? (
                      <View style={styles.paginationDots}>
                        {items.map((item, index) => {
                          const isActive = index === currentIndex;
                          return (
                            <View
                              key={item.key}
                              style={[
                                styles.paginationDot,
                                isActive && styles.paginationDotActive,
                              ]}
                            />
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.paginationSpacer} />
                    )}
                  </View>
                  <View style={styles.bottomBarActions}>
                    {!!onSend && (
                      <Pressable
                        onPress={handleEnterAnnotation}
                        disabled={!activeResolvedUrl}
                        style={[
                          styles.bottomBarButton,
                          !activeResolvedUrl && styles.buttonDisabled,
                        ]}
                        accessibilityLabel="Annotate image"
                        accessibilityState={{ disabled: !activeResolvedUrl }}
                      >
                        <Pencil size={20} color="#fff" />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={handleShare}
                      disabled={!activeResolvedUrl || actionBusy !== null}
                      style={[
                        styles.bottomBarButton,
                        (!activeResolvedUrl || actionBusy !== null) &&
                          styles.buttonDisabled,
                      ]}
                      accessibilityLabel="Share image"
                    >
                      <Share2 size={20} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={handleSave}
                      disabled={!activeResolvedUrl || actionBusy !== null}
                      style={[
                        styles.bottomBarButton,
                        (!activeResolvedUrl || actionBusy !== null) &&
                          styles.buttonDisabled,
                      ]}
                      accessibilityLabel="Save image"
                    >
                      <Download size={20} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              )}

              {actionBusy && (
                <View style={styles.footerNotice}>
                  <ActivityIndicator size="small" color={colors.teal} />
                  <Text style={styles.footerNoticeText}>
                    {actionBusy === 'share'
                      ? 'Preparing image to share…'
                      : 'Saving image…'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  // Annotation toolbar
  annotationToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(10,14,20,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  toolbarIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  mediaStage: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  bottomBar: {
    marginHorizontal: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: 'rgba(10,14,20,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
  },
  bottomBarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomBarPagination: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  annotationHint: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 24,
  },
  paginationSpacer: {
    minHeight: 24,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  errorBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerNotice: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(17,24,39,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footerNoticeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
