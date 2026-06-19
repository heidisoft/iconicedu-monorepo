import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArrowLeft, Pencil } from 'lucide-react';
import { Badge, Button } from '@iconicedu/ui-web';

import { getChannelDetail } from '@iconicedu/web/lib/admin/channel-detail';
import { ChannelForm } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channel-form';

export const metadata: Metadata = {
  title: 'Admin · Edit Channel',
};

export default async function AdminChannelEditPage({
  params,
}: {
  params: Promise<{ orgSlug: string; channelId: string }>;
}) {
  const { orgSlug, channelId } = await params;

  const detail = await getChannelDetail(channelId).catch(() => null);
  if (!detail) notFound();

  return (
    <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
      >
        <Link href={`/${orgSlug}/admin/channels`}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Channels
        </Link>
      </Button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{detail.basics.topic}</h1>
        <Badge variant="secondary" className="gap-1 shrink-0">
          <Pencil className="h-3 w-3" /> Editing
        </Badge>
      </div>

      <ChannelForm
        orgSlug={orgSlug}
        mode="edit"
        initialData={detail}
        channelId={channelId}
      />
    </div>
  );
}
