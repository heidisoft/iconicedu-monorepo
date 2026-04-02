import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';
import { ImageIcon, Paperclip, Mic, Square } from 'lucide-react-native';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttachmentPayload = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  durationSeconds?: number;
  /** Pre-read base64 string (images from photo library) — skips FileSystem read on upload. */
  base64?: string;
};

type AttachmentSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Called immediately after picking/recording — caller shows preview above the input bar. */
  onAttach: (attachments: AttachmentPayload[]) => void;
  disabled?: boolean;
};

type SheetMode = 'menu' | 'recording';

const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
];

const WEB_SAFE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function inferImageExtension(input: {
  mimeType?: string | null;
  name?: string | null;
  uri?: string | null;
}) {
  const mimeType = input.mimeType?.trim().toLowerCase();
  if (mimeType?.includes('/')) {
    return mimeType.split('/')[1] ?? null;
  }

  const source = input.name?.trim() || input.uri?.trim() || '';
  const match = source.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function shouldNormalizeImageToJpeg(input: {
  mimeType?: string | null;
  name?: string | null;
  uri?: string | null;
}) {
  const mimeType = input.mimeType?.trim().toLowerCase();
  if (mimeType && WEB_SAFE_IMAGE_MIME_TYPES.has(mimeType)) {
    return false;
  }

  const extension = inferImageExtension(input);
  if (!extension) {
    return true;
  }

  return !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
}

export function buildJpegAttachmentName(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return `photo_${Date.now()}.jpg`;
  }

  return trimmed.replace(/\.[^.]+$/, '') + '.jpg';
}

async function normalizePickedImage(
  asset: ImagePicker.ImagePickerAsset,
  index: number,
): Promise<AttachmentPayload> {
  const needsNormalization = shouldNormalizeImageToJpeg({
    mimeType: asset.mimeType,
    name: asset.fileName,
    uri: asset.uri,
  });

  if (!needsNormalization) {
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext =
      inferImageExtension({
        mimeType,
        name: asset.fileName,
        uri: asset.uri,
      }) ?? 'jpg';
    const name = asset.fileName ?? `photo_${Date.now()}_${index}.${ext}`;

    return {
      uri: asset.uri,
      name,
      mimeType,
      size: asset.fileSize,
      base64: asset.base64 ?? undefined,
    };
  }

  const normalized = await manipulateAsync(asset.uri, [], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  const normalizedFile = new ExpoFile(normalized.uri);
  const normalizedInfo = normalizedFile.info();

  return {
    uri: normalized.uri,
    name: buildJpegAttachmentName(asset.fileName ?? `photo_${Date.now()}_${index}`),
    mimeType: 'image/jpeg',
    size: normalizedInfo.size ?? asset.fileSize,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: C.pageBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 40,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 20,
    },

    // ── Menu ──
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    menuIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: C.text,
    },
    menuSub: {
      fontSize: 12,
      color: C.textMuted,
      marginTop: 1,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.border,
      marginHorizontal: 20,
    },

    // ── Recording ──
    recordingArea: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingBottom: 16,
    },
    recordingTimer: {
      fontSize: 40,
      fontWeight: '200',
      color: C.text,
      marginBottom: 8,
      letterSpacing: 2,
    },
    recordingHint: {
      fontSize: 13,
      color: C.textMuted,
      marginBottom: 32,
    },
    waveformRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      height: 40,
      marginBottom: 32,
    },
    stopBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#ef4444',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelRecordingBtn: {
      marginTop: 16,
      paddingVertical: 8,
      paddingHorizontal: 20,
    },
    cancelRecordingTxt: {
      fontSize: 14,
      color: C.textMuted,
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AttachmentSheet: React.FC<AttachmentSheetProps> = ({
  visible,
  onClose,
  onAttach,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<SheetMode>('menu');

  // Recording state
  const [recordingMs, setRecordingMs] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when sheet closes
  useEffect(() => {
    if (!visible) {
      setMode('menu');
      setRecordingMs(0);
      setIsStopping(false);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stop().catch(() => null);
    };
  }, []);

  // ── Image picker ──────────────────────────────────────────────────────────

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets.length) return;
    const payloads = await Promise.all(
      result.assets.map((asset, i) => normalizePickedImage(asset, i)),
    );
    onClose();
    onAttach(payloads);
  }, [onClose, onAttach]);

  // ── Document picker ───────────────────────────────────────────────────────

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: ALLOWED_DOC_TYPES,
    });
    if (result.canceled || !result.assets.length) return;
    const payloads: AttachmentPayload[] = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size,
    }));
    onClose();
    onAttach(payloads);
  }, [onClose, onAttach]);

  // ── Audio recording ───────────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow microphone access in Settings.');
      return;
    }
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recording.prepareToRecordAsync();
      recording.record();
      recordingRef.current = recording;
      setMode('recording');
      setRecordingMs(0);
      timerRef.current = setInterval(() => setRecordingMs((ms) => ms + 100), 100);

      setTimeout(() => {
        if (recordingRef.current) handleStopRecording();
      }, 60_000);
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.messages.attachment_sheet.recording_start',
        message: 'Failed to start voice recording',
      });
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStopRecording = useCallback(async () => {
    if (!recordingRef.current || isStopping) return;
    setIsStopping(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const durationSeconds = Math.round(recordingRef.current.currentTime);
      await recordingRef.current.stop();
      const uri = recordingRef.current.uri;
      recordingRef.current = null;
      await setAudioModeAsync({ allowsRecording: false });
      if (uri) {
        onClose();
        onAttach([
          {
            uri,
            name: `voice_${Date.now()}.m4a`,
            mimeType: 'audio/mp4',
            durationSeconds: Math.max(1, durationSeconds),
          },
        ]);
      } else {
        setMode('menu');
      }
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.messages.attachment_sheet.recording_stop',
        message: 'Failed to stop voice recording cleanly',
      });
      setMode('menu');
    } finally {
      setIsStopping(false);
      setRecordingMs(0);
    }
  }, [isStopping, onClose, onAttach]);

  const handleCancelRecording = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await recordingRef.current?.stop();
      recordingRef.current = null;
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      /* ignore */
    }
    setMode('menu');
    setRecordingMs(0);
    setIsStopping(false);
  }, []);

  // ── Timer display ─────────────────────────────────────────────────────────

  const fmtTimer = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const barCount = 20;
  const waveformBars = Array.from({ length: barCount }, (_, i) => {
    const phase = (recordingMs / 120 + i * 18) % 360;
    return 8 + Math.abs(Math.sin((phase * Math.PI) / 180)) * 28;
  });

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={mode === 'recording' ? handleCancelRecording : onClose}
      statusBarTranslucent
    >
      <Pressable style={s.overlay} onPress={mode === 'recording' ? undefined : onClose}>
        <Pressable>
          <View style={s.sheet}>
            <View style={s.handle} />

            {/* ── Menu ── */}
            {mode === 'menu' && (
              <>
                <TouchableOpacity
                  style={s.menuItem}
                  onPress={handlePickImage}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <View style={s.menuIconWrap}>
                    <ImageIcon size={22} color={colors.teal} />
                  </View>
                  <View>
                    <Text style={s.menuLabel}>Photo Library</Text>
                    <Text style={s.menuSub}>Select one or more photos</Text>
                  </View>
                </TouchableOpacity>

                <View style={s.divider} />

                <TouchableOpacity
                  style={s.menuItem}
                  onPress={handlePickFile}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <View style={s.menuIconWrap}>
                    <Paperclip size={22} color={colors.teal} />
                  </View>
                  <View>
                    <Text style={s.menuLabel}>Files</Text>
                    <Text style={s.menuSub}>PDF, Word, Excel, PowerPoint…</Text>
                  </View>
                </TouchableOpacity>

                <View style={s.divider} />

                <TouchableOpacity
                  style={s.menuItem}
                  onPress={handleStartRecording}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <View style={s.menuIconWrap}>
                    <Mic size={22} color={colors.teal} />
                  </View>
                  <View>
                    <Text style={s.menuLabel}>Voice Message</Text>
                    <Text style={s.menuSub}>Record up to 60 seconds</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {/* ── Recording ── */}
            {mode === 'recording' && (
              <View style={s.recordingArea}>
                <Text style={s.recordingTimer}>{fmtTimer(recordingMs)}</Text>
                <Text style={s.recordingHint}>Recording… tap stop when done</Text>

                <View style={s.waveformRow}>
                  {waveformBars.map((h, i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: h,
                        backgroundColor: colors.teal,
                        borderRadius: 99,
                        opacity: 0.7 + (i % 3) * 0.1,
                      }}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={s.stopBtn}
                  onPress={handleStopRecording}
                  disabled={isStopping}
                  activeOpacity={0.8}
                  accessibilityLabel="Stop recording"
                >
                  {isStopping ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Square size={24} color="#fff" fill="#fff" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.cancelRecordingBtn}
                  onPress={handleCancelRecording}
                  disabled={isStopping}
                >
                  <Text style={s.cancelRecordingTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
