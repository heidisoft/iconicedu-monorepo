import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function verifyClassroomLinks(config, request = fetch) {
  if (!config.iosApplicationIdentifiers?.length)
    throw new Error(
      'Configure the Apple application identifier from the signed app entitlements.',
    );
  if (!config.androidCertificateSha256?.length)
    throw new Error(
      'Configure the Android app-signing SHA-256 certificate fingerprints.',
    );
  if (!config.domains?.length) throw new Error('Configure the classroom HTTPS host.');
  for (const cert of config.androidCertificateSha256)
    if (!/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(cert))
      throw new Error(
        'Android signing fingerprints must contain 32 colon-separated bytes.',
      );
  for (const host of config.domains) {
    if (!/^[a-zA-Z0-9.-]+$/.test(host)) throw new Error('Invalid classroom host.');
    const load = async (file) => {
      const response = await request(`https://${host}/.well-known/${file}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/json')
      )
        throw new Error(`Association endpoint unavailable or not JSON: ${file}`);
      return response.json();
    };
    const apple = await load('apple-app-site-association');
    for (const id of config.iosApplicationIdentifiers)
      if (
        !apple.applinks?.details?.some(
          (entry) => entry.appID === id && entry.paths?.includes('/live/*'),
        )
      )
        throw new Error(
          'Hosted Apple association does not authorize the configured app and classroom path.',
        );
    const android = await load('assetlinks.json');
    if (
      !Array.isArray(android) ||
      !android.some(
        (entry) =>
          entry.relation?.includes('delegate_permission/common.handle_all_urls') &&
          entry.target?.package_name === config.androidPackage &&
          entry.target?.namespace === 'android_app' &&
          config.androidCertificateSha256.every((cert) =>
            entry.target.sha256_cert_fingerprints?.includes(cert),
          ),
      )
    )
      throw new Error(
        'Hosted Android association does not match the configured package and signing certificates.',
      );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = JSON.parse(
      await readFile(new URL('../../../ops/mobile-links.json', import.meta.url), 'utf8'),
    );
    await verifyClassroomLinks(config);
    console.log(
      'Hosted classroom associations verified. Signed-device link tests are still required.',
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
