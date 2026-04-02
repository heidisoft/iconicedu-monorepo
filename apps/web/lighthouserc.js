/** @type {import('@lhci/utils/src/types').LHCIConfig} */
module.exports = {
  ci: {
    collect: {
      // 3 runs → LHCI picks the median by LCP; warms cold Vercel edge functions.
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:accessibility':  ['error', { minScore: 0.9 }], // hard fail below 90
        'categories:performance':    ['warn',  { minScore: 0.7 }],
        'categories:best-practices': ['warn',  { minScore: 0.7 }],
        'categories:seo':            ['warn',  { minScore: 0.7 }],
      },
    },
    upload: {
      // Provides a shareable report URL without requiring a self-hosted LHCI server.
      target: 'temporary-public-storage',
    },
  },
};
