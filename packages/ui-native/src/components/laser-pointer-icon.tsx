import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Matches the laser pen used by the web drawing toolbars. */
export function LaserPointerIcon({
  size = 20,
  color = 'currentColor',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m4 17 9-9 3 3-9 9H4v-3Z" />
      <Path d="m11 10 3 3M17 7l4-4M18 10h3M14 6V3" />
    </Svg>
  );
}
