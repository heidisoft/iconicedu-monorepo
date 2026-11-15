import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
export class RecordingContentError extends Error {}

type Stream = ReturnType<ZoomClient['getMediaStream']>;
type Processor = Awaited<ReturnType<Stream['createProcessor']>>;
export type RecordingSurface = { root: HTMLElement; mode: 'annotations' | 'whiteboard' };

/** Copies only the content canvas layers, never controls, notifications or unrelated DOM. */
export function paintRecordingSurface(
  surface: RecordingSurface,
  output: HTMLCanvasElement,
) {
  surface.root.dispatchEvent(new Event('recording-frame'));
  const bounds = surface.root.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return false;
  const ratio = Math.min(1, 1920 / bounds.width, 1080 / bounds.height);
  output.width = Math.max(1, Math.round(bounds.width * ratio));
  output.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = output.getContext('2d');
  if (!context) throw new Error('Recording canvas is unavailable');
  if (surface.mode === 'whiteboard') {
    context.fillStyle = getComputedStyle(surface.root).backgroundColor;
    context.fillRect(0, 0, output.width, output.height);
    if (surface.root.dataset.grid && surface.root.dataset.grid !== 'none') {
      context.fillStyle = getComputedStyle(surface.root).color;
      context.globalAlpha = 0.13;
      const spacing = 24 * ratio;
      for (let x = spacing / 2; x < output.width; x += spacing)
        for (let y = spacing / 2; y < output.height; y += spacing)
          if (surface.root.dataset.grid === 'dots') context.fillRect(x, y, ratio, ratio);
      if (surface.root.dataset.grid === 'lines') {
        for (let x = 0; x < output.width; x += spacing)
          context.fillRect(x, 0, ratio, output.height);
        for (let y = 0; y < output.height; y += spacing)
          context.fillRect(0, y, output.width, ratio);
      }
      context.globalAlpha = 1;
    }
  }
  for (const layer of surface.root.querySelectorAll<HTMLCanvasElement>('canvas')) {
    const rect = layer.getBoundingClientRect();
    if (layer.width && layer.height && rect.width && rect.height)
      context.drawImage(
        layer,
        (rect.x - bounds.x) * ratio,
        (rect.y - bounds.y) * ratio,
        rect.width * ratio,
        rect.height * ratio,
      );
  }
  // Excalidraw/text annotation editors temporarily render text outside the canvas.
  for (const editor of surface.root.querySelectorAll<HTMLTextAreaElement>('textarea')) {
    const rect = editor.getBoundingClientRect();
    const style = getComputedStyle(editor);
    context.save();
    context.scale(ratio, ratio);
    context.beginPath();
    context.rect(rect.x - bounds.x, rect.y - bounds.y, rect.width, rect.height);
    context.clip();
    context.font = style.font;
    context.fillStyle = style.color;
    context.textBaseline = 'top';
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    editor.value
      .split('\n')
      .forEach((line, index) =>
        context.fillText(line, rect.x - bounds.x, rect.y - bounds.y + lineHeight * index),
      );
    context.restore();
  }
  return true;
}

/** One processor per SDK stream. Serializes rasterization and closes every transferred frame. */
export class MeetingShareCompositor {
  private processor: Processor | null = null;
  private preparing: Promise<void> | null = null;
  private disposed = false;
  private failed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private mode: RecordingSurface['mode'] = 'annotations';
  private canvas: HTMLCanvasElement;
  private workerMessage = (event: MessageEvent<{ type?: string }>) => {
    if (!this.disposed && event.data?.type === 'compositor-error') {
      if (!this.failed) this.onError();
      this.failed = true;
      void this.stream.stopShareScreen().catch(() => {});
    }
  };
  constructor(
    private stream: Stream,
    private surface: () => RecordingSurface | null,
    private onError: () => void,
  ) {
    this.canvas = document.createElement('canvas');
  }
  async prepare() {
    if (this.disposed) throw new RecordingContentError('Call ended');
    if (this.processor) return;
    if (this.preparing) return this.preparing;
    this.preparing = this.install();
    try {
      await this.preparing;
    } finally {
      this.preparing = null;
    }
  }
  private async install() {
    if (!this.stream.isSupportShareProcessor())
      throw new RecordingContentError(
        'This browser cannot include annotation and whiteboard content in cloud recordings. Use a supported desktop browser.',
      );
    const processor = await this.stream.createProcessor({
      name: 'meeting-share-compositor',
      type: 'share',
      url: new URL('/meeting-share-processor.js', window.location.origin).href,
      options: { needFixedCaptureRate: true },
    });
    if (this.disposed) {
      await this.stream.removeProcessor(processor).catch(() => {});
      return;
    }
    await this.stream.addProcessor(processor);
    if (this.disposed) {
      await this.stream.removeProcessor(processor);
      return;
    }
    this.processor = processor;
    processor.port.addEventListener('message', this.workerMessage);
    this.setMode(this.mode);
    try {
      await this.update(true);
    } catch {
      this.processor = null;
      processor.port.removeEventListener('message', this.workerMessage);
      await this.stream.removeProcessor(processor).catch(() => {});
      throw new RecordingContentError(
        'Unable to capture shared canvas content for recording. Retry from a supported browser.',
      );
    }
  }
  setMode(mode: RecordingSurface['mode']) {
    this.mode = mode;
    this.processor?.port.postMessage({ type: 'mode', mode });
  }
  private async update(initial = false) {
    if (this.disposed || !this.processor) return;
    try {
      const surface = this.surface();
      if (surface && paintRecordingSurface(surface, this.canvas)) {
        const bitmap = await createImageBitmap(this.canvas);
        if (this.disposed || !this.processor) bitmap.close();
        else {
          this.mode = surface.mode;
          try {
            this.processor.port.postMessage(
              { type: 'frame', bitmap, mode: surface.mode },
              [bitmap],
            );
          } catch (error) {
            bitmap.close();
            throw error;
          }
        }
      } else if (this.mode === 'annotations') {
        // A hidden/unmounted annotation surface must not leave old marks burned in.
        this.processor.port.postMessage({ type: 'mode', mode: 'annotations' });
      }
      this.failed = false;
    } catch (error) {
      if (!this.failed) this.onError();
      this.failed = true;
      if (initial) throw error;
    }
    if (!this.disposed) this.timer = setTimeout(() => void this.update(), 66);
  }
  async dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    if (this.processor) {
      if (this.mode === 'whiteboard') {
        const stopped = await this.stream.stopShareScreen().catch(() => null);
        // Removing the mask while capture is active would expose the underlying display.
        if (stopped !== '') return;
      }
      const processor = this.processor;
      this.processor = null;
      processor.port.removeEventListener('message', this.workerMessage);
      await this.stream.removeProcessor(processor);
    }
  }
}
