import { NextResponse } from 'next/server';
import type {
  AiProviderId,
  OrgAiSettingsVM,
  UpdateOrgAiSettingsInput,
} from '@iconicedu/shared-types';
import { encryptSecret } from '@iconicedu/web/lib/ai/secret-cipher';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';

const VALID_PROVIDERS = new Set<AiProviderId>(['anthropic', 'openai']);

type OrgAiProviderSettingsRow = {
  provider: AiProviderId;
  model: string | null;
  api_key_ciphertext: string | null;
  api_key_last_four: string | null;
  messaging_features_enabled: boolean;
  updated_at: string;
};

function requireEncryptionKey(): string {
  const key = process.env.AI_PROVIDER_KEY_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error('AI_PROVIDER_KEY_ENCRYPTION_KEY is not configured');
  }
  return key;
}

function toVm(orgId: string, row: OrgAiProviderSettingsRow | null): OrgAiSettingsVM {
  if (!row) {
    return {
      orgId,
      provider: 'anthropic',
      model: null,
      hasApiKey: false,
      apiKeyLastFour: null,
      messagingFeaturesEnabled: false,
      updatedAt: null,
    };
  }
  return {
    orgId,
    provider: row.provider,
    model: row.model,
    hasApiKey: Boolean(row.api_key_ciphertext),
    apiKeyLastFour: row.api_key_last_four,
    messagingFeaturesEnabled: row.messaging_features_enabled,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');

  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'orgId is required' },
      { status: 400 },
    );
  }

  try {
    const authContext = await requireAdminOrgContext(orgId);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const serviceSupabase = createSupabaseServiceClient();
    const { data, error } = await serviceSupabase
      .from('org_ai_provider_settings')
      .select(
        'provider, model, api_key_ciphertext, api_key_last_four, messaging_features_enabled, updated_at',
      )
      .eq('org_id', orgId)
      .maybeSingle<OrgAiProviderSettingsRow>();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: toVm(orgId, data) });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as UpdateOrgAiSettingsInput;
  const orgId = payload.orgId;

  if (!orgId || !VALID_PROVIDERS.has(payload.provider)) {
    return NextResponse.json(
      { success: false, message: 'orgId and a valid provider are required.' },
      { status: 400 },
    );
  }
  if (typeof payload.messagingFeaturesEnabled !== 'boolean') {
    return NextResponse.json(
      { success: false, message: 'messagingFeaturesEnabled must be a boolean.' },
      { status: 400 },
    );
  }

  try {
    const authContext = await requireAdminOrgContext(orgId);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const serviceSupabase = createSupabaseServiceClient();
    const existingResponse = await serviceSupabase
      .from('org_ai_provider_settings')
      .select('api_key_ciphertext')
      .eq('org_id', orgId)
      .maybeSingle<{ api_key_ciphertext: string | null }>();

    if (existingResponse.error) {
      return NextResponse.json(
        { success: false, message: existingResponse.error.message },
        { status: 500 },
      );
    }

    const isNewRow = existingResponse.data === null;
    const trimmedApiKey = payload.apiKey?.trim();
    const willHaveApiKey =
      Boolean(trimmedApiKey) || Boolean(existingResponse.data?.api_key_ciphertext);
    if (payload.messagingFeaturesEnabled && !willHaveApiKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'Add an API key before enabling AI message features.',
        },
        { status: 400 },
      );
    }

    const upsertPayload: Record<string, unknown> = {
      org_id: orgId,
      provider: payload.provider,
      model: payload.model?.trim() || null,
      messaging_features_enabled: payload.messagingFeaturesEnabled,
      updated_by: authContext.actorProfileId,
      ...(isNewRow ? { created_by: authContext.actorProfileId } : {}),
    };

    if (trimmedApiKey) {
      upsertPayload.api_key_ciphertext = encryptSecret(
        trimmedApiKey,
        requireEncryptionKey(),
      );
      upsertPayload.api_key_last_four = trimmedApiKey.slice(-4);
    }

    const upsertResponse = await serviceSupabase
      .from('org_ai_provider_settings')
      .upsert(upsertPayload, { onConflict: 'org_id' });

    if (upsertResponse.error) {
      return NextResponse.json(
        { success: false, message: upsertResponse.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
