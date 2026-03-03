import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useTablet } from './use-tablet';

jest.mock('react-native', () => ({
  useWindowDimensions: jest.fn(),
}));

describe('useTablet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false for a standard phone width (375)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 375, height: 812 });
    const { result } = renderHook(() => useTablet());
    expect(result.current).toBe(false);
  });

  it('returns false just below the tablet breakpoint (767)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 767, height: 1024 });
    const { result } = renderHook(() => useTablet());
    expect(result.current).toBe(false);
  });

  it('returns true at exactly the breakpoint (768)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 768, height: 1024 });
    const { result } = renderHook(() => useTablet());
    expect(result.current).toBe(true);
  });

  it('returns true for a standard iPad width (1024)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 1366 });
    const { result } = renderHook(() => useTablet());
    expect(result.current).toBe(true);
  });

  it('returns true for a large Android tablet (1280)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1280, height: 800 });
    const { result } = renderHook(() => useTablet());
    expect(result.current).toBe(true);
  });
});
