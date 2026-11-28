import React, { useEffect, useState } from 'react';
import {
  Image,
  View,
  type ImageProps,
  type StyleProp,
  type ImageStyle,
} from 'react-native';

import { supabase } from '@/lib/supabase/client';
import {
  AVATAR_BUCKET,
  AVATAR_SIGNED_URL_TTL_SECONDS,
  peekAvatarUri,
  resolveAvatarUri,
} from '@/lib/profile-avatar-url';

async function signAvatarPath(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SECONDS);
  return error ? null : (data?.signedUrl ?? null);
}

/** Resolves a stored avatar value (storage path or URL) to a loadable URI. */
export function useAvatarUri(raw: string | null | undefined): string | null | undefined {
  const [uri, setUri] = useState(() => peekAvatarUri(raw));
  useEffect(() => {
    let active = true;
    const ready = peekAvatarUri(raw);
    setUri(ready);
    if (ready === undefined) {
      void resolveAvatarUri(raw, signAvatarPath).then((next) => {
        if (active) setUri(next);
      });
    }
    return () => {
      active = false;
    };
  }, [raw]);
  return uri;
}

type AvatarImageProps = Omit<ImageProps, 'source'> & {
  uri: string | null | undefined;
  /** Rendered when the photo cannot be resolved or fails to load. */
  fallback?: React.ReactNode;
};

/**
 * Drop-in `<Image>` for profile photos. Signs private-bucket avatar paths so
 * uploaded photos display, and shows `fallback` (or an empty frame of the same
 * size) while signing or when the photo is unavailable.
 */
export function AvatarImage({
  uri,
  fallback,
  style,
  onError,
  ...rest
}: AvatarImageProps) {
  const resolved = useAvatarUri(uri);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [resolved]);

  if (!resolved || failed) {
    if (fallback !== undefined && (failed || resolved === null)) return <>{fallback}</>;
    return <View style={style as StyleProp<ImageStyle>} testID="avatar-image-pending" />;
  }
  return (
    <Image
      {...rest}
      source={{ uri: resolved }}
      style={style}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
