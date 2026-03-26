import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAccountsByIds,
  fetchFamilyLinks,
  fetchUserAccount,
  fetchProfileByAccountId,
  fetchProfilesByAccountIds,
  fetchProfilesForAccount,
} from '@/lib/api/queries';
import { useAuth } from '@/providers/auth-provider';

const FAMILY_VIEW_STORAGE_KEY = 'mobile_family_view_selection';

type FamilySelection = {
  orgId: string;
  guardianAccountId: string;
  childProfileId: string;
};

type FamilySwitchOption = {
  profileId: string;
  kind: 'guardian' | 'child';
  label: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  themeKey?: string | null;
  isActive: boolean;
  isParentOption: boolean;
};

type FamilyViewContextValue = {
  account: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  familySwitchOptions: FamilySwitchOption[];
  isViewingAsChild: boolean;
  viewingAsProfileId: string | null;
  isPending: boolean;
  switchFamilyView: (childProfileId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
};

const FamilyViewContext = createContext<FamilyViewContextValue | null>(null);

function parseStoredSelection(raw: string | null): FamilySelection | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<FamilySelection>;
    if (
      typeof parsed.orgId !== 'string' ||
      typeof parsed.guardianAccountId !== 'string' ||
      typeof parsed.childProfileId !== 'string' ||
      !parsed.orgId.trim() ||
      !parsed.guardianAccountId.trim() ||
      !parsed.childProfileId.trim()
    ) {
      return null;
    }
    return {
      orgId: parsed.orgId,
      guardianAccountId: parsed.guardianAccountId,
      childProfileId: parsed.childProfileId,
    };
  } catch {
    return null;
  }
}

function toSwitchLabel(kind: 'guardian' | 'child') {
  return kind === 'guardian' ? 'Parent' : 'Student';
}

async function persistSelection(selection: FamilySelection | null) {
  if (!selection) {
    await SecureStore.deleteItemAsync(FAMILY_VIEW_STORAGE_KEY);
    return;
  }

  await SecureStore.setItemAsync(FAMILY_VIEW_STORAGE_KEY, JSON.stringify(selection));
}

export function FamilyViewProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChildProfileId, setSelectedChildProfileId] = useState<string | null>(
    null,
  );
  const [selectionHydrated, setSelectionHydrated] = useState(false);

  const baseAccountQuery = useQuery({
    queryKey: ['account-base', user?.id],
    queryFn: fetchUserAccount,
    enabled: !!user,
  });

  const baseAccount = (baseAccountQuery.data ?? null) as Record<string, unknown> | null;
  const baseAccountId = (baseAccount?.id as string | undefined) ?? '';
  const orgId = (baseAccount?.org_id as string | undefined) ?? '';
  const activeProfileId =
    (baseAccount?.active_profile_id as string | null | undefined) ?? null;

  const baseProfilesQuery = useQuery({
    queryKey: ['profiles-by-account-base', baseAccountId, orgId],
    queryFn: () => fetchProfilesForAccount(baseAccountId, orgId),
    enabled: !!baseAccountId && !!orgId,
  });

  const baseProfiles = (baseProfilesQuery.data ?? []) as Record<string, unknown>[];
  const activeBaseProfile =
    baseProfiles.find((profile) => profile.id === activeProfileId) ??
    baseProfiles[0] ??
    null;
  const guardianProfile =
    (activeBaseProfile?.kind === 'guardian'
      ? activeBaseProfile
      : baseProfiles.find((profile) => profile.kind === 'guardian')) ?? null;

  const familyLinksQuery = useQuery({
    queryKey: ['family-links-base', orgId, baseAccountId, guardianProfile?.id ?? null],
    queryFn: () => fetchFamilyLinks(orgId, baseAccountId),
    enabled: !!orgId && !!baseAccountId && !!guardianProfile,
  });

  const familyLinks = (familyLinksQuery.data ?? []) as Record<string, unknown>[];
  const linkedChildAccountIds = Array.from(
    new Set(
      familyLinks
        .map((link) => (link.child_account_id as string | undefined) ?? '')
        .filter(Boolean),
    ),
  );

  const linkedChildProfilesQuery = useQuery({
    queryKey: ['family-child-profiles', orgId, linkedChildAccountIds],
    queryFn: () => fetchProfilesByAccountIds(orgId, linkedChildAccountIds),
    enabled: !!orgId && linkedChildAccountIds.length > 0,
  });

  const linkedChildAccountsQuery = useQuery({
    queryKey: ['family-child-accounts', linkedChildAccountIds],
    queryFn: () => fetchAccountsByIds(linkedChildAccountIds),
    enabled: linkedChildAccountIds.length > 0,
  });

  const linkedChildProfiles = useMemo(
    () =>
      ((linkedChildProfilesQuery.data ?? []) as Record<string, unknown>[]).filter(
        (profile) =>
          profile.kind === 'child' &&
          profile.status !== 'deleted' &&
          profile.status !== 'inactive',
      ),
    [linkedChildProfilesQuery.data],
  );

  const linkedChildAccountsById = useMemo(
    () =>
      new Map(
        ((linkedChildAccountsQuery.data ?? []) as Record<string, unknown>[]).map(
          (account) => [account.id as string, account],
        ),
      ),
    [linkedChildAccountsQuery.data],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateSelection() {
      if (!user || !baseAccountId || !orgId || !guardianProfile) {
        if (!cancelled) {
          setSelectedChildProfileId(null);
          setSelectionHydrated(true);
        }
        return;
      }

      if (
        familyLinksQuery.isPending ||
        linkedChildProfilesQuery.isPending ||
        linkedChildAccountsQuery.isPending
      ) {
        return;
      }

      const stored = parseStoredSelection(
        await SecureStore.getItemAsync(FAMILY_VIEW_STORAGE_KEY),
      );

      const matchedChild =
        stored && stored.orgId === orgId && stored.guardianAccountId === baseAccountId
          ? linkedChildProfiles.find((profile) => profile.id === stored.childProfileId)
          : null;

      if (stored && !matchedChild) {
        await persistSelection(null);
      }

      if (!cancelled) {
        setSelectedChildProfileId((matchedChild?.id as string | undefined) ?? null);
        setSelectionHydrated(true);
      }
    }

    void hydrateSelection();

    return () => {
      cancelled = true;
    };
  }, [
    baseAccountId,
    familyLinksQuery.isPending,
    guardianProfile,
    linkedChildAccountsQuery.isPending,
    linkedChildProfiles,
    linkedChildProfilesQuery.isPending,
    orgId,
    user,
  ]);

  const selectedChildProfile =
    linkedChildProfiles.find((profile) => profile.id === selectedChildProfileId) ?? null;
  const selectedChildAccount = selectedChildProfile
    ? linkedChildAccountsById.get((selectedChildProfile.account_id as string) ?? '')
    : null;

  const effectiveAccount = (selectedChildAccount ?? baseAccount) as Record<
    string,
    unknown
  > | null;
  const effectiveAccountId = (effectiveAccount?.id as string | undefined) ?? '';
  const effectiveOrgId = (effectiveAccount?.org_id as string | undefined) ?? orgId;

  const effectiveProfileQuery = useQuery({
    queryKey: ['profile-by-account-effective', effectiveAccountId, effectiveOrgId],
    queryFn: () => fetchProfileByAccountId(effectiveAccountId),
    enabled: !!effectiveAccountId,
  });

  const effectiveProfile =
    ((selectedChildProfile ?? effectiveProfileQuery.data ?? activeBaseProfile) as Record<
      string,
      unknown
    > | null) ?? null;
  const isViewingAsChild = Boolean(selectedChildProfile);
  const viewingAsProfileId = (selectedChildProfile?.id as string | undefined) ?? null;

  const familySwitchOptions = useMemo<FamilySwitchOption[]>(() => {
    if (!guardianProfile || !effectiveProfile) {
      return [];
    }

    const effectiveKind = effectiveProfile.kind;
    if (effectiveKind !== 'guardian' && effectiveKind !== 'child') {
      return [];
    }

    const options: FamilySwitchOption[] = [
      {
        profileId: guardianProfile.id as string,
        kind: 'guardian',
        label: toSwitchLabel('guardian'),
        displayName: (guardianProfile.display_name as string | null | undefined) ?? null,
        avatarUrl: (guardianProfile.avatar_url as string | null | undefined) ?? null,
        avatarSeed: (guardianProfile.avatar_seed as string | null | undefined) ?? null,
        themeKey: (guardianProfile.ui_theme_key as string | null | undefined) ?? null,
        isActive: !isViewingAsChild,
        isParentOption: true,
      },
      ...linkedChildProfiles.map((profile) => ({
        profileId: profile.id as string,
        kind: 'child' as const,
        label: toSwitchLabel('child'),
        displayName: (profile.display_name as string | null | undefined) ?? null,
        avatarUrl: (profile.avatar_url as string | null | undefined) ?? null,
        avatarSeed: (profile.avatar_seed as string | null | undefined) ?? null,
        themeKey: (profile.ui_theme_key as string | null | undefined) ?? null,
        isActive: profile.id === selectedChildProfileId,
        isParentOption: false,
      })),
    ];

    return options;
  }, [
    effectiveProfile,
    guardianProfile,
    isViewingAsChild,
    linkedChildProfiles,
    selectedChildProfileId,
  ]);

  const refresh = useCallback(async () => {
    const tasks: Array<Promise<unknown>> = [baseAccountQuery.refetch()];

    if (baseAccountId && orgId) {
      tasks.push(baseProfilesQuery.refetch());
    }
    if (guardianProfile && baseAccountId && orgId) {
      tasks.push(familyLinksQuery.refetch());
    }
    if (linkedChildAccountIds.length > 0) {
      tasks.push(linkedChildProfilesQuery.refetch(), linkedChildAccountsQuery.refetch());
    }
    if (effectiveAccountId) {
      tasks.push(effectiveProfileQuery.refetch());
    }

    await Promise.all(tasks);
  }, [
    baseAccountId,
    baseAccountQuery,
    baseProfilesQuery,
    effectiveProfileQuery,
    effectiveAccountId,
    familyLinksQuery,
    guardianProfile,
    linkedChildAccountIds.length,
    linkedChildAccountsQuery,
    linkedChildProfilesQuery,
    orgId,
  ]);

  const switchFamilyView = useCallback(
    async (childProfileId: string | null) => {
      if (!guardianProfile || !baseAccountId || !orgId) {
        throw new Error('Only parent profiles can switch family view.');
      }

      if (!childProfileId) {
        setSelectedChildProfileId(null);
        await persistSelection(null);
        await queryClient.invalidateQueries();
        return;
      }

      const selectedChild = linkedChildProfiles.find(
        (profile) => profile.id === childProfileId,
      );
      if (!selectedChild) {
        throw new Error('Selected student is not linked to this parent.');
      }
      if (selectedChild.status && selectedChild.status !== 'active') {
        throw new Error('Selected student profile is not active.');
      }

      setSelectedChildProfileId(childProfileId);
      await persistSelection({
        orgId,
        guardianAccountId: baseAccountId,
        childProfileId,
      });
      await queryClient.invalidateQueries();
    },
    [baseAccountId, guardianProfile, linkedChildProfiles, orgId, queryClient],
  );

  const value = useMemo<FamilyViewContextValue>(
    () => ({
      account: effectiveAccount,
      profile: effectiveProfile,
      familySwitchOptions,
      isViewingAsChild,
      viewingAsProfileId,
      isPending:
        baseAccountQuery.isPending ||
        baseProfilesQuery.isPending ||
        !selectionHydrated ||
        effectiveProfileQuery.isPending,
      switchFamilyView,
      refresh,
    }),
    [
      baseAccountQuery.isPending,
      baseProfilesQuery.isPending,
      effectiveAccount,
      effectiveProfile,
      effectiveProfileQuery.isPending,
      familySwitchOptions,
      isViewingAsChild,
      refresh,
      selectionHydrated,
      switchFamilyView,
      viewingAsProfileId,
    ],
  );

  return (
    <FamilyViewContext.Provider value={value}>{children}</FamilyViewContext.Provider>
  );
}

export function useFamilyView() {
  const context = useContext(FamilyViewContext);
  if (!context) {
    throw new Error('useFamilyView must be used within a FamilyViewProvider');
  }
  return context;
}
