import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { FileText, Mic, AlertCircle } from 'lucide-react-native';
import type { AppColors } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PendingUpload = {
  id: string;
  type: 'image' | 'file' | 'audio';
  /** Full attachment payload — includes base64 for images so retry can re-upload. */
  attachments: Array<{
    uri: string;
    name: string;
    mimeType: string;
    size?: number;
    durationSeconds?: number;
    base64?: string;
  }>;
  senderName: string;
  createdAt: string;
  caption?: string;
  failed?: boolean;
};

type PendingMessageRowProps = {
  pending: PendingUpload;
  colors: AppColors;
  onRetry?: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PendingMessageRow({ pending, colors, onRetry }: PendingMessageRowProps) {
  const { type, attachments, failed } = pending;

  const StatusIndicator = failed ? (
    <AlertCircle size={18} color={colors.red} />
  ) : (
    <ActivityIndicator size="small" color="#fff" />
  );

  const overlayBg = failed ? `${colors.red}66` : 'rgba(0,0,0,0.38)';

  return (
    <View style={styles.row}>
      {/* Spacer pushes bubble to the right (own-message alignment) */}
      <View style={styles.spacer} />

      <View style={styles.bubbleWrapper}>
        {/* Caption text — same teal bubble background as own text messages */}
        {!!pending.caption && (
          <View style={[styles.captionBubble, { backgroundColor: colors.teal }]}>
            <Text style={styles.captionText}>{pending.caption}</Text>
          </View>
        )}

        {type === 'image' ? (
          attachments.length === 1 ? (
            /* ── Single image ─────────────────────────────────────────── */
            <View style={styles.singleImageWrap}>
              <Image
                source={{ uri: attachments[0].uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
                {StatusIndicator}
              </View>
            </View>
          ) : (
            /* ── Gallery grid ─────────────────────────────────────────── */
            <View style={styles.galleryGrid}>
              {attachments.map((a, i) => (
                <View key={i} style={styles.galleryItem}>
                  <Image
                    source={{ uri: a.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                  {/* Overlay + spinner only on first tile */}
                  {i === 0 && (
                    <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
                      {StatusIndicator}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )
        ) : (
          /* ── File / audio bubble ──────────────────────────────────── */
          <View
            style={[
              styles.fileBubble,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {type === 'audio' ? (
              <Mic size={18} color={colors.teal} />
            ) : (
              <FileText size={18} color={colors.teal} />
            )}
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
              {attachments[0]?.name ?? (type === 'audio' ? 'Voice message' : 'File')}
            </Text>
            {failed ? (
              <AlertCircle size={16} color="#ef4444" />
            ) : (
              <ActivityIndicator size="small" color={colors.teal} />
            )}
          </View>
        )}

        {failed ? (
          <TouchableOpacity
            onPress={onRetry}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.statusText, { color: colors.red }]}>
              Failed to send · tap to retry
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.statusText, { color: colors.textMuted }]}>Sending…</Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const IMG_W = 200;
const IMG_H = 150;
const GALLERY_CELL = 95;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  spacer: { flex: 1 },
  bubbleWrapper: {
    alignItems: 'flex-end',
    maxWidth: IMG_W + 8,
  },

  // Single image
  singleImageWrap: {
    width: IMG_W,
    height: IMG_H,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Gallery grid (2-column)
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: GALLERY_CELL * 2 + 4,
  },
  galleryItem: {
    width: GALLERY_CELL,
    height: GALLERY_CELL,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ccc',
  },

  // Spinner / error overlay on images
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // File / audio
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: IMG_W,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
  },

  statusText: {
    fontSize: 12,
    marginTop: 3,
  },

  // Caption bubble — mirrors own-message text bubble (teal background set inline)
  captionBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
    maxWidth: IMG_W,
  },
  captionText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#fff',
  },
});
