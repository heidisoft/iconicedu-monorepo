import React, { Suspense } from 'react';
import { DashboardHeader, DashboardHomeSkeleton } from '@iconicedu/ui-web';

import { HomePageContent } from './home-page-content';

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={'Home'} />
      <div className="flex flex-1 flex-col p-4">
        <Suspense fallback={<DashboardHomeSkeleton />}>
          <HomePageContent orgSlug={orgSlug} />
        </Suspense>
      </div>
    </div>
  );
}
