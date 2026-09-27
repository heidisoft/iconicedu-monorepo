'use client';

import { AiSettingsSection } from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/general/ai-settings-section';

type OrgGeneralSettingsDashboardProps = {
  orgId: string;
};

/**
 * Shell for org-wide settings that don't warrant their own nav entry.
 * Add new settings as their own section component here — each section owns
 * its own fetch/save so sections stay independent of one another.
 */
export function OrgGeneralSettingsDashboard({ orgId }: OrgGeneralSettingsDashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      <AiSettingsSection orgId={orgId} />
    </div>
  );
}
