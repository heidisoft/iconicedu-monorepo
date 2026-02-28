'use client';

import { ExternalLink } from 'lucide-react';

export interface LinkPreviewCardProps {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  favicon?: string;
  className?: string;
}

export function LinkPreviewCard({
  url,
  title,
  description,
  imageUrl,
  siteName,
  favicon,
  className,
}: LinkPreviewCardProps) {
  return (
    <div
      className={
        className ??
        'block max-w-md overflow-hidden rounded-xl border border-border bg-card transition-colors'
      }
    >
      {imageUrl ? (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 truncate text-sm font-semibold text-foreground">
              {title}
            </h3>
            {description ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-1.5">
              {favicon ? (
                <img
                  src={favicon}
                  alt=""
                  className="h-3 w-3"
                  aria-hidden="true"
                />
              ) : null}
              <span className="truncate text-xs text-muted-foreground">
                {siteName || url}
              </span>
            </div>
          </div>
          <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
