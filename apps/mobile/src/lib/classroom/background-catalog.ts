import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import type { ImageSourcePropType } from 'react-native';
import annaNekrashevich from '../../../assets/live-session-backgrounds/pexels-anna-nekrashevich-8534465.jpg';
import marinaZasorina from '../../../assets/live-session-backgrounds/pexels-marina-zasorina-7634439.jpg';
import {
  buildMeetingBackgroundCatalog,
  type MeetingBackgroundPreset,
} from '@iconicedu/utils';

/**
 * Downscaled copies (longest side 1920px) of apps/web/public/live-session-backgrounds.
 * Add or remove a photo in both places so web and mobile offer the same choices.
 */
const PHOTO_MODULES: Record<string, ImageSourcePropType> = {
  'pexels-anna-nekrashevich-8534465.jpg': annaNekrashevich,
  'pexels-marina-zasorina-7634439.jpg': marinaZasorina,
};

export const BACKGROUND_PHOTOS = buildMeetingBackgroundCatalog(
  Object.keys(PHOTO_MODULES),
).map((photo) => ({ ...photo, source: PHOTO_MODULES[photo.filename] }));

/** Zoom loads virtual backgrounds from a local file, so bundled photos are materialised first. */
export async function backgroundPhotoFile(preset: MeetingBackgroundPreset) {
  const photo = BACKGROUND_PHOTOS.find((item) => item.value === preset);
  if (!photo) throw new Error('This background is no longer available.');
  // Metro resolves bundled images to numeric asset IDs, which expo-asset accepts.
  const asset = Asset.fromModule(photo.source as number);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Unable to load this background image.');
  return asset.localUri;
}

const PREFERENCE_KEY = 'classroom.background-preset.v1';

export function isBackgroundPreset(value: unknown): value is MeetingBackgroundPreset {
  return (
    value === 'none' ||
    value === 'blur' ||
    BACKGROUND_PHOTOS.some((photo) => photo.value === value)
  );
}

/** Like web's media preferences: a convenience that falls back to no effect. */
export async function readBackgroundPreference(): Promise<MeetingBackgroundPreset> {
  try {
    const value = await AsyncStorage.getItem(PREFERENCE_KEY);
    return isBackgroundPreset(value) ? value : 'none';
  } catch {
    return 'none';
  }
}

export async function writeBackgroundPreference(preset: MeetingBackgroundPreset) {
  try {
    await AsyncStorage.setItem(PREFERENCE_KEY, preset);
  } catch {
    /* Losing the remembered choice only means picking it again next class. */
  }
}
