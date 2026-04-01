import { buildJpegAttachmentName, shouldNormalizeImageToJpeg } from './attachment-sheet';

describe('attachment-sheet image normalization', () => {
  it('does not normalize web-safe jpeg images', () => {
    expect(
      shouldNormalizeImageToJpeg({
        mimeType: 'image/jpeg',
        name: 'photo.jpg',
        uri: 'file:///photo.jpg',
      }),
    ).toBe(false);
  });

  it('does not normalize web-safe png images', () => {
    expect(
      shouldNormalizeImageToJpeg({
        mimeType: 'image/png',
        name: 'graphic.png',
        uri: 'file:///graphic.png',
      }),
    ).toBe(false);
  });

  it('normalizes heic images to jpeg', () => {
    expect(
      shouldNormalizeImageToJpeg({
        mimeType: 'image/heic',
        name: 'IMG_0001.HEIC',
        uri: 'file:///IMG_0001.HEIC',
      }),
    ).toBe(true);
  });

  it('normalizes unknown image types when the extension is not web-safe', () => {
    expect(
      shouldNormalizeImageToJpeg({
        mimeType: undefined,
        name: 'upload.tiff',
        uri: 'file:///upload.tiff',
      }),
    ).toBe(true);
  });

  it('rewrites the attachment name to jpg', () => {
    expect(buildJpegAttachmentName('IMG_0001.HEIC')).toBe('IMG_0001.jpg');
  });
});
