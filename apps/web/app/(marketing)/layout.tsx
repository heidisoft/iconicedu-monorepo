import type { ReactNode } from 'react';
import { MarketingHeader } from '@iconicedu/ui-web';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main>{children}</main>
    </>
  );
}
