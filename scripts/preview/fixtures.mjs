export const PREVIEW_USERS = [
  {
    label: 'Owner Staff',
    role: 'staff',
    email: 'preview.owner@iconicedu.test',
    password: 'PreviewPass!123',
    metadata: { display_name: 'Preview Owner' },
  },
  {
    label: 'Educator',
    role: 'educator',
    email: 'preview.educator@iconicedu.test',
    password: 'PreviewPass!123',
    metadata: { display_name: 'Preview Educator' },
  },
  {
    label: 'Guardian',
    role: 'guardian',
    email: 'preview.guardian@iconicedu.test',
    password: 'PreviewPass!123',
    metadata: { display_name: 'Preview Guardian' },
  },
  {
    label: 'Child',
    role: 'child',
    email: 'preview.child@iconicedu.test',
    password: 'PreviewPass!123',
    metadata: { display_name: 'Preview Child' },
  },
];

export const STORAGE_FIXTURES = [
  {
    bucket: 'public-avatars',
    path: 'preview/users/owner/avatar.svg',
    contentType: 'image/svg+xml',
    body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
<rect width="96" height="96" rx="24" fill="#0F766E"/>
<circle cx="48" cy="34" r="16" fill="#F8FAFC"/>
<path d="M22 76c4-15 17-24 26-24s22 9 26 24" fill="#F8FAFC"/>
</svg>`,
  },
  {
    bucket: 'public-message-thumbnails',
    path: 'preview/messages/thumb-1.svg',
    contentType: 'image/svg+xml',
    body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" fill="none">
<rect width="240" height="135" rx="18" fill="#0F172A"/>
<rect x="18" y="18" width="92" height="99" rx="12" fill="#22C55E"/>
<rect x="126" y="24" width="90" height="16" rx="8" fill="#E2E8F0"/>
<rect x="126" y="52" width="70" height="12" rx="6" fill="#94A3B8"/>
<rect x="126" y="74" width="82" height="12" rx="6" fill="#94A3B8"/>
</svg>`,
  },
  {
    bucket: 'channel-files',
    path: 'preview/channel-files/welcome.txt',
    contentType: 'text/plain; charset=utf-8',
    body: 'Preview fixture file for channel-files bucket.\nUse this object to verify bucket wiring, policies, and downloads.\n',
  },
];

export const PREVIEW_COMMENT_MARKER = '<!-- iconicedu-preview-env -->';
