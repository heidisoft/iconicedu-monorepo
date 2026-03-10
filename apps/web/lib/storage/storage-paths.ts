export const STORAGE_BUCKETS = {
  channelFiles: 'channel-files',
  publicMessageThumbnails: 'public-message-thumbnails',
  publicAvatars: 'public-avatars',
} as const;

export const STORAGE_PATH_SEGMENTS = {
  files: 'files',
  images: 'images',
  thumbnails: 'thumbnails',
  audio: 'audio',
  avatars: 'avatars',
} as const;

export type StorageAssetKind =
  (typeof STORAGE_PATH_SEGMENTS)[keyof typeof STORAGE_PATH_SEGMENTS];

export function getChannelFilesBucket() {
  return STORAGE_BUCKETS.channelFiles;
}

export function getMessageThumbnailsBucket() {
  return STORAGE_BUCKETS.publicMessageThumbnails;
}

export function getAvatarBucket() {
  return STORAGE_BUCKETS.publicAvatars;
}

export function sanitizeStorageFileName(name: string, fallback = 'file') {
  const trimmed = name.trim() || fallback;
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export function buildStorageFileKey(input: {
  name: string;
  fallbackBaseName?: string;
  fallbackExtension?: string;
}) {
  const hasExplicitExtension = /\.[^./]+$/.test(input.name);
  const rawExt = hasExplicitExtension ? input.name.split('.').pop()?.toLowerCase() : null;
  const extension = rawExt ? rawExt : (input.fallbackExtension ?? null);
  const timestamp = Date.now();
  const cryptoApi = globalThis.crypto;
  const randomSuffix =
    cryptoApi && typeof cryptoApi.randomUUID === 'function'
      ? cryptoApi.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const baseName = sanitizeStorageFileName(
    input.name.replace(/\.[^/.]+$/, ''),
    input.fallbackBaseName ?? 'file',
  ).replace(/\.+$/g, '');

  return extension
    ? `${timestamp}-${randomSuffix}-${baseName}.${extension}`
    : `${timestamp}-${randomSuffix}-${baseName}`;
}

export function buildOrgScopedStoragePath(input: {
  orgId: string;
  segments: string[];
  fileName: string;
}) {
  return [input.orgId, ...input.segments, input.fileName].join('/');
}

export function buildMessageAssetPath(input: {
  orgId: string;
  channelId: string;
  profileId: string;
  assetKind: Exclude<StorageAssetKind, 'avatars'>;
  fileName: string;
}) {
  return buildOrgScopedStoragePath({
    orgId: input.orgId,
    segments: [input.channelId, input.assetKind, input.profileId],
    fileName: input.fileName,
  });
}

export function buildAvatarPath(input: {
  orgId: string;
  profileId: string;
  fileName: string;
}) {
  return buildOrgScopedStoragePath({
    orgId: input.orgId,
    segments: [STORAGE_PATH_SEGMENTS.avatars, input.profileId],
    fileName: input.fileName,
  });
}

export function buildMessageThumbnailPath(input: {
  orgId: string;
  channelId: string;
  profileId: string;
  fileName: string;
}) {
  return buildOrgScopedStoragePath({
    orgId: input.orgId,
    segments: [input.channelId, STORAGE_PATH_SEGMENTS.thumbnails, input.profileId],
    fileName: input.fileName,
  });
}

export function isValidMessageAssetPath(input: {
  storagePath: string;
  orgId: string;
  channelId: string;
  profileId: string;
}) {
  const segments = input.storagePath.split('/');
  if (segments.length < 5) {
    return false;
  }

  const [orgId, channelId, assetKind, profileId] = segments;
  const allowedAssetKinds = new Set<Exclude<StorageAssetKind, 'avatars'>>([
    STORAGE_PATH_SEGMENTS.files,
    STORAGE_PATH_SEGMENTS.images,
    STORAGE_PATH_SEGMENTS.audio,
  ]);

  return (
    orgId === input.orgId &&
    channelId === input.channelId &&
    allowedAssetKinds.has(assetKind as Exclude<StorageAssetKind, 'avatars'>) &&
    profileId === input.profileId
  );
}
