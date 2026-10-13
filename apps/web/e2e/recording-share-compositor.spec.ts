import { expect, test } from '@playwright/test';
test('encoded share frames contain annotations and replace the raw display with the whiteboard', async ({
  page,
}) => {
  await page.goto('/visual-test/screen-annotations');
  const pixels = await page.evaluate(async () => {
    const script = await (await fetch('/meeting-share-processor.js')).text();
    const wrapper = `class ShareProcessor { constructor() {} }
      let Processor; function registerProcessor(name, implementation) { Processor = implementation; }
      ${script}
      const port = {}; const processor = new Processor(port, {});
      self.onmessage = async ({data}) => {
        if (data.command === 'layer') port.onmessage({data: {type:'frame', bitmap:data.bitmap,mode:data.mode}});
        else if (data.command === 'mode') port.onmessage({data: {type:'mode', mode:data.mode}});
        else {
          const output = new OffscreenCanvas(64,64);
          processor.processFrame(data.frame, output); data.frame.close();
          self.postMessage(output.getContext('2d').getImageData(0,0,64,64).data.buffer, []);
        }
      };`;
    const url = URL.createObjectURL(new Blob([wrapper], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const source = new OffscreenCanvas(64, 64);
    const context = source.getContext('2d')!;
    context.fillStyle = '#0000ff';
    context.fillRect(0, 0, 64, 64);
    const frame = () => new VideoFrame(source, { timestamp: 0 });
    const draw = () =>
      new Promise<Uint8ClampedArray>((resolve) => {
        worker.onmessage = ({ data }) => resolve(new Uint8ClampedArray(data));
        const input = frame();
        worker.postMessage({ command: 'draw', frame: input }, [input]);
      });
    const layer = new OffscreenCanvas(64, 64);
    const overlay = layer.getContext('2d')!;
    overlay.fillStyle = '#ff0000';
    overlay.fillRect(16, 16, 16, 16);
    let bitmap = await createImageBitmap(layer);
    worker.postMessage({ command: 'layer', mode: 'annotations', bitmap }, [bitmap]);
    const annotation = await draw();
    worker.postMessage({ command: 'mode', mode: 'whiteboard' });
    const loading = await draw();
    overlay.fillStyle = '#00ff00';
    overlay.fillRect(0, 0, 64, 64);
    bitmap = await createImageBitmap(layer);
    worker.postMessage({ command: 'layer', mode: 'whiteboard', bitmap }, [bitmap]);
    const board = await draw();
    worker.postMessage({ command: 'mode', mode: 'annotations' });
    const restored = await draw();
    worker.terminate();
    URL.revokeObjectURL(url);
    const at = (value: Uint8ClampedArray, x: number, y: number) => [
      ...value.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4),
    ];
    return {
      annotation: at(annotation, 20, 20),
      background: at(annotation, 0, 0),
      loading: at(loading, 0, 0),
      board: at(board, 20, 20),
      restored: at(restored, 20, 20),
    };
  });
  expect(pixels.annotation).toEqual([255, 0, 0, 255]);
  expect(pixels.background).toEqual([0, 0, 255, 255]);
  expect(pixels.loading).toEqual([255, 255, 255, 255]);
  expect(pixels.board).toEqual([0, 255, 0, 255]);
  expect(pixels.restored).toEqual([0, 0, 255, 255]);
});
