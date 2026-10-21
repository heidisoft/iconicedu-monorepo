'use client';
import { useState, type CSSProperties } from 'react';
import { MoreHorizontal, X, Palette } from 'lucide-react';

const colors = ['#1e293b', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
export function DrawingStyleStrip({
  className = '',
  style,
  widths = [1, 2, 4],
  color,
  width,
  fill,
  showWidth,
  showFill,
  optionsOpen,
  onStyle,
  onMore,
  onClose,
  open,
  onOpenChange,
}: {
  className?: string;
  style?: CSSProperties;
  widths?: readonly number[];
  color: string;
  width: number;
  fill: string;
  showWidth: boolean;
  showFill: boolean;
  optionsOpen: boolean;
  onStyle: (style: {
    strokeColor?: string;
    strokeWidth?: number;
    backgroundColor?: string;
  }) => void;
  onMore: () => void;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (open === false) return null;
  return (
    <div
      role="toolbar"
      aria-label="Drawing styles"
      className={`flex max-w-[calc(100%-1.5rem)] items-center gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 text-foreground shadow-sm ${className}`}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {!collapsed && (
        <>
          {showWidth && (
            <div className="flex items-center gap-0.5 border-r border-border pr-1">
              {widths.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${index === 0 ? 'Thin' : index === 1 ? 'Medium' : 'Thick'} stroke`}
                  aria-pressed={width === value}
                  onClick={() => onStyle({ strokeWidth: value })}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-accent aria-pressed:bg-accent"
                >
                  <span
                    className="w-4 rounded-full bg-foreground"
                    style={{ height: value }}
                  />
                </button>
              ))}
            </div>
          )}
          {Array.from(new Set([...colors, color]))
            .slice(0, 6)
            .map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`Stroke color ${value}`}
                aria-pressed={color === value}
                onClick={() => onStyle({ strokeColor: value })}
                className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-accent aria-pressed:ring-2 aria-pressed:ring-inset aria-pressed:ring-primary"
              >
                <span
                  className="size-5 rounded-full border border-border"
                  style={{ backgroundColor: value }}
                />
              </button>
            ))}
          {showFill && (
            <button
              type="button"
              aria-label={fill === 'transparent' ? 'Fill shape' : 'Remove fill'}
              aria-pressed={fill !== 'transparent'}
              onClick={() =>
                onStyle({
                  backgroundColor: fill === 'transparent' ? color : 'transparent',
                })
              }
              className="flex size-8 shrink-0 items-center justify-center rounded-full border-l border-border hover:bg-accent"
            >
              <span
                className="size-4 rounded border border-foreground"
                style={{ backgroundColor: fill }}
              />
            </button>
          )}
          <button
            type="button"
            aria-label="More style options"
            aria-expanded={optionsOpen}
            onClick={onMore}
            className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-accent aria-expanded:bg-accent"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </>
      )}
      <button
        type="button"
        aria-label={collapsed ? 'Show drawing styles' : 'Close drawing styles'}
        className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-accent"
        onClick={() => {
          if (open !== undefined) onOpenChange?.(false);
          else setCollapsed(!collapsed);
          if (!collapsed) onClose?.();
        }}
      >
        {collapsed ? <Palette className="size-4" /> : <X className="size-4" />}
      </button>
    </div>
  );
}
