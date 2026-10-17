import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { exportClassroomDocument } from './export-image';
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn().mockResolvedValue(undefined) }));
beforeEach(() => jest.clearAllMocks());
it('exports a local SVG with SVG MIME and UTI', async () => {
  await exportClassroomDocument(
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L1 1"/></svg>',
    'svg',
  );
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
    expect.stringMatching(/\.svg$/),
    expect.stringContaining('<svg'),
  );
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    expect.stringMatching(/\.svg$/),
    expect.objectContaining({ mimeType: 'image/svg+xml', UTI: 'public.svg-image' }),
  );
});
it.each([
  '<svg><script>alert(1)</script></svg>',
  '<svg onload="alert(1)"/>',
  '<svg><image href="https://example.test/image"/></svg>',
  '<svg><foreignObject/></svg>',
])('rejects active or remote SVG content', async (value) => {
  await expect(exportClassroomDocument(value, 'svg')).rejects.toThrow();
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
});
it('exports recovery JSON separately from image data', async () => {
  await exportClassroomDocument('{"operations":[]}', 'json');
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    expect.stringMatching(/\.json$/),
    expect.objectContaining({ mimeType: 'application/json' }),
  );
});
