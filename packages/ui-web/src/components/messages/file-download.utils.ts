type FileHrefInput = {
  url: string;
  storagePath?: string | null;
};

export function buildFileAccessHref(input: FileHrefInput) {
  if (input.storagePath) {
    const params = new URLSearchParams({ path: input.storagePath });
    return `/api/messages/file-download?${params.toString()}`;
  }
  return input.url;
}

export function buildFileDownloadHref(input: FileHrefInput) {
  return buildFileAccessHref(input);
}

export function buildImageRenderHref(input: {
  url: string;
  storagePath?: string | null;
  thumbnailUrl?: string | null;
}) {
  if (input.thumbnailUrl) {
    return input.thumbnailUrl;
  }

  return buildFileAccessHref({
    url: input.url,
    storagePath: input.storagePath,
  });
}
