import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import type {
  AssessmentSubjectVM,
  AssessmentDomainVM,
  AssessmentSkillVM,
  AssessmentItemVM,
  AssessmentItemListVM,
  AssessmentTestVM,
  AssessmentTestListVM,
  AssessmentDeliveryVM,
  AssessmentDeliveryListVM,
  AssessmentSessionVM,
  AssessmentNextItemVM,
  AssessmentResultVM,
} from '@iconicedu/shared-types';

export function createAssessmentApiClient(supabase: SupabaseClient) {
  const api = createApiClient(supabase);

  return {
    // Curriculum
    listSubjects: (orgId: string) =>
      api.get<AssessmentSubjectVM[]>('/assessment-curriculum/subjects', { orgId }),

    createSubject: (
      orgId: string,
      body: { name: string; icon?: string; color?: string },
    ) =>
      api.post<AssessmentSubjectVM>('/assessment-curriculum/subjects', {
        orgId,
        ...body,
      }),

    updateSubject: (
      id: string,
      orgId: string,
      body: { name?: string; icon?: string; color?: string },
    ) =>
      api.put<AssessmentSubjectVM>(`/assessment-curriculum/subjects/${id}`, {
        orgId,
        ...body,
      }),

    deleteSubject: (id: string, orgId: string) =>
      api.delete(`/assessment-curriculum/subjects/${id}?orgId=${orgId}`),

    getSubjectTree: (subjectId: string, orgId: string) =>
      api.get<{ subject: AssessmentSubjectVM; domains: AssessmentDomainVM[] }>(
        `/assessment-curriculum/subjects/${subjectId}/tree`,
        { orgId },
      ),

    listSkills: (
      orgId: string,
      filters?: {
        domainId?: string;
        subjectId?: string;
        grade?: number;
        standard?: string;
      },
    ) =>
      api.get<AssessmentSkillVM[]>('/assessment-curriculum/skills', {
        orgId,
        ...filters,
      }),

    createDomain: (
      orgId: string,
      body: { subjectId: string; name: string; grade: number; description?: string },
    ) =>
      api.post<AssessmentDomainVM>('/assessment-curriculum/domains', { orgId, ...body }),

    createSkill: (
      orgId: string,
      body: {
        domainId: string;
        name: string;
        description?: string;
        standard?: string;
        difficultyBaseline?: number;
        estimatedTimeSeconds?: number;
      },
    ) => api.post<AssessmentSkillVM>('/assessment-curriculum/skills', { orgId, ...body }),

    updateSkill: (id: string, orgId: string, body: Record<string, unknown>) =>
      api.put<AssessmentSkillVM>(`/assessment-curriculum/skills/${id}`, {
        orgId,
        ...body,
      }),

    deleteSkill: (id: string, orgId: string) =>
      api.delete(`/assessment-curriculum/skills/${id}?orgId=${orgId}`),

    // Items
    listItems: (
      orgId: string,
      filters?: {
        skillId?: string;
        type?: string;
        difficulty?: number;
        search?: string;
        page?: number;
      },
    ) =>
      api.get<{ items: AssessmentItemListVM[]; total: number }>('/assessment-items', {
        orgId,
        ...filters,
      }),

    getItem: (id: string, orgId: string) =>
      api.get<AssessmentItemVM>(`/assessment-items/${id}`, { orgId }),

    createItem: (body: {
      orgId: string;
      skillId: string;
      title: string;
      type: string;
      content: unknown;
      explanation?: string;
      difficulty: number;
      estimatedTimeSeconds?: number;
    }) => api.post<AssessmentItemVM>('/assessment-items', body),

    updateItem: (id: string, body: { orgId: string } & Record<string, unknown>) =>
      api.put<AssessmentItemVM>(`/assessment-items/${id}`, body),

    deleteItem: (id: string, orgId: string) =>
      api.delete(`/assessment-items/${id}?orgId=${orgId}`),

    getSkillCoverage: (skillId: string) =>
      api.get<Record<number, number>>(`/assessment-items/skill/${skillId}/coverage`),

    // Tests
    listTests: (orgId: string) =>
      api.get<AssessmentTestListVM[]>('/assessment-tests', { orgId }),

    getTest: (id: string, orgId: string) =>
      api.get<AssessmentTestVM>(`/assessment-tests/${id}`, { orgId }),

    createTest: (
      body: { orgId: string; title: string; mode?: string } & Record<string, unknown>,
    ) => api.post<AssessmentTestVM>('/assessment-tests', body),

    updateTest: (id: string, body: { orgId: string } & Record<string, unknown>) =>
      api.put<AssessmentTestVM>(`/assessment-tests/${id}`, body),

    addSection: (testId: string, body: { title?: string; orderPosition?: number }) =>
      api.post(`/assessment-tests/${testId}/sections`, body),

    addItemToSection: (sectionId: string, body: { itemId: string; points?: number }) =>
      api.post(`/assessment-tests/sections/${sectionId}/items`, body),

    removeItemFromSection: (sectionId: string, itemId: string) =>
      api.delete(`/assessment-tests/sections/${sectionId}/items/${itemId}`),

    addSkillPool: (
      testId: string,
      body: { skillId: string; targetItems?: number; startDifficulty?: number },
    ) => api.post(`/assessment-tests/${testId}/skill-pools`, body),

    removeSkillPool: (poolId: string) =>
      api.delete(`/assessment-tests/skill-pools/${poolId}`),

    // Deliveries
    listDeliveries: (orgId: string) =>
      api.get<AssessmentDeliveryListVM[]>('/assessment-deliveries', { orgId }),

    getDelivery: (id: string, orgId: string) =>
      api.get<AssessmentDeliveryVM>(`/assessment-deliveries/${id}`, { orgId }),

    createDelivery: (
      body: { orgId: string; testId: string; title: string } & Record<string, unknown>,
    ) => api.post<AssessmentDeliveryVM>('/assessment-deliveries', body),

    updateDelivery: (id: string, body: { orgId: string } & Record<string, unknown>) =>
      api.put<AssessmentDeliveryVM>(`/assessment-deliveries/${id}`, body),

    generateToken: (id: string, orgId: string) =>
      api.post<{ accessToken: string; publicUrl: string }>(
        `/assessment-deliveries/${id}/generate-token?orgId=${orgId}`,
        {},
      ),

    getDeliveryResults: (id: string) => api.get(`/assessment-deliveries/${id}/results`),

    getDeliverySkillBreakdown: (id: string) =>
      api.get(`/assessment-deliveries/${id}/skill-breakdown`),

    // Sessions (no auth required for some endpoints)
    startSession: (body: {
      deliveryId: string;
      profileId?: string;
      anonName?: string;
      anonEmail?: string;
    }) => api.post<AssessmentSessionVM>('/assessment-sessions', body),

    getSession: (sessionId: string) =>
      api.get<AssessmentSessionVM>(`/assessment-sessions/${sessionId}`),

    saveResponse: (
      sessionId: string,
      body: {
        itemId: string;
        responseData: unknown;
        isFlagged?: boolean;
        timeSpentSeconds?: number;
      },
    ) =>
      api.put<AssessmentNextItemVM>(`/assessment-sessions/${sessionId}/response`, body),

    submitSession: (sessionId: string) =>
      api.post<{ sessionId: string; resultId: string }>(
        `/assessment-sessions/${sessionId}/submit`,
        {},
      ),

    // Results
    getResult: (sessionId: string) =>
      api.get<AssessmentResultVM>(`/assessment-results/session/${sessionId}`),

    getReport: (sessionId: string, type: 'parent' | 'tutor' | 'learning-plan') =>
      api.get(`/assessment-results/session/${sessionId}/reports/${type}`),

    computeResult: (sessionId: string) =>
      api.post<AssessmentResultVM>(
        `/assessment-results/session/${sessionId}/compute`,
        {},
      ),

    gradeItem: (sessionId: string, itemId: string, score: number) =>
      api.put(`/assessment-results/session/${sessionId}/grade/${itemId}`, { score }),
  };
}

// Public (no-auth) delivery lookup
const DEFAULT_LOCAL_API_URL = 'http://localhost:3001';
function getApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_LOCAL_API_URL).replace(/\/+$/, '');
}

export async function getPublicDeliveryByToken(
  token: string,
): Promise<AssessmentDeliveryVM | null> {
  try {
    const res = await fetch(`${getApiUrl()}/assessment-deliveries/by-token/${token}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function startPublicSession(body: {
  deliveryId: string;
  anonName?: string;
  anonEmail?: string;
}): Promise<AssessmentSessionVM | null> {
  try {
    const res = await fetch(`${getApiUrl()}/assessment-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function savePublicResponse(
  sessionId: string,
  body: { itemId: string; responseData: unknown; timeSpentSeconds?: number },
): Promise<AssessmentNextItemVM | null> {
  try {
    const res = await fetch(`${getApiUrl()}/assessment-sessions/${sessionId}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function submitPublicSession(sessionId: string): Promise<void> {
  await fetch(`${getApiUrl()}/assessment-sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export async function getPublicResult(
  sessionId: string,
): Promise<AssessmentResultVM | null> {
  try {
    const res = await fetch(`${getApiUrl()}/assessment-results/session/${sessionId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
