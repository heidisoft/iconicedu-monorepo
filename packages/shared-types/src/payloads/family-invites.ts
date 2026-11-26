/** Family/org/role are resolved by the API from the authenticated guardian. */
export type CreateFamilyChildInviteInput = {
  invitedEmail: string;
  targetProfileId?: string;
};
