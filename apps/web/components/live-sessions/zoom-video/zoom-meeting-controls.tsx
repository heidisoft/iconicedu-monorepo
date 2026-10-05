'use client';

import type { ComponentProps, ReactNode } from 'react';
import {
  Mic,
  MicOff,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Video,
  VideoOff,
} from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { TOOLBAR_ACTION_CLASS } from './zoom-video-session.constants';
import type { NetworkLevel } from './zoom-video-session.types';

export function OverlayBadge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex max-w-full items-center gap-1.5 rounded-full bg-popover/90 px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IconToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-accent',
            active && 'bg-accent text-accent-foreground',
          )}
          aria-label={label}
          aria-pressed={active}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function NetworkLevelIcon({ level }: { level: NetworkLevel }) {
  const Icon =
    level === 'good' ? SignalHigh : level === 'normal' ? SignalMedium : SignalLow;
  return (
    <Icon
      className={cn(
        'size-3.5',
        level === 'good'
          ? 'text-success'
          : level === 'normal'
            ? 'text-warning'
            : 'text-destructive',
      )}
      aria-label={`${level} connection`}
    />
  );
}

export function PoppingIcon({
  toggleKey,
  children,
}: {
  toggleKey: string | boolean;
  children: ReactNode;
}) {
  return (
    <span
      key={String(toggleKey)}
      className="inline-flex animate-[icon-pop_260ms_cubic-bezier(0.34,1.56,0.64,1)]"
    >
      {children}
    </span>
  );
}

type MeetingControlButtonProps = Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'size' | 'variant'
> & {
  label: string;
  tone?: 'neutral' | 'active' | 'danger';
  mobileSecondary?: boolean;
};

export function MeetingControlButton({
  label,
  tone = 'neutral',
  mobileSecondary = false,
  className,
  children,
  ...props
}: MeetingControlButtonProps) {
  return (
    <Button
      {...props}
      type="button"
      size="icon-lg"
      variant={
        tone === 'danger' ? 'destructive' : tone === 'active' ? 'default' : 'meeting'
      }
      className={cn(
        TOOLBAR_ACTION_CLASS,
        'size-10 rounded-full sm:size-12',
        mobileSecondary && 'zoom-toolbar-secondary',
        className,
      )}
      aria-label={label}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export function MediaStateIndicator({
  kind,
  enabled,
  className,
}: {
  kind: 'microphone' | 'camera';
  enabled: boolean;
  className?: string;
}) {
  const Icon =
    kind === 'microphone' ? (enabled ? Mic : MicOff) : enabled ? Video : VideoOff;
  const label = `${kind === 'microphone' ? 'Microphone' : 'Camera'} ${enabled ? 'on' : 'off'}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center gap-1',
            enabled ? 'text-success' : 'text-destructive',
            className,
          )}
          aria-label={label}
        >
          <Icon className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
