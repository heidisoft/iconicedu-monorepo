import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Download, Share2, X } from 'lucide-react-native';
import type { AppColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase/client';

const CHANNEL_FILES_BUCKET = 'channel-files';
const MAX_ZOOM = 4;
const IMAGE_CACHE_DIR = 'chat-image-viewer';

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
}: ChatImageViewerProps) {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<ChatImageViewerItem>>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});
  const [errorKeys, setErrorKeys] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState<'share' | 'save' | null>(null);
  const [mediaStageHeight, setMediaStageHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: false, index: initialIndex });
    });
  }, [visible, initialIndex]);

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
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Photo library access is required to save images.');
      }
      await MediaLibrary.saveToLibraryAsync(localFile.uri);
      Alert.alert('Saved', 'Image saved to your photo library.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Unable to save image', message);
      }
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, activeItem, activeResolvedUrl, ensureActiveLocalFile]);

  const handleRetry = useCallback(() => {
    if (!activeItem) return;
    void resolveItemUrl(activeItem);
  }, [activeItem, resolveItemUrl]);

  const pageWidth = Math.max(width, 1);
  const viewerHorizontalPadding = 12;
  const mediaWidth = Math.max(pageWidth - viewerHorizontalPadding * 2, 1);
  const pageHeight = Math.max(mediaStageHeight || height * 0.6, 1);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.backdrop}>
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
                  return (
                    <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
                      {error ? (
                        <View style={styles.centerState}>
                          <Text style={styles.errorTitle}>Unable to load image</Text>
                          <Text style={styles.errorBody}>{error}</Text>
                          <Pressable onPress={handleRetry} style={styles.retryButton}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <ZoomableImage
                            uri={uri}
                            width={mediaWidth}
                            height={pageHeight}
                          />
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
                  <Pressable
                    onPress={handleShare}
                    disabled={!activeResolvedUrl || actionBusy !== null}
                    style={styles.bottomBarButton}
                    accessibilityLabel="Share image"
                  >
                    <Share2 size={20} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={!activeResolvedUrl || actionBusy !== null}
                    style={styles.bottomBarButton}
                    accessibilityLabel="Save image"
                  >
                    <Download size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>

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
        </SafeAreaView>
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
  mediaStage: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 72,
    paddingBottom: 72,
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  errorBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#14b8a6',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
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
    fontSize: 13,
    fontWeight: '500',
  },
});
