'use client';

import { memo, useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { ChannelFileItemVM, ChannelMediaItemVM } from '@iconicedu/shared-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import { buildFileAccessHref } from '@iconicedu/ui-web/components/messages/file-download.utils';

type MediaFilesPanelProps = {
  media: ChannelMediaItemVM[];
  files: ChannelFileItemVM[];
  title?: string;
  filterUserId?: string;
};

export const MediaFilesPanel = memo(function MediaFilesPanel({
  media,
  files,
  title = 'Media & files',
  filterUserId,
}: MediaFilesPanelProps) {
  const scopedMedia = useMemo(() => {
    if (!filterUserId) return media;
    return media.filter((item) => item.senderId === filterUserId);
  }, [filterUserId, media]);
  const scopedFiles = useMemo(() => {
    if (!filterUserId) return files;
    return files.filter((item) => item.senderId === filterUserId);
  }, [filterUserId, files]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <Tabs defaultValue="media" className="min-w-0">
        <TabsList className="w-full justify-between">
          <TabsTrigger value="media" className="flex-1">
            Media
            <span className="text-xs text-muted-foreground">{scopedMedia.length}</span>
          </TabsTrigger>
          <TabsTrigger value="files" className="flex-1">
            File
            <span className="text-xs text-muted-foreground">{scopedFiles.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="media" className="min-w-0">
          {scopedMedia.length === 0 ? (
            <p className="text-xs text-muted-foreground">No media yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {scopedMedia.slice(0, 6).map((item) => (
                <div
                  key={item.ids.id}
                  className="aspect-square overflow-hidden rounded-xl bg-muted"
                >
                  <img
                    src={buildFileAccessHref({
                      url: item.url,
                      storagePath: 'storagePath' in item ? item.storagePath : undefined,
                    })}
                    alt={item.name ?? 'Media'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="files" className="min-w-0">
          {scopedFiles.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files yet.</p>
          ) : (
            <div className="space-y-2">
              {scopedFiles.slice(0, 6).map((item) => (
                <div
                  key={item.ids.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-2"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.kind === 'design-file' ? item.tool ?? 'Design file' : item.mimeType ?? 'File'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
});
