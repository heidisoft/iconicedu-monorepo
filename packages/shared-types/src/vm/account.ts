import type { AccountRoleContextVM, UserRoleVM } from '@iconicedu/shared-types/vm/roles';
import type {
  AccountStatus,
  ISODateTime,
  IdsBaseVM,
} from '@iconicedu/shared-types/shared/shared';

export type ContactChannelVM = 'email' | 'sms' | 'whatsapp';

export interface UserContactVM {
  email?: string | null;
  phoneE164?: string | null;
  whatsappE164?: string | null;

  emailVerified?: boolean;
  emailVerifiedAt?: ISODateTime | null;
  phoneVerified?: boolean;
  phoneVerifiedAt?: ISODateTime | null;
  whatsappVerified?: boolean;
  whatsappVerifiedAt?: ISODateTime | null;

  preferredContactChannels?: ContactChannelVM[] | null;
}

export interface AccountAccessVM {
  userRoles?: UserRoleVM[] | null;
  activeContext?: AccountRoleContextVM | null;
}

export interface AccountLifecycleVM {
  status: AccountStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime | null;
}

export interface UserAccountVM {
  ids: IdsBaseVM;

  contacts: UserContactVM;

  access?: AccountAccessVM;

  lifecycle: AccountLifecycleVM;
}
