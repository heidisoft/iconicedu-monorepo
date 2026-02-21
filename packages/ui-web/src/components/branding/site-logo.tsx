import { forwardRef } from 'react';
import { cn } from '@iconicedu/ui-web/lib/utils';

export type SiteLogoProps = React.SVGProps<SVGSVGElement>;

export const SiteLogo = forwardRef<SVGSVGElement, SiteLogoProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52.39 53.84"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
      className={cn('site-logo size-8', className)}
      {...props}
    >
      <defs>
        <linearGradient
          id="logo-linear-gradient"
          x1="27.53"
          y1="52.88"
          x2="30.66"
          y2="25.36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.04" stopColor="#5bc53e" />
          <stop offset="1" stopColor="#85c53e" />
        </linearGradient>
      </defs>
      <g>
        <path
          d="M26.23,0A25.88,25.88,0,0,0,0,26.23,25.91,25.91,0,0,0,14.37,49.75V41.06H37v9.16a25.87,25.87,0,0,0,15.37-24A25.86,25.86,0,0,0,26.23,0Zm-.07,38.81c-6.83,0-11.79-5.1-11.79-12.58s5-12.57,11.79-12.57S38,18.76,38,26.23,33.06,38.81,26.16,38.81Z"
          fill="currentColor"
        />
        <path
          fill="url(#logo-linear-gradient)"
          d="M36,53.84,52.28,37.52l-8.6-8.6h0L35.9,36.68l-3.47-3.47,0,0-8.6-8.6-8,8h0L5.68,42.75a25.45,25.45,0,0,0,9.68,7.47l8.47-8.41,9.91,9.92"
        />
      </g>
    </svg>
  ),
);

SiteLogo.displayName = 'SiteLogo';
