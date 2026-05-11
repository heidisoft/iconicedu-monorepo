import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import {
  Check,
  Download,
  Pencil,
  RefreshCcw,
  RotateCcw,
  Send,
  Share2,
  X,
} from 'lucide-react-native';
import type { AppColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase/client';
import type { AttachmentPayload } from './attachment-sheet';

const CHANNEL_FILES_BUCKET = 'channel-files';
const PDF_CACHE_DIR = 'chat-pdf-viewer';
const ANNOTATION_CACHE_DIR = 'annotations';

const PEN_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#000000'];
const PEN_WIDTH = 4;

type AnnotationStroke = { d: string; color: string };

function isExpoGo() {
  // Block Expo Go — react-native-pdf's native module is not bundled there.
  // NativeModules.RNPDFPdfView is NOT a reliable check on SDK 55+ because the
  // New Architecture no longer registers Fabric components on the legacy bridge.
  // executionEnvironment === 'storeClient' covers both Expo Go and Snack.
  return Constants.executionEnvironment === 'storeClient';
}

function getPdfComponent(): typeof import('react-native-pdf').default | null {
  if (isExpoGo()) return null;
  // Function-scoped require avoids loading the native module in Expo Go.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
    return require('react-native-pdf')
      .default as typeof import('react-native-pdf').default;
  } catch {
    return null;
  }
}

export type ChatPdfViewerProps = {
  visible: boolean;
  url: string;
  storagePath?: string | null;
  filename?: string | null;
  colors: AppColors;
  onClose: () => void;
  onSend?: (attachment: AttachmentPayload) => void;
};

function sanitizeFilename(filename: string | null | undefined, url: string): string {
  const cleanUrl = url.split('?')[0] ?? '';
  const ext = cleanUrl.includes('.') ? cleanUrl.slice(cleanUrl.lastIndexOf('.')) : '.pdf';
  const base = Array.from(filename ?? `document${ext}`)
    .map((char) => {
      const code = char.charCodeAt(0);
      if ('<>:"/\\|?*'.includes(char) || code <= 31) return '-';
      return char;
    })
    .join('')
    .trim();
  return base.length ? base : `document${ext}`;
}

async function resolveSignedFileUrl(
  url: string,
  storagePath?: string | null,
): Promise<string> {
  if (!storagePath) return url;
  const { data, error } = await supabase.storage
    .from(CHANNEL_FILES_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl)
    throw error ?? new Error('Unable to resolve document URL');
  return data.signedUrl;
}

async function downloadPdfToCache(url: string, filename: string): Promise<File> {
  const cacheDir = new Directory(Paths.cache, PDF_CACHE_DIR);
  if (!cacheDir.exists) {
    cacheDir.create({ idempotent: true, intermediates: true });
  }
  const target = new File(cacheDir, filename);
  if (target.exists) target.delete();
  return File.downloadFileAsync(url, target, { idempotent: true });
}

export function ChatPdfViewer({
  visible,
  url,
  storagePath,
  filename,
  colors,
  onClose,
  onSend,
}: ChatPdfViewerProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<'share' | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Annotation state
  const [annotationMode, setAnnotationMode] = useState(false);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]!);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [sendAnnotationBusy, setSendAnnotationBusy] = useState(false);
  const currentPathRef = useRef('');
  const svgRef = useRef<Svg>(null);

  const PdfComponent = useMemo(() => getPdfComponent(), []);
  const canRenderInApp = !!PdfComponent;

  const normalizedFilename = useMemo(
    () => sanitizeFilename(filename, storagePath ?? url),
    [filename, storagePath, url],
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLocalFile(null);
    setPageCount(null);
    setCurrentPage(1);
    setAnnotationMode(false);
    setStrokes([]);
    setSaveState('idle');
    void resolveSignedFileUrl(url, storagePath)
      .then(async (resolvedUrl) => {
        const downloadedFile = await downloadPdfToCache(resolvedUrl, normalizedFilename);
        if (cancelled) return;
        setLocalFile(downloadedFile);
        if (!canRenderInApp) {
          await WebBrowser.openBrowserAsync(resolvedUrl, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          });
          if (!cancelled) onClose();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    canRenderInApp,
    loadAttempt,
    normalizedFilename,
    onClose,
    storagePath,
    url,
    visible,
  ]);

  const ensureLocalFile = useCallback(async () => {
    if (localFile) return localFile;
    throw new Error('Document is not ready yet.');
  }, [localFile]);

  const retryLoad = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const handleShare = useCallback(async () => {
    if (!localFile || actionBusy) return;
    setActionBusy('share');
    try {
      const file = await ensureLocalFile();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
    } catch (err) {
      Alert.alert(
        'Unable to share PDF',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, ensureLocalFile, localFile]);

  const handleSave = useCallback(async () => {
    if (!localFile || saveState !== 'idle') return;
    setSaveState('saving');
    try {
      const file = await ensureLocalFile();
      const docsDir = new Directory(Paths.document);
      const destinationFile = new File(docsDir, normalizedFilename);
      if (destinationFile.exists) destinationFile.delete();
      file.copy(destinationFile);
      setSaveState('done');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (err) {
      setSaveState('idle');
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Unable to save PDF', message);
    }
  }, [localFile, saveState, ensureLocalFile, normalizedFilename]);

  // ── Annotation ────────────────────────────────────────────────────────────

  const drawGesture = useMemo(
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

  const isActionDisabled = !localFile || actionBusy !== null || loading || !!error;
  const isSaveDisabled = !localFile || saveState !== 'idle' || loading || !!error;

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
            {/* Annotation toolbar — slides in above the PDF */}
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

            {/* PDF stage */}
            <View
              style={styles.pdfStage}
              onLayout={(e) =>
                setOverlaySize({
                  width: Math.round(e.nativeEvent.layout.width),
                  height: Math.round(e.nativeEvent.layout.height),
                })
              }
            >
              {localFile && !error && PdfComponent ? (
                <PdfComponent
                  source={{ uri: localFile.uri }}
                  style={styles.pdf}
                  trustAllCerts={false}
                  enableAnnotationRendering={true}
                  scrollEnabled={!annotationMode}
                  onLoadComplete={(numberOfPages) => {
                    setPageCount(numberOfPages);
                    setCurrentPage(1);
                  }}
                  onPageChanged={(page) => {
                    setCurrentPage(page);
                  }}
                  onError={(pdfError) => {
                    setError(
                      pdfError instanceof Error
                        ? pdfError.message
                        : 'Unable to render PDF preview',
                    );
                  }}
                />
              ) : (
                <View style={styles.centerState}>
                  {loading ? (
                    <>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={styles.helperText}>
                        {canRenderInApp
                          ? 'Opening PDF preview…'
                          : 'Opening PDF in browser…'}
                      </Text>
                      {!canRenderInApp && (
                        <Text style={styles.helperSubtext}>
                          Expo Go does not include the native PDF viewer, so this document
                          will open in the browser.
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.errorTitle}>Unable to load PDF</Text>
                      <Text style={styles.errorBody}>{error}</Text>
                      <Pressable
                        onPress={retryLoad}
                        style={styles.retryButton}
                        accessibilityLabel="Retry PDF preview"
                      >
                        <RefreshCcw size={16} color="#fff" />
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              {/* Drawing overlay — appears in annotation mode */}
              {annotationMode && overlaySize.width > 0 && (
                <GestureDetector gesture={drawGesture}>
                  <View style={StyleSheet.absoluteFill}>
                    <Svg
                      ref={svgRef}
                      width={overlaySize.width}
                      height={overlaySize.height}
                      style={StyleSheet.absoluteFill}
                    >
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

            {/* Bottom bar */}
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

                  <View style={styles.bottomBarCenter}>
                    <Text style={styles.pageIndicator}>
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
                    accessibilityLabel="Close PDF viewer"
                  >
                    <X size={22} color="#fff" />
                  </Pressable>

                  <View style={styles.bottomBarCenter}>
                    {!!pageCount && !loading && !error ? (
                      <Text style={styles.pageIndicator}>
                        {currentPage} of {pageCount}
                      </Text>
                    ) : (
                      <Text style={styles.filenameLabel} numberOfLines={1}>
                        {normalizedFilename}
                      </Text>
                    )}
                  </View>

                  <View style={styles.bottomBarActions}>
                    {!!onSend && (
                      <Pressable
                        onPress={handleEnterAnnotation}
                        disabled={!localFile || loading || !!error}
                        style={[
                          styles.bottomBarButton,
                          (!localFile || loading || !!error) && styles.buttonDisabled,
                        ]}
                        accessibilityLabel="Annotate PDF"
                        accessibilityState={{
                          disabled: !localFile || loading || !!error,
                        }}
                      >
                        <Pencil size={20} color="#fff" />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={handleShare}
                      disabled={isActionDisabled}
                      style={[
                        styles.bottomBarButton,
                        isActionDisabled && styles.buttonDisabled,
                      ]}
                      accessibilityLabel="Share PDF"
                      accessibilityState={{ disabled: isActionDisabled }}
                    >
                      <Share2 size={20} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={handleSave}
                      disabled={isSaveDisabled}
                      style={[
                        styles.bottomBarButton,
                        isSaveDisabled && saveState === 'idle' && styles.buttonDisabled,
                        saveState === 'done' && styles.bottomBarButtonDone,
                      ]}
                      accessibilityLabel="Save PDF"
                      accessibilityState={{ disabled: isSaveDisabled }}
                    >
                      {saveState === 'saving' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : saveState === 'done' ? (
                        <Check size={20} color="#fff" />
                      ) : (
                        <Download size={20} color="#fff" />
                      )}
                    </Pressable>
                  </View>
                </View>
              )}

              {(actionBusy || saveState !== 'idle') && (
                <View style={styles.footerNotice}>
                  {saveState === 'done' ? (
                    <>
                      <Check size={16} color={colors.teal} />
                      <Text style={styles.footerNoticeText}>Saved to Files</Text>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator size="small" color={colors.teal} />
                      <Text style={styles.footerNoticeText}>
                        {actionBusy === 'share' ? 'Preparing PDF to share…' : 'Saving…'}
                      </Text>
                    </>
                  )}
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
  // PDF stage
  pdfStage: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 8,
  },
  pdf: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  helperText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  helperSubtext: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorTitle: {
    color: '#fff',
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
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // Bottom bar — identical structure to chat-image-viewer
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
  bottomBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicator: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  filenameLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
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
  bottomBarButtonDone: {
    backgroundColor: '#14b8a6',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14b8a6',
  },
  buttonDisabled: {
    opacity: 0.4,
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
