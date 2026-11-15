'use client';
import { PhoneOff } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
/** flag-exempt: recovery for existing meetings preserves tab-scoped identity and admission. */
export function MeetingConnectionRecovery({
  message,
  onLeave,
}: {
  message: string;
  onLeave: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center backdrop-blur-sm"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <PhoneOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Class disconnected</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => window.location.reload()}>
          Rejoin class
        </Button>
        <Button type="button" variant="outline" onClick={onLeave}>
          Return to class page
        </Button>
      </div>
    </div>
  );
}
