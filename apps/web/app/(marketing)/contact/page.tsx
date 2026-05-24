import type { Metadata } from 'next';
import { MarketingContactPage } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'Contact | ICONIC Academy',
  description:
    'Contact ICONIC Academy about tutoring programs, USA or global tutor options, curriculum needs, advanced learner support, or family support.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return <MarketingContactPage loginHref={loginHref} />;
}
