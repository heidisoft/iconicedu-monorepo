import { createFlagsDiscoveryEndpoint } from 'flags/next';

import { getFlagsProviderData } from '../../../../flags';

const handleDiscovery = createFlagsDiscoveryEndpoint(() => getFlagsProviderData());

export async function GET(
  request: Request,
  _context: { params: Promise<Record<string, string>> },
) {
  return handleDiscovery(request as never);
}
