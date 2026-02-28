import {
  buildAvatarPath,
  buildStorageFileKey,
} from '@iconicedu/web/lib/storage/storage-paths';

export function buildAvatarStoragePath(input: {
  orgId: string;
  profileId: string;
  file: File;
}) {
  return buildAvatarPath({
    orgId: input.orgId,
    profileId: input.profileId,
    fileName: buildStorageFileKey({
      name: input.file.name,
      fallbackBaseName: 'avatar',
      fallbackExtension: 'jpg',
    }),
  });
}
