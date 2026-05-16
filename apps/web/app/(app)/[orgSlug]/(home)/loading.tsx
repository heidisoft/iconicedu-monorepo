import { DashboardHeader, DashboardHomeSkeleton } from '@iconicedu/ui-web';

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={'Home'} />
      <div className="flex flex-1 flex-col p-4">
        <DashboardHomeSkeleton />
      </div>
    </div>
  );
}
