'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { cn } from '../lib/utils';

/** Shared contract for icon actions: one accessible name and a matching tooltip. */
export interface IconActionButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'title' | 'type' | 'children'
> {
  /** Describes the current action, for example "Mute microphone". */
  label: string;
  /** HTML button behavior; defaults to button rather than submitting a form. */
  type?: 'button' | 'submit' | 'reset';
  /** Optional explanation; defaults to the accessible label. */
  tooltip?: string;
  /** Icon or animated icon content. */
  children: ReactNode;
}

export function IconActionButton({
  label,
  type = 'button',
  tooltip = label,
  children,
  disabled,
  size = 'icon',
  className,
  ...props
}: IconActionButtonProps) {
  const button = (
    <Button
      {...props}
      type={type}
      size={size}
      disabled={disabled}
      className={className}
      aria-label={label}
    >
      {children}
    </Button>
  );
  return (
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>
        {disabled ? (
          <span tabIndex={0} aria-label={label} className={cn('inline-flex', className)}>
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
