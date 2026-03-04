import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceWebEnv } from '@iconicedu/web/lib/config/env';

type SupabaseAuthAdmin = SupabaseClient['auth']['admin'];

export type AdminUserAttributes = Parameters<SupabaseAuthAdmin['createUser']>[0];
export type GenerateLinkParams = Parameters<SupabaseAuthAdmin['generateLink']>[0];
export type AuthMFAAdminListFactorsParams = Parameters<
  SupabaseAuthAdmin['mfa']['listFactors']
>[0];
export type AuthMFAAdminDeleteFactorParams = Parameters<
  SupabaseAuthAdmin['mfa']['deleteFactor']
>[0];
export type AuthMFAAdminListFactorsResponse = Awaited<
  ReturnType<SupabaseAuthAdmin['mfa']['listFactors']>
>;
export type AuthMFAAdminDeleteFactorResponse = Awaited<
  ReturnType<SupabaseAuthAdmin['mfa']['deleteFactor']>
>;
export type CreateOAuthClientParams = Parameters<
  SupabaseAuthAdmin['oauth']['createClient']
>[0];
export type UpdateOAuthClientParams = Parameters<
  SupabaseAuthAdmin['oauth']['updateClient']
>[1];
export type AdminSignOutScope = Parameters<SupabaseAuthAdmin['signOut']>[1];

export type AuthAdminServiceOptions = {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  client?: SupabaseClient;
};

const throwMissingConfig = (): never => {
  throw new Error(
    'Supabase admin configuration is missing. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.',
  );
};

export class AuthAdminService {
  private constructor(private readonly client: SupabaseClient) {}

  static create(options?: AuthAdminServiceOptions) {
    if (options?.client) {
      return new AuthAdminService(options.client);
    }

    const defaultEnv =
      options?.supabaseUrl || options?.serviceRoleKey ? null : getServiceWebEnv();
    const resolvedSupabaseUrl = options?.supabaseUrl ?? defaultEnv?.supabaseUrl;
    const resolvedServiceRoleKey =
      options?.serviceRoleKey ?? defaultEnv?.supabaseServiceRoleKey;

    if (!resolvedSupabaseUrl || !resolvedServiceRoleKey) {
      throwMissingConfig();
    }

    const client = createClient(resolvedSupabaseUrl!, resolvedServiceRoleKey!, {
      auth: { persistSession: false },
    });

    return new AuthAdminService(client);
  }

  getClient() {
    return this.client;
  }

  retrieveUser(uid: string) {
    return this.client.auth.admin.getUserById(uid);
  }

  listUsers(options?: { page?: number; perPage?: number }) {
    return this.client.auth.admin.listUsers({
      page: options?.page,
      perPage: options?.perPage,
    });
  }

  createUser(attributes: AdminUserAttributes) {
    return this.client.auth.admin.createUser(attributes);
  }

  updateUser(uid: string, attributes: AdminUserAttributes) {
    return this.client.auth.admin.updateUserById(uid, attributes);
  }

  deleteUser(uid: string, shouldSoftDelete = false) {
    return this.client.auth.admin.deleteUser(uid, shouldSoftDelete);
  }

  inviteUserByEmail(email: string, options?: { redirectTo?: string; data?: object }) {
    return this.client.auth.admin.inviteUserByEmail(email, {
      redirectTo: options?.redirectTo,
      data: options?.data,
    });
  }

  generateEmailLink(params: GenerateLinkParams) {
    return this.client.auth.admin.generateLink(params);
  }

  signOutUser(jwt: string, scope?: AdminSignOutScope) {
    return this.client.auth.admin.signOut(jwt, scope);
  }

  listFactors(params: AuthMFAAdminListFactorsParams) {
    return this.client.auth.admin.mfa.listFactors(params);
  }

  deleteFactor(params: AuthMFAAdminDeleteFactorParams) {
    return this.client.auth.admin.mfa.deleteFactor(params);
  }

  listOAuthClients(options?: { page?: number; perPage?: number }) {
    return this.client.auth.admin.oauth.listClients({
      page: options?.page,
      perPage: options?.perPage,
    });
  }

  getOAuthClient(clientId: string) {
    return this.client.auth.admin.oauth.getClient(clientId);
  }

  createOAuthClient(params: CreateOAuthClientParams) {
    return this.client.auth.admin.oauth.createClient(params);
  }

  updateOAuthClient(clientId: string, params: UpdateOAuthClientParams) {
    return this.client.auth.admin.oauth.updateClient(clientId, params);
  }

  deleteOAuthClient(clientId: string) {
    return this.client.auth.admin.oauth.deleteClient(clientId);
  }

  regenerateOAuthClientSecret(clientId: string) {
    return this.client.auth.admin.oauth.regenerateClientSecret(clientId);
  }
}

export const createAuthAdminService = (options?: AuthAdminServiceOptions) =>
  AuthAdminService.create(options);
