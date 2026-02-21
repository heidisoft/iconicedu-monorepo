import { forwardRef, useId } from 'react';
import { cn } from '@iconicedu/ui-web/lib/utils';

export type SiteLogoFullProps = React.SVGProps<SVGSVGElement>;

export const SiteLogoFull = forwardRef<SVGSVGElement, SiteLogoFullProps>(
  ({ className, ...props }, ref) => {
    const uid = useId();

    const g1 = `${uid}-linear-gradient`;
    const g2 = `${uid}-linear-gradient-2`;
    const g3 = `${uid}-linear-gradient-3`;
    const g4 = `${uid}-linear-gradient-4`;
    const g5 = `${uid}-linear-gradient-5`;
    const g6 = `${uid}-linear-gradient-6`;
    const g7 = `${uid}-linear-gradient-7`;
    const g8 = `${uid}-linear-gradient-8`;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 215.11 77.39"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
        className={cn('site-logo h-8 w-auto text-foreground', className)}
        {...props}
      >
        <defs>
          <linearGradient
            id={g1}
            x1="107.24"
            y1="52.88"
            x2="110.36"
            y2="25.36"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.04" stopColor="#5bc53e" />
            <stop offset="1" stopColor="#85c53e" />
          </linearGradient>

          <linearGradient id={g2} x1="0" y1="68.66" x2="15.97" y2="68.66" xlinkHref={`#${g1}`} />
          <linearGradient
            id={g3}
            x1="33.13"
            y1="68.69"
            x2="48.16"
            y2="68.69"
            xlinkHref={`#${g1}`}
          />
          <linearGradient
            id={g4}
            x1="65.21"
            y1="68.66"
            x2="81.18"
            y2="68.66"
            xlinkHref={`#${g1}`}
          />
          <linearGradient
            id={g5}
            x1="99.11"
            y1="68.68"
            x2="113.35"
            y2="68.68"
            xlinkHref={`#${g1}`}
          />
          <linearGradient
            id={g6}
            x1="132.34"
            y1="68.68"
            x2="144.47"
            y2="68.68"
            xlinkHref={`#${g1}`}
          />
          <linearGradient
            id={g7}
            x1="163.46"
            y1="68.68"
            x2="180.76"
            y2="68.68"
            xlinkHref={`#${g1}`}
          />
          <linearGradient
            id={g8}
            x1="198.74"
            y1="68.68"
            x2="214.17"
            y2="68.68"
            xlinkHref={`#${g1}`}
          />
        </defs>

        <g data-name="Layer 2">
          <g data-name="Layer 1" fill="currentColor">
            <path d="M.14,51.39V1.08H14.52V51.39Z" />
            <path d="M24.94,26.23C24.94,10.71,36.22,0,51.17,0,62,0,68.92,5.46,72.73,11.36L62,19.62a12.61,12.61,0,0,0-10.78-6c-6.61,0-11.93,4.88-11.93,12.57s5.32,12.58,11.93,12.58A12.41,12.41,0,0,0,62,32.92l10.71,8.26c-3.81,6-10.71,11.28-21.49,11.28C36.22,52.46,24.94,41.76,24.94,26.23Z" />
            <path d="M142.52,51.39V1.08h14.37V51.39Z" />
            <path d="M167.31,26.23C167.31,10.71,178.6,0,193.55,0c10.78,0,17.75,5.46,21.56,11.36L204.4,19.62a12.61,12.61,0,0,0-10.78-6c-6.61,0-11.93,4.88-11.93,12.57S187,38.81,193.62,38.81a12.41,12.41,0,0,0,10.71-5.89L215,41.18c-3.8,6-10.7,11.28-21.48,11.28C178.6,52.46,167.31,41.76,167.31,26.23Z" />
            <path d="M105.94,0A25.88,25.88,0,0,0,79.7,26.23,25.9,25.9,0,0,0,94.08,49.75V41.06h22.65v9.16a25.89,25.89,0,0,0,15.37-24A25.87,25.87,0,0,0,105.94,0Zm-.08,38.81c-6.82,0-11.78-5.1-11.78-12.58s5-12.57,11.78-12.57,11.86,5.1,11.86,12.57S112.76,38.81,105.86,38.81Z" />
            <path
              fill={`url(#${g1})`}
              d="M115.66,53.84,132,37.52l-8.6-8.6h0l-7.76,7.76-3.48-3.47,0,0-8.6-8.6-8,8h0L85.38,42.75a25.48,25.48,0,0,0,9.69,7.47l8.46-8.41,9.92,9.92"
            />
            <path
              fill={`url(#${g2})`}
              d="M16,77H12.83l-1.59-4.42H4.65L3,77H0L6.43,60.33H9.54ZM8,63.37l-2.59,7h5.07Z"
            />
            <path
              fill={`url(#${g3})`}
              d="M46,75.56a7.1,7.1,0,0,1-5.06,1.83A7.2,7.2,0,0,1,35.26,75a9.15,9.15,0,0,1-2.13-6.33A10.25,10.25,0,0,1,34,64.34a7.5,7.5,0,0,1,7-4.36,7.52,7.52,0,0,1,4.6,1.46A6.05,6.05,0,0,1,48,65.66h-2.9a3.82,3.82,0,0,0-1.4-2.35A4.28,4.28,0,0,0,41,62.46a4.35,4.35,0,0,0-2.82.93,5.11,5.11,0,0,0-1.63,2.3,9.53,9.53,0,0,0-.2,5.28,7.06,7.06,0,0,0,.84,2,4.08,4.08,0,0,0,1.53,1.44,4.58,4.58,0,0,0,2.26.54q3.7,0,4.25-4.26h2.92A7.18,7.18,0,0,1,46,75.56Z"
            />
            <path
              fill={`url(#${g4})`}
              d="M81.18,77H78l-1.58-4.42h-6.6L68.23,77h-3l6.43-16.67h3.11Zm-8-13.63-2.6,7h5.07Z"
            />
            <path
              fill={`url(#${g5})`}
              d="M105.45,60.35a11.1,11.1,0,0,1,3,.37,6.09,6.09,0,0,1,2.41,1.34,8.07,8.07,0,0,1,2.45,6.33q0,4.42-2.34,6.76a5.69,5.69,0,0,1-2.23,1.44,10.16,10.16,0,0,1-3.17.41h-6.5V60.35ZM102,74.54h3.44A4.41,4.41,0,0,0,109.31,73a7.55,7.55,0,0,0,1.12-4.42,6.33,6.33,0,0,0-1.26-4.19,4.8,4.8,0,0,0-3.91-1.51H102Z"
            />
            <path
              fill={`url(#${g6})`}
              d="M144.33,62.81h-9.09v4.42h8.44v2.36h-8.44V74.5h9.23V77H132.34V60.35h12Z"
            />
            <path
              fill={`url(#${g7})`}
              d="M180.76,77H178V64.16L173.35,77H171l-4.74-12.84V77h-2.76V60.35h4.09l4.65,13,4.49-13h4.07Z"
            />
            <path
              fill={`url(#${g8})`}
              d="M207.91,70.38V77H205V70.38l-6.29-10h3.37l4.42,7.37,4.37-7.37h3.27Z"
            />
          </g>
        </g>
      </svg>
    );
  },
);

SiteLogoFull.displayName = 'SiteLogoFull';
