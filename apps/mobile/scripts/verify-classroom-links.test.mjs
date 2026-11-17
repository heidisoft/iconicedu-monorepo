import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyClassroomLinks } from './verify-classroom-links.mjs';
const cert = Array(32).fill('AA').join(':');
const config = {
  domains: ['app.example.test'],
  iosApplicationIdentifiers: ['TESTTEAM.com.example.app'],
  androidPackage: 'com.example.app',
  androidCertificateSha256: [cert],
};
const apple = {
  applinks: {
    details: [{ appID: config.iosApplicationIdentifiers[0], paths: ['/live/*'] }],
  },
};
const android = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: config.androidPackage,
      sha256_cert_fingerprints: [cert],
    },
  },
];
test('refuses missing public signing identities before making network requests', async () => {
  await assert.rejects(
    verifyClassroomLinks({ ...config, iosApplicationIdentifiers: [] }, () => {
      throw new Error('unexpected request');
    }),
    /Apple application identifier/,
  );
  await assert.rejects(
    verifyClassroomLinks({ ...config, androidCertificateSha256: [] }),
    /SHA-256/,
  );
});
test('checks hosted JSON against actual configured identities and paths', async () => {
  const request = async (url, options) => {
    assert.equal(options.redirect, 'error');
    return Response.json(url.endsWith('assetlinks.json') ? android : apple);
  };
  await verifyClassroomLinks(config, request);
  await assert.rejects(
    verifyClassroomLinks({ ...config, androidPackage: 'com.other.app' }, request),
    /Android association/,
  );
  await assert.rejects(
    verifyClassroomLinks(
      { ...config, iosApplicationIdentifiers: ['OTHER.com.example.app'] },
      request,
    ),
    /Apple association/,
  );
});
test('rejects redirects/errors and HTML rather than reporting a verified domain', async () => {
  await assert.rejects(
    verifyClassroomLinks(config, async () => new Response('login', { status: 302 })),
    /unavailable/,
  );
  await assert.rejects(
    verifyClassroomLinks(
      config,
      async () =>
        new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }),
    ),
    /not JSON/,
  );
});
