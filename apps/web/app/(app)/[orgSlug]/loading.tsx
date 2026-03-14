export default function Loading() {
  return (
    <div className="bg-background fixed inset-0 flex items-center justify-center">
      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="bg-muted-foreground/80 h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
          <span className="bg-muted-foreground/80 h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
          <span className="bg-muted-foreground/80 h-2 w-2 animate-bounce rounded-full" />
        </div>
        <p>Loading...</p>
      </div>
    </div>
  );
}
