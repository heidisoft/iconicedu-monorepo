import { galleryGrid } from './native-participant-gallery';
jest.mock('./native-video-view', () => ({ NativeVideoView: () => null }));
import { formatRelativeTime } from './native-meeting-sheets';

describe('1-1 meeting layout helpers', () => {
  it('lays out a lesson like web: one fills, two stack or sit side by side, more use 2x2', () => {
    expect(galleryGrid(1, 400, 800)).toEqual({ columns: 1, rows: 1 });
    expect(galleryGrid(2, 400, 800)).toEqual({ columns: 1, rows: 2 });
    expect(galleryGrid(2, 1200, 800)).toEqual({ columns: 2, rows: 1 });
    expect(galleryGrid(3, 1200, 800)).toEqual({ columns: 2, rows: 2 });
    expect(galleryGrid(4, 400, 800)).toEqual({ columns: 2, rows: 2 });
  });
  it('words chat times like web', () => {
    const now = 10 * 24 * 3600 * 1000;
    expect(formatRelativeTime(now - 30_000, now)).toBe('Now');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatRelativeTime(now - 3 * 3600_000, now)).toBe('3 hr ago');
    expect(formatRelativeTime(now - 2 * 24 * 3600_000, now)).toBe('2 d ago');
    expect(formatRelativeTime(now + 5000, now)).toBe('Now');
  });
});
