import 'server-only';
import {
  ICONIC_ANDROID_PACKAGE,
  ICONIC_APPLE_TEAM_ID,
  ICONIC_ANDROID_SHA256_FINGERPRINTS,
} from '@iconicedu/utils';

export function appleAssociation() {
  const team = process.env.APPLE_APP_LINKS_TEAM_ID?.trim() || ICONIC_APPLE_TEAM_ID;
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return null;
  return {
    applinks: {
      apps: [],
      details: [{ appID: `${team}.${ICONIC_ANDROID_PACKAGE}`, paths: ['/r/*'] }],
    },
  };
}
export function androidAssociation() {
  const fingerprints = (
    process.env.ANDROID_APP_LINKS_SHA256?.trim() ||
    ICONIC_ANDROID_SHA256_FINGERPRINTS.join(',')
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !fingerprints.length ||
    fingerprints.some((value) => !/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(value))
  )
    return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ICONIC_ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
