import type { RoleKey, UserAccountVM, UserRoleVM } from '@iconicedu/shared-types';
import type { AccountRow, UserRoleRow } from '@iconicedu/shared-types';

export function mapUserRoles(rows: UserRoleRow[] | null | undefined): UserRoleVM[] {
  return (
    rows?.map((role) => ({
      ids: {
        id: role.id,
        orgId: role.org_id,
      },
      roleKey: role.role_key as RoleKey,
      audit: {
        assignedBy: role.assigned_by ?? null,
        assignedAt: role.assigned_at,
      },
    })) ?? []
  );
}

export function mapAccountRowToVM(
  accountRow: AccountRow | null,
  input: {
    accountId: string;
    orgId: string;
    authEmail?: string | null;
    userRoles: UserRoleVM[];
  },
): UserAccountVM {
  return {
    ids: {
      id: input.accountId,
      orgId: input.orgId,
    },
    contacts: {
      email: accountRow?.email ?? input.authEmail ?? null,
      phoneE164: accountRow?.phone_e164 ?? null,
      whatsappE164: accountRow?.whatsapp_e164 ?? null,
      emailVerified:
        accountRow?.email_verified ?? (accountRow?.email_verified_at ? true : undefined),
      emailVerifiedAt: accountRow?.email_verified_at ?? null,
      phoneVerified:
        accountRow?.phone_verified ?? (accountRow?.phone_verified_at ? true : undefined),
      phoneVerifiedAt: accountRow?.phone_verified_at ?? null,
      whatsappVerified:
        accountRow?.whatsapp_verified ?? (accountRow?.whatsapp_verified_at ? true : undefined),
      whatsappVerifiedAt: accountRow?.whatsapp_verified_at ?? null,
      preferredContactChannels: (accountRow?.preferred_contact_channels as Array<
        'email' | 'sms' | 'whatsapp'
      > | null) ?? ['email'],
    },
    access: input.userRoles.length
      ? {
          userRoles: input.userRoles,
          activeContext: null,
        }
      : undefined,
    lifecycle: {
      status: accountRow?.status ?? 'active',
      createdAt: accountRow?.created_at ?? new Date().toISOString(),
      updatedAt: accountRow?.updated_at ?? new Date().toISOString(),
      archivedAt: accountRow?.archived_at ?? null,
    },
  };
}
