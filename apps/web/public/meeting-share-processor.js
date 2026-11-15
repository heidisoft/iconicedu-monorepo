/* These globals are supplied by the Zoom processor worker. */
class MeetingShareProcessor extends ShareProcessor {
  constructor(port, options) {
    super(port, options);
    this.port = port;
    this.layer = null;
    this.mode = 'annotations';
    this.disposed = false;
    port.onmessage = ({ data }) => {
      if (this.disposed) {
        data.bitmap?.close();
        return;
      }
      if (data.type === 'mode') {
        this.mode = data.mode;
        this.layer?.close();
        this.layer = null;
      } else if (data.type === 'frame') {
        this.layer?.close();
        this.layer = data.bitmap;
        this.mode = data.mode;
      }
    };
  }
  processFrame(input, output) {
    const context = output.getContext('2d');
    if (!context) {
      this.port.postMessage({ type: 'compositor-error' });
      throw new Error('Recording compositor context unavailable');
    }
    context.clearRect(0, 0, output.width, output.height);
    if (this.mode === 'whiteboard') {
      // Never leak the selected underlying display while a board frame is loading.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, output.width, output.height);
    } else {
      context.drawImage(input, 0, 0, output.width, output.height);
    }
    if (this.layer) {
      if (this.mode === 'whiteboard') {
        const scale = Math.min(
          output.width / this.layer.width,
          output.height / this.layer.height,
        );
        const width = this.layer.width * scale,
          height = this.layer.height * scale;
        context.drawImage(
          this.layer,
          (output.width - width) / 2,
          (output.height - height) / 2,
          width,
          height,
        );
      } else context.drawImage(this.layer, 0, 0, output.width, output.height);
    }
    return true;
  }
  onUninit() {
    this.disposed = true;
    this.layer?.close();
    this.layer = null;
  }
}
registerProcessor('meeting-share-compositor', MeetingShareProcessor);
