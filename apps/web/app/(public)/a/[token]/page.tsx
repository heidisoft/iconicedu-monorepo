import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicDeliveryByToken } from '@iconicedu/web/lib/assessments/api';
import { PublicAssessmentLanding } from '@iconicedu/web/components/assessments/public-assessment-landing';

export const metadata: Metadata = { title: 'Assessment' };

export default async function PublicAssessmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const delivery = await getPublicDeliveryByToken(token);
  if (!delivery) notFound();

  return <PublicAssessmentLanding delivery={delivery} token={token} />;
}
