import { notFound } from 'next/navigation';
import { LiveSessionSetupFixture } from '@iconicedu/web/components/live-sessions/live-session-setup-fixture';

/** flag-exempt: deterministic browser-test infrastructure, unavailable in production. */
export default async function LiveSessionSetupFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; passcode?: string; returnTo?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  return (
    <LiveSessionSetupFixture
      actor={params.actor ?? 'guest'}
      passcode={params.passcode}
      returnPath={params.returnTo}
    />
  );
}
