import type { Metadata } from 'next';

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@iconicedu/ui-web';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@iconicedu/ui-web/ui/input-group';
import { SearchIcon } from '@iconicedu/ui-web';

export const metadata: Metadata = {
  title: '404 · Not Found',
  description: "We couldn't find that page.",
};
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </kbd>
  );
}

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>404 · Not Found</EmptyTitle>
          <EmptyDescription>
            The page you&apos;re looking for doesn&apos;t exist. Try searching for what
            you need below.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <InputGroup className="sm:w-3/4">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput placeholder="Try searching for pages…" />
            <InputGroupAddon align="inline-end">
              <Kbd>/</Kbd>
            </InputGroupAddon>
          </InputGroup>
          <EmptyDescription>
            Need help?{' '}
            <a
              className="text-primary hover:underline"
              href="mailto:support@iconicedu.org"
            >
              Contact support
            </a>
          </EmptyDescription>
        </EmptyContent>
      </Empty>
    </div>
  );
}
