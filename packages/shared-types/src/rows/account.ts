import type {
  AccountRoleStatus,
  AccountStatus,
  ISODateTime,
  UUID,
} from '@iconicedu/shared-types/shared/shared';
import type { RoleKey } from '@iconicedu/shared-types/vm/roles';

export interface AccountRow {
  id: UUID;
  org_id: UUID;
  auth_user_id?: UUID | null;
  email?: string | null;
  phone_e164?: string | null;
  whatsapp_e164?: string | null;
  email_verified?: boolean | null;
  email_verified_at?: ISODateTime | null;
  phone_verified?: boolean | null;
  phone_verified_at?: ISODateTime | null;
  whatsapp_verified?: boolean | null;
  whatsapp_verified_at?: ISODateTime | null;
  preferred_contact_channels?: string[] | null;
  status: AccountStatus;
  primary_role?: RoleKey | null;
  role_status?: AccountRoleStatus | null;
  onboarding_completed_at?: ISODateTime | null;
  created_at: ISODateTime;
  created_by?: UUID | null;
  updated_at: ISODateTime;
  updated_by?: UUID | null;
  archived_at?: ISODateTime | null;
  deleted_at?: ISODateTime | null;
  deleted_by?: UUID | null;
}
