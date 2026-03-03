import { useWindowDimensions } from 'react-native';

/** Returns true when the viewport width is ≥768 dp (tablet / iPad breakpoint). */
export function useTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= 768;
}
