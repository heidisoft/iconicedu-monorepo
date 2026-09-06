import { Badge } from '@iconicedu/ui-web/ui/badge';

export function EventLiveIndicator() {
  return (
    <Badge variant="destructive" className="absolute top-1.5 right-1.5 h-2 w-2 p-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex h-full w-full rounded-full bg-primary" />
    </Badge>
  );
}
