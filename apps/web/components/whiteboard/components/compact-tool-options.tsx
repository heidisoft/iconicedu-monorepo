'use client';
import { Button } from '@iconicedu/ui-web/ui/button';
import type {
  WhiteboardEngine,
  WhiteboardStyle,
  WhiteboardTool,
} from '../canvas/whiteboard-engine';
const colors = ['#1e1e1e', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#6741d9'];
const names = ['Black', 'Red', 'Orange', 'Green', 'Blue', 'Purple'];
export function CompactToolOptions({
  engine,
  tool,
  style,
  onTool,
}: {
  engine: WhiteboardEngine | null;
  tool: WhiteboardTool;
  style: WhiteboardStyle;
  onTool: (tool: WhiteboardTool) => void;
}) {
  const update = (patch: Partial<WhiteboardStyle>) => engine?.setStyle(patch);
  const pen = tool === 'freedraw' || tool === 'highlighter';
  const shape = ['rectangle', 'ellipse', 'diamond', 'frame', 'selection'].includes(tool);
  if (tool === 'eraser' || tool === 'pixel-eraser')
    return (
      <div className="flex gap-1" role="group" aria-label="Eraser type">
        {(['eraser', 'pixel-eraser'] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tool === t ? 'secondary' : 'ghost'}
            onClick={() => onTool(t)}
          >
            {t === 'eraser' ? 'Object' : 'Pen strokes'}
          </Button>
        ))}
      </div>
    );
  return (
    <div className="flex flex-col gap-3" data-testid="compact-tool-options">
      {pen && (
        <div className="grid grid-cols-2 gap-1" role="group" aria-label="Pen type">
          {[
            { name: 'Pen', tool: 'freedraw', width: 2, opacity: 100 },
            { name: 'Pencil', tool: 'freedraw', width: 1, opacity: 70 },
            { name: 'Marker', tool: 'freedraw', width: 6, opacity: 100 },
            { name: 'Highlighter', tool: 'highlighter', width: 8, opacity: 35 },
          ].map((p) => (
            <Button
              key={p.name}
              size="sm"
              variant={
                style.strokeWidth === p.width && style.opacity === p.opacity
                  ? 'secondary'
                  : 'ghost'
              }
              onClick={() => {
                onTool(p.tool as WhiteboardTool);
                update({ strokeWidth: p.width, opacity: p.opacity });
              }}
            >
              {p.name}
            </Button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1" role="group" aria-label="Stroke color">
        {colors.map((color, i) => (
          <button
            key={color}
            type="button"
            aria-label={`${names[i]} stroke`}
            aria-pressed={style.strokeColor === color}
            className="size-7 rounded-full border-2 border-transparent ring-offset-2 ring-offset-popover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary aria-pressed:ring-2 aria-pressed:ring-primary"
            style={{ backgroundColor: color }}
            onClick={() => update({ strokeColor: color })}
          />
        ))}
        <label
          className="relative size-7 overflow-hidden rounded-full border border-border"
          title="Custom stroke color"
        >
          <span className="sr-only">Custom stroke color</span>
          <input
            type="color"
            aria-label="Custom stroke color"
            className="absolute -left-1 -top-1 size-9 cursor-pointer"
            value={style.strokeColor}
            onChange={(e) => update({ strokeColor: e.target.value })}
          />
        </label>
      </div>
      {shape && (
        <div className="flex items-center gap-1" role="group" aria-label="Shape fill">
          {['transparent', '#ffc9c9', '#ffec99', '#b2f2bb', '#a5d8ff'].map((color, i) => (
            <button
              key={color}
              type="button"
              aria-label={
                i === 0 ? 'No fill' : `${['', 'Pink', 'Yellow', 'Green', 'Blue'][i]} fill`
              }
              aria-pressed={style.backgroundColor === color}
              className="size-7 rounded-lg border border-border aria-pressed:ring-2 aria-pressed:ring-primary"
              style={{ backgroundColor: color }}
              onClick={() => update({ backgroundColor: color })}
            >
              {i === 0 ? '∅' : ''}
            </button>
          ))}
          <select
            aria-label="Fill pattern"
            className="h-7 min-w-0 rounded-md border border-border bg-popover text-xs"
            value={style.fillStyle}
            onChange={(e) =>
              update({ fillStyle: e.target.value as WhiteboardStyle['fillStyle'] })
            }
          >
            <option value="solid">Solid</option>
            <option value="hachure">Hatched</option>
            <option value="cross-hatch">Crossed</option>
            <option value="zigzag">Zigzag</option>
          </select>
        </div>
      )}
      {(tool === 'arrow' || tool === 'line') && (
        <div className="flex gap-2">
          {(['startArrowhead', 'endArrowhead'] as const).map((key, i) => (
            <label key={key} className="flex flex-1 items-center gap-1 text-xs">
              {i ? 'End' : 'Start'}
              <select
                aria-label={i ? 'End arrowhead' : 'Start arrowhead'}
                className="h-8 min-w-0 rounded-md border border-border bg-popover"
                value={style[key] ?? 'none'}
                onChange={(e) =>
                  update({ [key]: e.target.value === 'none' ? null : e.target.value })
                }
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="bar">Bar</option>
                <option value="dot">Dot</option>
                <option value="triangle">Triangle</option>
              </select>
            </label>
          ))}
        </div>
      )}
      {tool === 'text' && (
        <select
          aria-label="Font family"
          className="h-8 rounded-md border border-border bg-popover text-xs"
          value={style.fontFamily}
          onChange={(e) => update({ fontFamily: Number(e.target.value) })}
        >
          <option value={2}>Sans serif</option>
          <option value={1}>Handwritten</option>
          <option value={3}>Monospace</option>
        </select>
      )}
      {tool === 'text' ? (
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-xs">
            Size
            <input
              aria-label="Font size"
              type="number"
              min={8}
              max={96}
              className="h-8 w-14 rounded-md border border-border bg-popover px-1"
              value={style.fontSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 8 && n <= 96) update({ fontSize: n });
              }}
            />
          </label>
          <select
            aria-label="Text alignment"
            className="h-8 rounded-md border border-border bg-popover text-xs"
            value={style.textAlign}
            onChange={(e) =>
              update({ textAlign: e.target.value as WhiteboardStyle['textAlign'] })
            }
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      ) : (
        <div className="flex gap-1" role="group" aria-label="Stroke width">
          {[1, 2, 4, 6, 8].map((width) => (
            <Button
              key={width}
              size="sm"
              className="h-7 flex-1 px-2"
              aria-label={`Stroke width ${width}`}
              aria-pressed={style.strokeWidth === width}
              variant={style.strokeWidth === width ? 'secondary' : 'ghost'}
              onClick={() => update({ strokeWidth: width })}
            >
              <span
                style={{
                  height: width,
                  width: 20,
                  backgroundColor: 'currentColor',
                  borderRadius: 4,
                }}
              />
            </Button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-xs">
        Opacity
        <input
          aria-label="Opacity"
          type="range"
          min={10}
          max={100}
          step={5}
          className="min-w-0 flex-1 accent-primary"
          value={style.opacity}
          onChange={(e) => update({ opacity: Number(e.target.value) })}
        />
        <span className="w-8 tabular-nums">{style.opacity}%</span>
      </label>
    </div>
  );
}
