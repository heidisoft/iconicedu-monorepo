'use client';

import { memo, useCallback } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { EyeOff } from 'lucide-react';

interface HiddenMessagePlaceholderProps {
  onUnhide?: () => void;
  canUnhide?: boolean;
}

export const HiddenMessagePlaceholder = memo(function HiddenMessagePlaceholder({
  onUnhide,
  canUnhide = true,
}: HiddenMessagePlaceholderProps) {
  const handleUnhide = useCallback(() => {
    onUnhide?.();
  }, [onUnhide]);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2">
      <EyeOff className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Message hidden</span>
      {canUnhide && onUnhide && (
        <Button
          variant="link"
          size="sm"
          onClick={handleUnhide}
          className="ml-auto h-auto p-0 text-xs text-primary hover:underline"
        >
          Unhide
        </Button>
      )}
    </div>
  );
});
