export const buttonClasses = {
  sm: 'min-h-touch px-4',
  default: 'min-h-control px-5',
  md: 'min-h-control px-5',
  lg: 'min-h-control-lg px-6',
  xl: 'min-h-cta px-7',
} as const;

export const buttonTextClasses = {
  sm: 'text-meta',
  default: 'text-body',
  md: 'text-body',
  lg: 'text-body-lg',
  xl: 'text-body-lg font-semibold',
} as const;

export const inputClasses = {
  sm: 'min-h-touch rounded-lg border px-3 py-2.5 text-body',
  default: 'min-h-control rounded-lg border px-4 py-3 text-body',
  md: 'min-h-control rounded-lg border px-4 py-3 text-body',
  lg: 'min-h-control-lg rounded-xl border px-4 py-3.5 text-body-lg',
} as const;

export const iconButtonClasses = {
  sm: 'h-touch w-touch',
  default: 'h-touch w-touch',
  md: 'h-touch w-touch',
  lg: 'h-control w-control',
} as const;

export const listRowClasses = {
  compact: 'min-h-row-compact px-4 py-2',
  default: 'min-h-row px-4 py-3',
  comfortable: 'min-h-row-comfortable px-4 py-4',
} as const;

export const badgeClasses = {
  sm: 'min-h-[18px] px-1.5',
  default: 'min-h-[22px] px-2',
  md: 'min-h-[22px] px-2',
} as const;

export const cardClasses = {
  compact: 'rounded-lg p-3',
  default: 'rounded-lg p-4',
  comfortable: 'rounded-xl p-5',
} as const;

export const tabsClasses = {
  compact: 'min-h-touch px-3',
  default: 'min-h-control px-4',
} as const;
