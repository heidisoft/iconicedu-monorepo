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
import { Audio } from 'expo-av';
import { Image, Paperclip, Mic, Square, X } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttachmentPayload = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  durationSeconds?: number;
};

type AttachmentSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAttach: (attachment: AttachmentPayload) => void;
  disabled?: boolean;
};

type SheetMode = 'menu' | 'recording';

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

    // Recording UI
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
  const [recordingMs, setRecordingMs] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset to menu when sheet closes
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
      timerRef.current && clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => null);
    };
  }, []);

  // ── Image picker ──────────────────────────────────────────────────────────

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = mimeType.split('/')[1] ?? 'jpg';
    const name = asset.fileName ?? `photo_${Date.now()}.${ext}`;
    onClose();
    onAttach({ uri, name, mimeType, size: asset.fileSize });
  }, [onClose, onAttach]);

  // ── Document picker ───────────────────────────────────────────────────────

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    onClose();
    onAttach({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size,
    });
  }, [onClose, onAttach]);

  // ── Audio recording ───────────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow microphone access in Settings.');
      return;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      // HIGH_QUALITY preset records as M4A/AAC on iOS — universally compatible
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setMode('recording');
      setRecordingMs(0);
      timerRef.current = setInterval(() => setRecordingMs((ms) => ms + 100), 100);

      // Auto-stop at 60 s (matches web SHORT_AUDIO_RECORDING_MAX_MS)
      setTimeout(() => {
        if (recordingRef.current) handleStopRecording();
      }, 60_000);
    } catch (err) {
      console.warn('[AttachmentSheet] recording start error:', err);
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStopRecording = useCallback(async () => {
    if (!recordingRef.current || isStopping) return;
    setIsStopping(true);
    timerRef.current && clearInterval(timerRef.current);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      const durationSeconds = Math.round((status.durationMillis ?? recordingMs) / 1000);
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (uri) {
        onClose();
        onAttach({
          uri,
          name: `voice_${Date.now()}.m4a`,
          mimeType: 'audio/mp4',
          durationSeconds: Math.max(1, durationSeconds),
        });
      }
    } catch (err) {
      console.warn('[AttachmentSheet] recording stop error:', err);
    } finally {
      setIsStopping(false);
      setMode('menu');
      setRecordingMs(0);
    }
  }, [isStopping, recordingMs, onClose, onAttach]);

  const handleCancelRecording = useCallback(async () => {
    timerRef.current && clearInterval(timerRef.current);
    try {
      await recordingRef.current?.stopAndUnloadAsync();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch { /* ignore */ }
    setMode('menu');
    setRecordingMs(0);
    setIsStopping(false);
  }, []);

  // ── Timer display ─────────────────────────────────────────────────────────

  const fmtTimer = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  // Animated waveform bars (simple pulse using recordingMs)
  const barCount = 20;
  const waveformBars = Array.from({ length: barCount }, (_, i) => {
    const phase = (recordingMs / 120 + i * 18) % 360;
    const h = 8 + Math.abs(Math.sin((phase * Math.PI) / 180)) * 28;
    return h;
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

            {mode === 'menu' ? (
              <>
                {/* Photos */}
                <TouchableOpacity
                  style={s.menuItem}
                  onPress={handlePickImage}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <View style={s.menuIconWrap}>
                    <Image size={22} color={colors.teal} />
                  </View>
                  <View>
                    <Text style={s.menuLabel}>Photo Library</Text>
                    <Text style={s.menuSub}>Share a photo or image</Text>
                  </View>
                </TouchableOpacity>

                <View style={s.divider} />

                {/* Files */}
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
                    <Text style={s.menuSub}>Share a document or file</Text>
                  </View>
                </TouchableOpacity>

                <View style={s.divider} />

                {/* Voice */}
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
            ) : (
              /* Recording UI */
              <View style={s.recordingArea}>
                <Text style={s.recordingTimer}>{fmtTimer(recordingMs)}</Text>
                <Text style={s.recordingHint}>Recording… tap stop when done</Text>

                {/* Simple animated waveform */}
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

                {/* Stop button */}
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
