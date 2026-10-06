'use client';

import type { ReactNode } from 'react';
import {
  Mic,
  MicOff,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Video,
  VideoOff,
} from 'lucide-react';

import {
  IconActionButton,
  type IconActionButtonProps,
} from '@iconicedu/ui-web/ui/icon-action-button';
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

export interface IconToolbarButtonProps extends Omit<IconActionButtonProps, 'variant'> {
  active?: boolean;
}

export function IconToolbarButton({
  active,
  className,
  ...props
}: IconToolbarButtonProps) {
  return (
    <IconActionButton
      {...props}
      variant="ghost"
      aria-pressed={active}
      className={cn(
        'size-8 rounded-lg',
        active && 'bg-accent text-accent-foreground',
        className,
      )}
    />
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

export interface MeetingControlButtonProps extends Omit<
  IconActionButtonProps,
  'size' | 'variant'
> {
  tone?: 'neutral' | 'active' | 'danger';
  mobileSecondary?: boolean;
}

export function MeetingControlButton({
  label,
  tone = 'neutral',
  mobileSecondary = false,
  className,
  children,
  ...props
}: MeetingControlButtonProps) {
  return (
    <IconActionButton
      {...props}
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
      label={label}
    >
      {children}
    </IconActionButton>
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
