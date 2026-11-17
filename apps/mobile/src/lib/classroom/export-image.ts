import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { generateClientMessageId } from '@/lib/messages/client-message-id';

/** Export only local canvas PNG data; never fetch a URL supplied by the canvas. */
export async function exportClassroomImage(dataUrl: string) {
  if (
    !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl) ||
    dataUrl.length > 28000000
  )
    throw new Error('This image is too large to export. Export a smaller drawing.');
  if (!FileSystem.cacheDirectory) throw new Error('Image export is unavailable.');
  const file = `${FileSystem.cacheDirectory}classroom-${generateClientMessageId()}.png`;
  await FileSystem.writeAsStringAsync(file, dataUrl.slice(dataUrl.indexOf(',') + 1), {
    encoding: FileSystem.EncodingType.Base64,
  });
  // The receiving app can read after the chooser returns. Leave the file in OS-managed cache.
  await Sharing.shareAsync(file, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: 'Save classroom image',
  });
}

/** Local-only text exports; never interpret canvas output as a remote resource. */
export async function exportClassroomDocument(content: string, format: 'svg' | 'json') {
  if (content.length > 28000000) throw new Error('This drawing is too large to export.');
  if (
    format === 'svg' &&
    (!content.trimStart().startsWith('<svg') ||
      /<(?:script|foreignObject|iframe|object|embed)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:|\/\/)/i.test(
        content,
      ))
  )
    throw new Error('Unable to export this drawing safely.');
  if (format === 'json') JSON.parse(content);
  if (!FileSystem.cacheDirectory) throw new Error('Document export is unavailable.');
  const file = `${FileSystem.cacheDirectory}classroom-${generateClientMessageId()}.${format}`;
  await FileSystem.writeAsStringAsync(file, content);
  await Sharing.shareAsync(file, {
    mimeType: format === 'svg' ? 'image/svg+xml' : 'application/json',
    UTI: format === 'svg' ? 'public.svg-image' : 'public.json',
    dialogTitle:
      format === 'svg' ? 'Save whiteboard SVG' : 'Save unsaved whiteboard edits',
  });
}
