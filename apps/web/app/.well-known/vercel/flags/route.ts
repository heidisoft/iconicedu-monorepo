import { createFlagsDiscoveryEndpoint } from 'flags/next';

import { getFlagsProviderData } from '../../../../flags';

export const GET = createFlagsDiscoveryEndpoint(() => getFlagsProviderData());
