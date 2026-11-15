'use client';

import { Pencil } from 'lucide-react';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';

const ANNOTATION_DOCK_BOTTOM = 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 4.75rem)';

export interface ZoomAnnotationControlsProps {
  available: boolean;
  isAnnotating: boolean;
  pending?: boolean;
  onToggle: () => void;
}

export function ZoomAnnotationControls({
  available,
  isAnnotating,
  pending = false,
  onToggle,
}: ZoomAnnotationControlsProps) {
  if (!available) return null;
  return (
    <div
      className="absolute left-4 z-30 flex w-fit sm:left-6"
      style={{ bottom: ANNOTATION_DOCK_BOTTOM }}
    >
      <IconActionButton
        variant={isAnnotating ? 'default' : 'secondary'}
        size="icon-lg"
        className="shadow-lg backdrop-blur-sm"
        label={isAnnotating ? 'Stop annotating' : 'Annotate shared screen'}
        aria-pressed={isAnnotating}
        aria-busy={pending}
        disabled={pending}
        onClick={onToggle}
      >
        <Pencil className="size-5" />
      </IconActionButton>
    </div>
  );
}
