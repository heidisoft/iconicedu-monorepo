import React from 'react';
import Svg, { G, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export type SiteLogoFullProps = {
  /** Rendered height in dp. Width scales automatically from the 215.11×77.39 viewBox. */
  height?: number;
  /** Override rendered width; height will scale proportionally if omitted. */
  width?: number;
  /** Fill color for the wordmark letterforms (paths that use currentColor in the web SVG). */
  color?: string;
};

const ASPECT = 215.11 / 77.39; // ≈ 2.78

// Both gradient stop colours are shared across all gradient definitions.
const S1 = '#5bc53e';
const S2 = '#85c53e';

export const SiteLogoFull: React.FC<SiteLogoFullProps> = ({
  height = 32,
  width,
  color = '#0f172a',
}) => {
  const h = height;
  const w = width ?? Math.round(h * ASPECT);

  return (
    <Svg viewBox="0 0 215.11 77.39" width={w} height={h} accessibilityLabel="IconicEdu">
      <Defs>
        {/* Main gradient used by the chevron mark */}
        <LinearGradient id="ie-g1" x1="107.24" y1="52.88" x2="110.36" y2="25.36" gradientUnits="userSpaceOnUse">
          <Stop offset="0.04" stopColor={S1} />
          <Stop offset="1" stopColor={S2} />
        </LinearGradient>
        {/* Sub-heading letter gradients — same stops, different coordinates */}
        <LinearGradient id="ie-g2" x1="0" y1="68.66" x2="15.97" y2="68.66" gradientUnits="userSpaceOnUse">
          <Stop offset="0.04" stopColor={S1} />
          <Stop offset="1" stopColor={S2} />
        </LinearGradient>
        <LinearGradient id="ie-g3" x1="33.13" y1="68.69" x2="48.16" y2="68.69" gradientUnits="userSpaceOnUse">
          <Stop offset="0.04" stopColor={S1} />
          <Stop offset="1" stopColor={S2} />
        </LinearGradient>
        <LinearGradient id="ie-g4" x1="65.21" y1="68.66" x2="81.18" y2="68.66" gradientUnits="userSpaceOnUse">
          <Stop offset="0.04" stopColor={S1} />
          <Stop offset="1" stopColor={S2} />
        </LinearGradient>
        <LinearGradient id="ie-g5" x1="99.11" y1="68.68" x2="113.35" y2="68.68" gradientUnits="userSpaceOnUse">
          <Stop offset="0.04" stopColor={S1} />
          <Stop offset="1" stopColor={S2} />
        </LinearGradient>
        <LinearGradient id="ie-g6" x1="132.34" y1="68.68" x2="144.47" y2="68.68" gradientUnits="userSpaceOnUse">
          <Stop offset="0.04" stopColor={S1} />
          <Stop offset="1" stopColor={S2} />
        </LinearGradient>
        <LinearGradient id="ie-g7" x1="163.46" y1="68.68" x2="180.76" y2="68.68" gradientUnits="userSpaceOnUse">
          <Stop offset="0.04" stopColor={S1} />
          <Stop offset="1" stopColor={S2} />
        </LinearGradient>
        <LinearGradient id="ie-g8" x1="198.74" y1="68.68" x2="214.17" y2="68.68" gradientUnits="userSpaceOnUse">
          <Stop offset="0.04" stopColor={S1} />
          <Stop offset="1" stopColor={S2} />
        </LinearGradient>
      </Defs>

      <G>
        {/* Wordmark letterforms — inherit fill={color} from the group */}
        <G fill={color}>
          <Path d="M.14,51.39V1.08H14.52V51.39Z" />
          <Path d="M24.94,26.23C24.94,10.71,36.22,0,51.17,0,62,0,68.92,5.46,72.73,11.36L62,19.62a12.61,12.61,0,0,0-10.78-6c-6.61,0-11.93,4.88-11.93,12.57s5.32,12.58,11.93,12.58A12.41,12.41,0,0,0,62,32.92l10.71,8.26c-3.81,6-10.71,11.28-21.49,11.28C36.22,52.46,24.94,41.76,24.94,26.23Z" />
          <Path d="M142.52,51.39V1.08h14.37V51.39Z" />
          <Path d="M167.31,26.23C167.31,10.71,178.6,0,193.55,0c10.78,0,17.75,5.46,21.56,11.36L204.4,19.62a12.61,12.61,0,0,0-10.78-6c-6.61,0-11.93,4.88-11.93,12.57S187,38.81,193.62,38.81a12.41,12.41,0,0,0,10.71-5.89L215,41.18c-3.8,6-10.7,11.28-21.48,11.28C178.6,52.46,167.31,41.76,167.31,26.23Z" />
          <Path d="M105.94,0A25.88,25.88,0,0,0,79.7,26.23,25.9,25.9,0,0,0,94.08,49.75V41.06h22.65v9.16a25.89,25.89,0,0,0,15.37-24A25.87,25.87,0,0,0,105.94,0Zm-.08,38.81c-6.82,0-11.78-5.1-11.78-12.58s5-12.57,11.78-12.57,11.86,5.1,11.86,12.57S112.76,38.81,105.86,38.81Z" />

          {/* Chevron mark — gradient override */}
          <Path
            fill="url(#ie-g1)"
            d="M115.66,53.84,132,37.52l-8.6-8.6h0l-7.76,7.76-3.48-3.47,0,0-8.6-8.6-8,8h0L85.38,42.75a25.48,25.48,0,0,0,9.69,7.47l8.46-8.41,9.92,9.92"
          />

          {/* Sub-heading letters "academy" — gradient overrides */}
          <Path fill="url(#ie-g2)" d="M16,77H12.83l-1.59-4.42H4.65L3,77H0L6.43,60.33H9.54ZM8,63.37l-2.59,7h5.07Z" />
          <Path fill="url(#ie-g3)" d="M46,75.56a7.1,7.1,0,0,1-5.06,1.83A7.2,7.2,0,0,1,35.26,75a9.15,9.15,0,0,1-2.13-6.33A10.25,10.25,0,0,1,34,64.34a7.5,7.5,0,0,1,7-4.36,7.52,7.52,0,0,1,4.6,1.46A6.05,6.05,0,0,1,48,65.66h-2.9a3.82,3.82,0,0,0-1.4-2.35A4.28,4.28,0,0,0,41,62.46a4.35,4.35,0,0,0-2.82.93,5.11,5.11,0,0,0-1.63,2.3,9.53,9.53,0,0,0-.2,5.28,7.06,7.06,0,0,0,.84,2,4.08,4.08,0,0,0,1.53,1.44,4.58,4.58,0,0,0,2.26.54q3.7,0,4.25-4.26h2.92A7.18,7.18,0,0,1,46,75.56Z" />
          <Path fill="url(#ie-g4)" d="M81.18,77H78l-1.58-4.42h-6.6L68.23,77h-3l6.43-16.67h3.11Zm-8-13.63-2.6,7h5.07Z" />
          <Path fill="url(#ie-g5)" d="M105.45,60.35a11.1,11.1,0,0,1,3,.37,6.09,6.09,0,0,1,2.41,1.34,8.07,8.07,0,0,1,2.45,6.33q0,4.42-2.34,6.76a5.69,5.69,0,0,1-2.23,1.44,10.16,10.16,0,0,1-3.17.41h-6.5V60.35ZM102,74.54h3.44A4.41,4.41,0,0,0,109.31,73a7.55,7.55,0,0,0,1.12-4.42,6.33,6.33,0,0,0-1.26-4.19,4.8,4.8,0,0,0-3.91-1.51H102Z" />
          <Path fill="url(#ie-g6)" d="M144.33,62.81h-9.09v4.42h8.44v2.36h-8.44V74.5h9.23V77H132.34V60.35h12Z" />
          <Path fill="url(#ie-g7)" d="M180.76,77H178V64.16L173.35,77H171l-4.74-12.84V77h-2.76V60.35h4.09l4.65,13,4.49-13h4.07Z" />
          <Path fill="url(#ie-g8)" d="M207.91,70.38V77H205V70.38l-6.29-10h3.37l4.42,7.37,4.37-7.37h3.27Z" />
        </G>
      </G>
    </Svg>
  );
};
