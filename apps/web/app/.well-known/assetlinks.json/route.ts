import { enableParentReferrals } from '@iconicedu/web/flags';
import { androidAssociation } from '@iconicedu/web/lib/referrals/app-association';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await enableParentReferrals())) return new Response(null, { status: 404 });
  const association = androidAssociation();
  return association
    ? Response.json(association, { headers: { 'Cache-Control': 'public, max-age=300' } })
    : new Response(null, { status: 404 });
}
