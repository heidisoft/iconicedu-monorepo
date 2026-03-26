import type { ViewStyle } from 'react-native';

export function createHeaderSurface(
  _backgroundColor: string,
  _borderColor: string,
): ViewStyle {
  return {
    backgroundColor: _backgroundColor,
    borderBottomWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    zIndex: 0,
  };
}
