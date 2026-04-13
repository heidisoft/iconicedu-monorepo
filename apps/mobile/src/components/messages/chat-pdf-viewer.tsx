import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Download, Share2, X } from 'lucide-react-native';
import type { AppColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase/client';

const CHANNEL_FILES_BUCKET = 'channel-files';
const PDF_CACHE_DIR = 'chat-pdf-viewer';

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
    void resolveSignedFileUrl(url, storagePath)
      .then(async (resolvedUrl) => {
        const downloadedFile = await downloadPdfToCache(resolvedUrl, normalizedFilename);
        if (cancelled) return;
        setLocalFile(downloadedFile);
        await WebBrowser.openBrowserAsync(resolvedUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
        if (!cancelled) onClose();
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
  }, [normalizedFilename, onClose, storagePath, url, visible]);

  const ensureLocalFile = useCallback(async () => {
    if (localFile) return localFile;
    throw new Error('Document is not ready yet.');
  }, [localFile]);

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
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.backdrop}>
          <View style={styles.documentStage}>
            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.helperText}>Opening PDF preview…</Text>
              </View>
            ) : error ? (
              <View style={styles.centerState}>
                <Text style={styles.errorTitle}>Unable to load PDF</Text>
                <Text style={styles.errorBody}>{error}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.bottomBarTopRow}>
              <Pressable
                onPress={onClose}
                style={styles.bottomBarButton}
                accessibilityLabel="Close PDF viewer"
              >
                <X size={22} color="#fff" />
              </Pressable>
              <Text style={styles.bottomBarTitle} numberOfLines={1}>
                {normalizedFilename}
              </Text>
              <View style={styles.bottomBarActions}>
                <Pressable
                  onPress={handleShare}
                  disabled={!localFile || actionBusy !== null}
                  style={styles.bottomBarButton}
                  accessibilityLabel="Share PDF"
                >
                  <Share2 size={20} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={!localFile || actionBusy !== null}
                  style={styles.bottomBarButton}
                  accessibilityLabel="Save PDF"
                >
                  <Download size={20} color="#fff" />
                </Pressable>
              </View>
            </View>

            {actionBusy && (
              <View style={styles.footerNotice}>
                <ActivityIndicator size="small" color={colors.teal} />
                <Text style={styles.footerNoticeText}>
                  {actionBusy === 'share' ? 'Preparing PDF to share…' : 'Saving PDF…'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  documentStage: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 72,
    paddingBottom: 24,
    justifyContent: 'center',
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
  helperText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  bottomBarTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
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
