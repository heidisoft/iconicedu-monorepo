export default function Loading() {
  return (
    <div className="bg-background flex min-h-[calc(100vh-1rem)] items-center justify-center">
      <p className="text-muted-foreground animate-pulse text-sm font-medium">
        Loading...
      </p>
    </div>
  );
}
