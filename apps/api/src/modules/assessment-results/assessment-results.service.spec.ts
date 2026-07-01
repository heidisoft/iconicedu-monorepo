import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { AssessmentResultsService } from './assessment-results.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

function createExistingMasteryChain(result: unknown) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => result),
  };
  return chain;
}

describe('AssessmentResultsService skill mastery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates mastery attempts and best percentage without relying on an RPC', async () => {
    const existingQuery = createExistingMasteryChain({
      data: { id: 'mastery-1', best_percentage: 72, attempts: 2 },
      error: null,
    });
    const masteryUpdate = {
      update: jest.fn(() => ({
        eq: jest.fn(async () => ({ data: null, error: null })),
      })),
    };
    const rpc = jest.fn();
    const from = jest
      .fn()
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(masteryUpdate);
    createSupabaseServiceClientMock.mockReturnValue({ from, rpc } as never);

    await (
      new AssessmentResultsService() as unknown as {
        upsertSkillMastery(input: {
          profileId: string;
          skillId: string;
          orgId: string;
          percentage: number;
          level: string;
        }): Promise<void>;
      }
    ).upsertSkillMastery({
      profileId: 'profile-1',
      skillId: 'skill-1',
      orgId: 'org-1',
      percentage: 88,
      level: 'proficient',
    });

    expect(masteryUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        level: 'proficient',
        best_percentage: 88,
        attempts: 3,
      }),
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('inserts the first mastery row under the delivery org', async () => {
    const existingQuery = createExistingMasteryChain({ data: null, error: null });
    const masteryInsert = {
      insert: jest.fn(async () => ({ data: null, error: null })),
    };
    const from = jest
      .fn()
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(masteryInsert);
    createSupabaseServiceClientMock.mockReturnValue({ from } as never);

    await (
      new AssessmentResultsService() as unknown as {
        upsertSkillMastery(input: {
          profileId: string;
          skillId: string;
          orgId: string;
          percentage: number;
          level: string;
        }): Promise<void>;
      }
    ).upsertSkillMastery({
      profileId: 'profile-1',
      skillId: 'skill-1',
      orgId: 'org-1',
      percentage: 82,
      level: 'proficient',
    });

    expect(masteryInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 'profile-1',
        skill_id: 'skill-1',
        org_id: 'org-1',
        best_percentage: 82,
        attempts: 1,
      }),
    );
  });
});
