export function buildFileDownloadHref(input: {
  url: string;
  storagePath?: string | null;
}) {
  if (input.storagePath) {
    const params = new URLSearchParams({ path: input.storagePath });
    return `/api/messages/file-download?${params.toString()}`;
  }
  return input.url;
}
