import { redirect } from 'next/navigation';

export default async function AdminLearningSpacesRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  redirect(`/${orgSlug}/admin/classrooms`);
}
