import type { ThemeKey } from '@iconicedu/shared-types';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';

type ThemedIconBadgeProps = {
  icon: LucideIcon;
  themeKey?: ThemeKey | null;
  className?: string;
  iconClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'soft' | 'solid';
};

const SIZE_STYLES: Record<
  NonNullable<ThemedIconBadgeProps['size']>,
  { wrapper: string; icon: string }
> = {
  sm: { wrapper: 'h-7 w-7 rounded-full', icon: 'h-3.5 w-3.5' },
  md: { wrapper: 'h-9 w-9 rounded-full', icon: 'h-4.5 w-4.5' },
  lg: { wrapper: 'h-20 w-20 rounded-full', icon: 'h-8 w-8' },
};

export function ThemedIconBadge({
  icon: Icon,
  themeKey,
  className,
  iconClassName,
  size = 'sm',
  tone = 'soft',
}: ThemedIconBadgeProps) {
  const themeClass = themeKey ? `theme-${themeKey}` : '';
  const sizeStyles = SIZE_STYLES[size];

  const softStyle = themeKey
    ? {
        backgroundColor: 'color-mix(in oklab, var(--theme-bg) 16%, transparent)',
        color: 'var(--theme-bg)',
        borderColor: 'color-mix(in oklab, var(--theme-bg) 30%, transparent)',
      }
    : undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center border',
        sizeStyles.wrapper,
        themeKey && tone === 'solid' ? 'theme-bg theme-fg theme-border' : 'bg-muted',
        themeKey && tone === 'soft' ? themeClass : '',
        className,
      )}
      style={tone === 'soft' ? softStyle : undefined}
    >
      <Icon className={cn(sizeStyles.icon, iconClassName)} />
    </span>
  );
}
