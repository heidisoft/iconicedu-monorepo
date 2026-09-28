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
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';

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
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
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
      const api = createApiClient(supabase);
      const data = await api.get<OrgAiSettingsVM>('/org-ai-settings', { orgId });
      setSettings(data);
      setProvider(data.provider);
      setModel(data.model ?? '');
      setMessagingFeaturesEnabled(data.messagingFeaturesEnabled);
      setApiKey('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load AI settings.');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, supabase]);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // A key saved for one provider isn't valid for another, so switching
  // providers always requires a fresh key — mirrors the check apps/api
  // enforces on save.
  const providerChanged = Boolean(settings) && provider !== settings?.provider;
  const willHaveApiKey =
    Boolean(apiKey.trim()) || (Boolean(settings?.hasApiKey) && !providerChanged);

  const handleSave = React.useCallback(async () => {
    setIsSaving(true);
    try {
      const api = createApiClient(supabase);
      await api.put<OrgAiSettingsVM>('/org-ai-settings', {
        orgId,
        provider,
        model: model.trim() || null,
        apiKey: apiKey.trim() || undefined,
        messagingFeaturesEnabled,
      });
      toast.success('AI settings saved');
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save AI settings.');
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, loadSettings, messagingFeaturesEnabled, model, orgId, provider, supabase]);

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
              settings?.hasApiKey && !providerChanged
                ? `Saved key ending in •••• ${settings.apiKeyLastFour}`
                : 'Paste the provider API key'
            }
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            {providerChanged
              ? 'Switching providers — enter a new API key for the selected provider.'
              : settings?.hasApiKey
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
