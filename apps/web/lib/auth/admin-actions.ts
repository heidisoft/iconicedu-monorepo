'use server';

import { revalidatePath } from 'next/cache';

import { createAuthAdminService } from '@iconicedu/web/lib/auth/admin';
import type {
  AdminSignOutScope,
  AdminUserAttributes,
  AuthMFAAdminDeleteFactorResponse,
  AuthMFAAdminListFactorsResponse,
  GenerateLinkParams,
} from '@iconicedu/web/lib/auth/admin';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import {
  deleteAccountById,
  getAccountByAuthUserId,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { deleteProfilesByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { deleteFamilyLinksByGuardianAccountId } from '@iconicedu/web/lib/family/queries/families.query';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const AUTH_ADMIN_PATH = '/admin/auth';

const APP_URL = resolveAppUrl();
const DEFAULT_AUTH_CALLBACK_URL = `${APP_URL}/auth/callback`;

function resolveCallbackRedirect(override?: string | null) {
  const trimmed = override?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_AUTH_CALLBACK_URL;
}

async function cleanupAccountRecords(authUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: account } = await getAccountByAuthUserId(supabase, authUserId);

  if (!account?.id) {
    return;
  }

  await Promise.all([
    deleteProfilesByAccountId(supabase, account.id, account.org_id),
    deleteFamilyLinksByGuardianAccountId(supabase, account.org_id, account.id),
    deleteAccountById(supabase, account.id, account.org_id),
  ]);
}

export type AuthAdminActionResult<T = unknown> = {
  action: string;
  success: boolean;
  message: string;
  payload?: T;
};

type ActionCallback<T> = (
  service: ReturnType<typeof createAuthAdminService>,
) => Promise<T>;

async function runAction<T>(
  action: string,
  callback: ActionCallback<T>,
): Promise<AuthAdminActionResult<T>> {
  try {
    const service = createAuthAdminService();
    const payload = await callback(service);
    revalidatePath(AUTH_ADMIN_PATH);
    return {
      action,
      success: true,
      message: `${action} completed successfully.`,
      payload,
    };
  } catch (error) {
    return {
      action,
      success: false,
      message:
        error instanceof Error ? error.message : `Unexpected error performing ${action}.`,
    };
  }
}

export async function retrieveUserAction(userId: string) {
  return runAction('retrieve-user', (service) => service.retrieveUser(userId));
}

type CreateUserPayload = {
  email: string;
  password: string;
  role?: string;
  phone?: string;
  displayName?: string;
};

export async function createUserAction(payload: CreateUserPayload) {
  const attributes: AdminUserAttributes = {
    email: payload.email,
    password: payload.password,
    role: payload.role,
    phone: payload.phone,
    user_metadata: payload.displayName
      ? { display_name: payload.displayName }
      : undefined,
  };

  return runAction('create-user', (service) => service.createUser(attributes));
}

type UpdateUserPayload = {
  userId: string;
  email?: string;
  role?: string;
  phone?: string;
  password?: string;
  displayName?: string;
};

export async function updateUserAction(payload: UpdateUserPayload) {
  const attributes: AdminUserAttributes = {
    email: payload.email,
    role: payload.role,
    phone: payload.phone,
    password: payload.password,
    user_metadata: payload.displayName
      ? { display_name: payload.displayName }
      : undefined,
  };

  return runAction('update-user', (service) =>
    service.updateUser(payload.userId, attributes),
  );
}

type DeleteUserPayload = { userId: string; softDelete?: boolean };

export async function deleteUserAction(payload: DeleteUserPayload) {
  return runAction('delete-user', async (service) => {
    const result = await service.deleteUser(payload.userId, payload.softDelete);
    await cleanupAccountRecords(payload.userId);
    return result;
  });
}

type InvitePayload = { email: string; redirectTo?: string; metadata?: string };

export async function inviteUserByEmailAction(payload: InvitePayload) {
  const data = payload.metadata ? { metadata: payload.metadata } : undefined;
  return runAction('invite-user', (service) =>
    service.inviteUserByEmail(payload.email, {
      redirectTo: resolveCallbackRedirect(payload.redirectTo),
      data,
    }),
  );
}

type GenerateLinkPayload = {
  type: GenerateLinkParams['type'];
  email: string;
  password?: string;
  newEmail?: string;
  redirectTo?: string;
  metadata?: string;
};

function parseMetadata(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return { note: value };
  }
}

export async function generateEmailLinkAction(payload: GenerateLinkPayload) {
  const options = {
    redirectTo: resolveCallbackRedirect(payload.redirectTo),
    data: parseMetadata(payload.metadata),
  };

  const params: GenerateLinkParams = (() => {
    switch (payload.type) {
      case 'signup':
        return {
          type: 'signup',
          email: payload.email,
          password: payload.password ?? '',
          options,
        };
      case 'invite':
      case 'magiclink':
        return {
          type: payload.type,
          email: payload.email,
          options,
        };
      case 'recovery':
        return {
          type: 'recovery',
          email: payload.email,
          options,
        };
      case 'email_change_current':
      case 'email_change_new':
        if (!payload.newEmail) {
          throw new Error('newEmail is required for email change links');
        }
        return {
          type: payload.type,
          email: payload.email,
          newEmail: payload.newEmail,
          options,
        };
      default:
        return {
          type: payload.type,
          email: payload.email,
          options,
        };
    }
  })();

  return runAction('generate-link', (service) => service.generateEmailLink(params));
}

type SignOutPayload = { jwt: string; scope: AdminSignOutScope };

export async function signOutUserAction(payload: SignOutPayload) {
  return runAction('sign-out-user', (service) =>
    service.signOutUser(payload.jwt, payload.scope),
  );
}

type ListFactorsPayload = { userId: string };

export async function listUserFactorsAction(payload: ListFactorsPayload) {
  return runAction<AuthMFAAdminListFactorsResponse>('list-factors', (service) =>
    service.listFactors({ userId: payload.userId }),
  );
}

type DeleteFactorPayload = { userId: string; factorId: string };

export async function deleteUserFactorAction(payload: DeleteFactorPayload) {
  return runAction<AuthMFAAdminDeleteFactorResponse>('delete-factor', (service) =>
    service.deleteFactor({ userId: payload.userId, id: payload.factorId }),
  );
}

type OAuthClientPayload = {
  clientId?: string;
  name?: string;
  redirectUris?: string;
  scopes?: string;
};

function parseRedirectUris(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function listOAuthClientsAction(options?: {
  page?: number;
  perPage?: number;
}) {
  return runAction('list-oauth-clients', (service) =>
    service.listOAuthClients({ page: options?.page, perPage: options?.perPage }),
  );
}

export async function getOAuthClientAction(clientId: string) {
  return runAction('get-oauth-client', (service) => service.getOAuthClient(clientId));
}

export async function createOAuthClientAction(payload: OAuthClientPayload) {
  if (!payload.redirectUris) {
    throw new Error('redirectUris is required');
  }
  const redirectUris = parseRedirectUris(payload.redirectUris);
  if (!redirectUris.length) {
    throw new Error('At least one redirect URI is required');
  }
  if (!payload.name?.trim()) {
    throw new Error('name is required');
  }
  const clientName = payload.name.trim();
  return runAction('create-oauth-client', (service) =>
    service.createOAuthClient({
      client_name: clientName,
      redirect_uris: redirectUris,
      scope: payload.scopes,
    }),
  );
}

export async function updateOAuthClientAction(
  payload: OAuthClientPayload & { clientId: string },
) {
  const redirectUris = payload.redirectUris
    ? parseRedirectUris(payload.redirectUris)
    : undefined;

  return runAction('update-oauth-client', (service) =>
    service.updateOAuthClient(payload.clientId, {
      client_name: payload.name?.trim() || undefined,
      redirect_uris: redirectUris?.length ? redirectUris : undefined,
    }),
  );
}

export async function deleteOAuthClientAction(clientId: string) {
  return runAction('delete-oauth-client', (service) =>
    service.deleteOAuthClient(clientId),
  );
}

export async function regenerateOAuthClientSecretAction(clientId: string) {
  return runAction('regenerate-oauth-client-secret', (service) =>
    service.regenerateOAuthClientSecret(clientId),
  );
}
