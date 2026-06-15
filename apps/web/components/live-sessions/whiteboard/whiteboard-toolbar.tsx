'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { cn } from '@iconicedu/ui-web/lib/utils';

import type {
  ActiveToolOptions,
  ToolbarAction,
  ToolbarItemConfig,
} from './whiteboard-toolbar-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhiteboardToolbarCallbacks {
  onUploadPdf?: () => void;
  onUploadImage?: () => void;
  onFollowMeToggle?: (active: boolean) => void;
  onLockStudentToggle?: (active: boolean) => void;
}

interface WhiteboardToolbarProps {
  items: ToolbarItemConfig[];
  api: ExcalidrawImperativeAPI | null;
  callbacks?: WhiteboardToolbarCallbacks;
}

// ─── Stroke width visual heights ──────────────────────────────────────────────

const STROKE_VISUAL: Record<number, number> = { 1: 1.5, 2: 3, 4: 5 };

// ─── Reusable option-strip divider ────────────────────────────────────────────

function OptionDivider() {
  return <div className="h-5 w-px shrink-0 bg-border" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WhiteboardToolbar({ items, api, callbacks }: WhiteboardToolbarProps) {
  const [activeToolId, setActiveToolId] = useState<string>('hand');
  const [toolOptions, setToolOptions] = useState<Record<string, ActiveToolOptions>>({});
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const item of items) {
      if (item.kind === 'action' && item.isToggle)
        init[item.id] = item.defaultActive ?? false;
    }
    return init;
  });

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Activate the hand tool once the Excalidraw API is ready.
  // Deferred via rAF because Excalidraw resets to its own default (selection)
  // after firing the excalidrawAPI callback — we must run after that settles.
  useEffect(() => {
    if (!api) return;
    const handItem = items.find(
      (i): i is Extract<ToolbarItemConfig, { kind: 'tool' }> =>
        i.kind === 'tool' && i.id === 'hand',
    );
    if (!handItem) return;
    const raf = requestAnimationFrame(() => {
      api.setActiveTool(handItem.tool);
    });
    return () => cancelAnimationFrame(raf);
  }, [api, items]);

  const getOpts = useCallback(
    (toolId: string): ActiveToolOptions => toolOptions[toolId] ?? {},
    [toolOptions],
  );

  const activateToolWithOpts = useCallback(
    (item: Extract<ToolbarItemConfig, { kind: 'tool' }>, opts: ActiveToolOptions) => {
      if (!api) return;
      api.setActiveTool(item.tool);
      item.applyStyle?.(api, opts);
    },
    [api],
  );

  const handleOptionChange = useCallback(
    (
      toolId: string,
      patch: Partial<ActiveToolOptions>,
      item: Extract<ToolbarItemConfig, { kind: 'tool' }>,
    ) => {
      setToolOptions((prev) => {
        const next = { ...prev[toolId], ...patch };
        if (activeToolId === toolId) activateToolWithOpts(item, next);
        return { ...prev, [toolId]: next };
      });
    },
    [activeToolId, activateToolWithOpts],
  );

  const handleAction = useCallback(
    (action: ToolbarAction, itemId: string) => {
      switch (action) {
        case 'upload-pdf':
          pdfInputRef.current?.click();
          break;
        case 'upload-image':
          imageInputRef.current?.click();
          break;
        case 'follow-me':
          setToggleStates((prev) => {
            const next = !prev[itemId];
            callbacks?.onFollowMeToggle?.(next);
            return { ...prev, [itemId]: next };
          });
          break;
        case 'lock-student':
          setToggleStates((prev) => {
            const next = !prev[itemId];
            callbacks?.onLockStudentToggle?.(next);
            return { ...prev, [itemId]: next };
          });
          break;
      }
    },
    [callbacks],
  );

  const handlePdfFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) callbacks?.onUploadPdf?.();
      e.target.value = '';
    },
    [callbacks],
  );

  const handleImageFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !api) return;
      e.target.value = '';
      const reader = new FileReader();
      reader.onload = (ev) => {
        const fileData: BinaryFileData = {
          id: `img-${Date.now()}` as BinaryFileData['id'],
          dataURL: ev.target?.result as string as BinaryFileData['dataURL'],
          mimeType: file.type as BinaryFileData['mimeType'],
          created: Date.now(),
        };
        api.addFiles([fileData]);
      };
      reader.readAsDataURL(file);
      callbacks?.onUploadImage?.();
    },
    [api, callbacks],
  );

  // Active tool item + its options
  const activeToolItem = items.find(
    (i): i is Extract<ToolbarItemConfig, { kind: 'tool' }> =>
      i.kind === 'tool' && i.id === activeToolId,
  );
  const opts = getOpts(activeToolId);
  const { options } = activeToolItem ?? {};
  const hasOptions = !!(
    options?.colors?.length ||
    options?.strokeWidths?.length ||
    options?.strokeStyles?.length ||
    options?.fontSizes?.length ||
    options?.fontFamilies?.length ||
    options?.textAligns?.length ||
    options?.arrowheads?.length
  );

  // Helper: is a given option value the "default" (first in list, nothing explicitly chosen)?
  function isDefaultSelected<T>(
    chosen: T | undefined,
    list: { id: string }[] | undefined,
    idx: number,
  ) {
    return chosen === undefined && idx === 0 && !!list?.length;
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* ── Contextual options strip ── */}
      {hasOptions && options && activeToolItem ? (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
          {/* Colors */}
          {options.colors?.map((c, i) => {
            const isActive =
              opts.color === c.value || isDefaultSelected(opts.color, options.colors, i);
            return (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={`Color: ${c.label}`}
                onClick={() =>
                  handleOptionChange(activeToolId, { color: c.value }, activeToolItem)
                }
                className={cn(
                  'h-5 w-5 shrink-0 rounded-full border-2 transition-transform hover:scale-110',
                  isActive ? 'scale-110 border-foreground' : 'border-transparent',
                )}
                style={{ backgroundColor: c.value }}
              />
            );
          })}

          {/* Stroke widths */}
          {options.strokeWidths?.length ? (
            <>
              <OptionDivider />
              {options.strokeWidths.map((sw, i) => {
                const isActive =
                  opts.strokeWidth === sw.value ||
                  isDefaultSelected(opts.strokeWidth, options.strokeWidths, i);
                return (
                  <button
                    key={sw.id}
                    type="button"
                    title={sw.label}
                    aria-label={`Stroke: ${sw.label}`}
                    onClick={() =>
                      handleOptionChange(
                        activeToolId,
                        { strokeWidth: sw.value },
                        activeToolItem,
                      )
                    }
                    className={cn(
                      'flex h-7 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                      isActive ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    <span
                      className="w-5 rounded-full bg-foreground"
                      style={{ height: STROKE_VISUAL[sw.value] ?? sw.value }}
                    />
                  </button>
                );
              })}
            </>
          ) : null}

          {/* Stroke styles (solid / dashed / dotted) */}
          {options.strokeStyles?.length ? (
            <>
              <OptionDivider />
              {options.strokeStyles.map((ss, i) => {
                const isActive =
                  opts.strokeStyle === ss.value ||
                  isDefaultSelected(opts.strokeStyle, options.strokeStyles, i);
                return (
                  <button
                    key={ss.id}
                    type="button"
                    title={ss.label}
                    aria-label={`Style: ${ss.label}`}
                    onClick={() =>
                      handleOptionChange(
                        activeToolId,
                        { strokeStyle: ss.value },
                        activeToolItem,
                      )
                    }
                    className={cn(
                      'flex h-7 w-9 items-center justify-center rounded-md transition-colors',
                      isActive ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    {ss.icon}
                  </button>
                );
              })}
            </>
          ) : null}

          {/* Arrowheads */}
          {options.arrowheads?.length ? (
            <>
              <OptionDivider />
              {options.arrowheads.map((ah, i) => {
                const isActive =
                  opts.endArrowhead === ah.value ||
                  isDefaultSelected(opts.endArrowhead, options.arrowheads, i);
                return (
                  <button
                    key={ah.id}
                    type="button"
                    title={ah.label}
                    aria-label={`Arrowhead: ${ah.label}`}
                    onClick={() =>
                      handleOptionChange(
                        activeToolId,
                        { endArrowhead: ah.value },
                        activeToolItem,
                      )
                    }
                    className={cn(
                      'flex h-7 w-9 items-center justify-center rounded-md transition-colors',
                      isActive ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    {ah.icon}
                  </button>
                );
              })}
            </>
          ) : null}

          {/* Font sizes */}
          {options.fontSizes?.length ? (
            <>
              <OptionDivider />
              {options.fontSizes.map((fs, i) => {
                const isActive =
                  opts.fontSize === fs.value ||
                  isDefaultSelected(opts.fontSize, options.fontSizes, i);
                return (
                  <button
                    key={fs.id}
                    type="button"
                    title={`Size: ${fs.label}`}
                    aria-label={`Font size: ${fs.label}`}
                    onClick={() =>
                      handleOptionChange(
                        activeToolId,
                        { fontSize: fs.value },
                        activeToolItem,
                      )
                    }
                    className={cn(
                      'flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1 font-semibold transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    style={{ fontSize: Math.max(10, fs.value * 0.55) }}
                  >
                    {fs.label}
                  </button>
                );
              })}
            </>
          ) : null}

          {/* Font families */}
          {options.fontFamilies?.length ? (
            <>
              <OptionDivider />
              {options.fontFamilies.map((ff, i) => {
                const isActive =
                  opts.fontFamily === ff.value ||
                  isDefaultSelected(opts.fontFamily, options.fontFamilies, i);
                return (
                  <button
                    key={ff.id}
                    type="button"
                    title={ff.label}
                    aria-label={`Font: ${ff.label}`}
                    onClick={() =>
                      handleOptionChange(
                        activeToolId,
                        { fontFamily: ff.value },
                        activeToolItem,
                      )
                    }
                    className={cn(
                      'flex h-7 flex-col items-center justify-center rounded-md px-2 transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {ff.icon}
                    <span className="text-[8px] leading-none">{ff.label}</span>
                  </button>
                );
              })}
            </>
          ) : null}

          {/* Text alignment */}
          {options.textAligns?.length ? (
            <>
              <OptionDivider />
              {options.textAligns.map((ta, i) => {
                const isActive =
                  opts.textAlign === ta.value ||
                  isDefaultSelected(opts.textAlign, options.textAligns, i);
                return (
                  <button
                    key={ta.id}
                    type="button"
                    title={ta.label}
                    aria-label={`Align: ${ta.label}`}
                    onClick={() =>
                      handleOptionChange(
                        activeToolId,
                        { textAlign: ta.value },
                        activeToolItem,
                      )
                    }
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {ta.icon}
                  </button>
                );
              })}
            </>
          ) : null}
        </div>
      ) : null}

      {/* ── Main toolbar ── */}
      <div className="flex items-center gap-0.5 rounded-xl border border-border bg-background/95 p-1 shadow-lg backdrop-blur-sm">
        {items.map((item) => {
          if (item.kind === 'separator') {
            return (
              <div
                key={item.id}
                className="mx-1 h-6 w-px shrink-0 bg-border"
                role="separator"
              />
            );
          }

          if (item.kind === 'tool') {
            const isActive = activeToolId === item.id;
            const toolOpts = getOpts(item.id);
            const dotColor = item.options?.colors
              ? (toolOpts.color ?? item.options.colors[0]?.value)
              : undefined;

            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={isActive}
                onClick={() => {
                  setActiveToolId(item.id);
                  activateToolWithOpts(item, getOpts(item.id));
                }}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-2 text-[10px] font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.icon}
                <span>{item.label}</span>
                {dotColor && (
                  <span
                    className="absolute right-1 top-1 h-2 w-2 rounded-full border border-background"
                    style={{ backgroundColor: dotColor }}
                  />
                )}
              </button>
            );
          }

          // action
          const isToggleActive = item.isToggle ? (toggleStates[item.id] ?? false) : false;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={item.isToggle ? isToggleActive : undefined}
              onClick={() => handleAction(item.action, item.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-2 text-[10px] font-medium transition-colors',
                item.isToggle && isToggleActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handlePdfFile}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />
    </div>
  );
}
