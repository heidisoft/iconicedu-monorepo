import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Download, RefreshCcw, Share2, X } from 'lucide-react-native';
import type { AppColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase/client';

const CHANNEL_FILES_BUCKET = 'channel-files';
const PDF_CACHE_DIR = 'chat-pdf-viewer';

function supportsNativePdfPreview() {
  if (Constants.executionEnvironment === 'storeClient') return false;
  if (Constants.appOwnership === 'expo') return false;
  return !!NativeModules.RNPDFPdfView;
}

function getPdfComponent(): typeof import('react-native-pdf').default | null {
  if (!supportsNativePdfPreview()) return null;
  // Function-scoped require avoids loading the native module in Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  return require('react-native-pdf').default as typeof import('react-native-pdf').default;
}

type ChatPdfViewerProps = {
  visible: boolean;
  url: string;
  storagePath?: string | null;
  filename?: string | null;
  colors: AppColors;
  onClose: () => void;
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
}: ChatPdfViewerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<'share' | 'save' | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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
      const localFile = await ensureLocalFile();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(localFile.uri, {
        mimeType: 'application/pdf',
      });
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
    if (!localFile || actionBusy) return;
    setActionBusy('save');
    try {
      const localFile = await ensureLocalFile();
      const destinationDirectory = await Directory.pickDirectoryAsync();
      const destinationFile = new File(destinationDirectory, normalizedFilename);
      if (destinationFile.exists) destinationFile.delete();
      localFile.copy(destinationFile);
      Alert.alert('Saved', 'PDF saved to the selected Files folder.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Unable to save PDF', message);
      }
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, ensureLocalFile, localFile, normalizedFilename]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.shell}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              style={styles.headerButton}
              accessibilityLabel="Close PDF viewer"
            >
              <X size={22} color={colors.text} />
            </Pressable>

            <View style={styles.headerTitleWrap}>
              <Text
                style={[styles.headerTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {normalizedFilename}
              </Text>
              {!!pageCount && !loading && !error && (
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  {currentPage} of {pageCount}
                </Text>
              )}
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={handleShare}
                disabled={!localFile || actionBusy !== null || loading || !!error}
                style={[
                  styles.headerButton,
                  (!localFile || actionBusy !== null || loading || !!error) &&
                    styles.headerButtonDisabled,
                ]}
                accessibilityLabel="Share PDF"
                accessibilityState={{
                  disabled: !localFile || actionBusy !== null || loading || !!error,
                }}
              >
                <Share2 size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!localFile || actionBusy !== null || loading || !!error}
                style={[
                  styles.headerButton,
                  (!localFile || actionBusy !== null || loading || !!error) &&
                    styles.headerButtonDisabled,
                ]}
                accessibilityLabel="Save PDF"
                accessibilityState={{
                  disabled: !localFile || actionBusy !== null || loading || !!error,
                }}
              >
                <Download size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.documentStage}>
            {localFile && !error && PdfComponent ? (
              <View style={styles.pdfCard}>
                <View accessibilityLabel="PDF preview" style={styles.pdf}>
                  <PdfComponent
                    source={{ uri: localFile.uri }}
                    style={styles.pdf}
                    trustAllCerts={false}
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
                </View>
              </View>
            ) : (
              <View style={styles.centerState}>
                {loading ? (
                  <>
                    <ActivityIndicator size="large" color={colors.teal} />
                    <Text style={[styles.helperText, { color: colors.text }]}>
                      {canRenderInApp
                        ? 'Opening PDF preview…'
                        : 'Opening PDF in browser…'}
                    </Text>
                    <Text style={[styles.helperSubtext, { color: colors.textMuted }]}>
                      {canRenderInApp
                        ? 'Preparing a local preview for faster paging and sharing.'
                        : 'Expo Go does not include the native PDF viewer, so this document will open in the browser.'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.errorTitle, { color: colors.text }]}>
                      Unable to load PDF
                    </Text>
                    <Text style={[styles.errorBody, { color: colors.textMuted }]}>
                      {error}
                    </Text>
                    <Pressable
                      onPress={retryLoad}
                      style={[styles.retryButton, { backgroundColor: colors.tealBg }]}
                      accessibilityLabel="Retry PDF preview"
                    >
                      <RefreshCcw size={16} color={colors.teal} />
                      <Text style={[styles.retryButtonText, { color: colors.teal }]}>
                        Retry
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>

          {actionBusy && (
            <View
              style={[
                styles.footerNotice,
                {
                  backgroundColor: colors.card,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <ActivityIndicator size="small" color={colors.teal} />
              <Text style={[styles.footerNoticeText, { color: colors.text }]}>
                {actionBusy === 'share' ? 'Preparing PDF to share…' : 'Saving PDF…'}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  shell: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  headerButtonDisabled: {
    opacity: 0.45,
  },
  documentStage: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pdfCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  pdf: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  helperText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  helperSubtext: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerNotice: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footerNoticeText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
