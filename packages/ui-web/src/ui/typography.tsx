/* eslint-disable react/prop-types */
import * as React from 'react';
import { cn } from '@iconicedu/ui-web/lib/utils';

export function H1({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        'scroll-m-20 text-4xl font-extrabold tracking-tight text-foreground lg:text-5xl',
        className,
      )}
      {...props}
    />
  );
}

export function H2({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight text-foreground first:mt-0',
        className,
      )}
      {...props}
    />
  );
}

export function H3({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'scroll-m-20 text-2xl font-semibold tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function H4({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4
      className={cn(
        'scroll-m-20 text-xl font-semibold tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function P({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'leading-7 text-muted-foreground [&:not(:first-child)]:mt-6',
        className,
      )}
      {...props}
    />
  );
}

export function Blockquote({
  className,
  ...props
}: React.HTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote
      className={cn('mt-6 border-l-2 pl-6 italic text-muted-foreground', className)}
      {...props}
    />
  );
}

export function Lead({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xl text-muted-foreground', className)} {...props} />;
}

export function Large({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-lg font-semibold text-foreground', className)} {...props} />
  );
}

export function Small({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <small className={cn('text-sm font-medium leading-none', className)} {...props} />
  );
}

export function Muted({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function Link({
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        'font-medium text-primary underline-offset-4 hover:underline hover:text-primary/80',
        className,
      )}
      {...props}
    />
  );
}
