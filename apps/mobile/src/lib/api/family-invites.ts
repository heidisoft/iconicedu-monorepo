import type {
  CreateFamilyChildInviteInput,
  FamilyLinkInviteVM,
} from '@iconicedu/shared-types';
import { apiGet, apiPost, apiDelete } from './http-client';
export const fetchFamilyChildInvites = () =>
  apiGet<FamilyLinkInviteVM[]>('/family-child-invites');
export const sendFamilyChildInvite = (input: CreateFamilyChildInviteInput) =>
  apiPost<FamilyLinkInviteVM>('/family-child-invites', input);
export const revokeFamilyChildInvite = (id: string) =>
  apiDelete(`/family-child-invites/${encodeURIComponent(id)}`);
