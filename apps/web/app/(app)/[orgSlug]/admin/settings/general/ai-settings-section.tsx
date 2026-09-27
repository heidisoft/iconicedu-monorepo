'use client';

import * as React from 'react';
import type { AiProviderId, OrgAiSettingsVM } from '@iconicedu/shared-types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Loader2,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from '@iconicedu/ui-web';

type AiSettingsSectionProps = {
  orgId: string;
};

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
};

const PROVIDER_MODEL_PLACEHOLDERS: Record<AiProviderId, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
};

export function AiSettingsSection({ orgId }: AiSettingsSectionProps) {
  const [settings, setSettings] = React.useState<OrgAiSettingsVM | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const [provider, setProvider] = React.useState<AiProviderId>('anthropic');
  const [model, setModel] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [messagingFeaturesEnabled, setMessagingFeaturesEnabled] = React.useState(false);

  const loadSettings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/settings/ai?orgId=${encodeURIComponent(orgId)}`,
      );
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: OrgAiSettingsVM;
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message ?? 'Failed to load AI settings.');
      }
      setSettings(payload.data);
      setProvider(payload.data.provider);
      setModel(payload.data.model ?? '');
      setMessagingFeaturesEnabled(payload.data.messagingFeaturesEnabled);
      setApiKey('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load AI settings.');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const willHaveApiKey = Boolean(apiKey.trim()) || Boolean(settings?.hasApiKey);

  const handleSave = React.useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          provider,
          model: model.trim() || null,
          apiKey: apiKey.trim() || undefined,
          messagingFeaturesEnabled,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Failed to save AI settings.');
      }
      toast.success('AI settings saved');
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save AI settings.');
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, loadSettings, messagingFeaturesEnabled, model, orgId, provider]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading AI settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-assisted messaging</CardTitle>
        <CardDescription>
          Bring your own provider key to power draft refinement and suggested replies for
          this organization. Each org is billed on its own key — nothing is shared across
          organizations.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Enable AI message features</p>
            <p className="text-xs text-muted-foreground">
              Turns on draft refinement and suggested replies for eligible profiles in
              this organization. Requires an API key below.
            </p>
          </div>
          <Switch
            checked={messagingFeaturesEnabled}
            disabled={isSaving || !willHaveApiKey}
            onCheckedChange={setMessagingFeaturesEnabled}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select
              value={provider}
              onValueChange={(value) => setProvider(value as AiProviderId)}
              disabled={isSaving}
            >
              <SelectTrigger id="ai-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_LABELS) as AiProviderId[]).map((id) => (
                  <SelectItem key={id} value={id}>
                    {PROVIDER_LABELS[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-model">Model (optional)</Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={PROVIDER_MODEL_PLACEHOLDERS[provider]}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-api-key">API key</Label>
          <Input
            id="ai-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              settings?.hasApiKey
                ? `Saved key ending in •••• ${settings.apiKeyLastFour}`
                : 'Paste the provider API key'
            }
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            {settings?.hasApiKey
              ? 'Leave blank to keep the currently saved key, or paste a new one to rotate it.'
              : 'This key is encrypted before it is stored and is never shown again.'}
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save AI settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
