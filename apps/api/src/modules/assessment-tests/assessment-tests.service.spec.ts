import { ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { AssessmentTestsService } from './assessment-tests.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

function createMaybeSingleChain(result: unknown) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => result),
  };
  return chain;
}

function createInsertChain(result: unknown) {
  const chain = {
    insert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn(async () => result),
  };
  return chain;
}

describe('AssessmentTestsService authorization guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects adding an item from another org to a section', async () => {
    const itemQuery = createMaybeSingleChain({ data: null, error: null });
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn().mockReturnValueOnce(itemQuery),
    } as never);

    await expect(
      new AssessmentTestsService().addItemToSection(
        'section-1',
        { itemId: 'item-external' },
        'org-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('adds a section item after confirming the item belongs to the org', async () => {
    const itemQuery = createMaybeSingleChain({ data: { id: 'item-1' }, error: null });
    const sectionItemWrite = {
      insert: jest.fn(async () => ({ data: null, error: null })),
    };
    const from = jest
      .fn()
      .mockReturnValueOnce(itemQuery)
      .mockReturnValueOnce(sectionItemWrite);
    createSupabaseServiceClientMock.mockReturnValue({ from } as never);

    await new AssessmentTestsService().addItemToSection(
      'section-1',
      { itemId: 'item-1', points: 2 },
      'org-1',
    );

    expect(itemQuery.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(sectionItemWrite.insert).toHaveBeenCalledWith({
      section_id: 'section-1',
      item_id: 'item-1',
      order_position: 0,
      points: 2,
    });
  });

  it('rejects adding an adaptive skill pool for a skill outside the org', async () => {
    const skillQuery = createMaybeSingleChain({ data: null, error: null });
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn().mockReturnValueOnce(skillQuery),
    } as never);

    await expect(
      new AssessmentTestsService().addSkillPool(
        'test-1',
        { skillId: 'skill-external' },
        'org-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('adds an adaptive skill pool after confirming the skill belongs to the org', async () => {
    const skillQuery = createMaybeSingleChain({ data: { id: 'skill-1' }, error: null });
    const poolWrite = createInsertChain({
      data: {
        id: 'pool-1',
        test_id: 'test-1',
        skill_id: 'skill-1',
        target_items: 5,
        min_items: 3,
        max_items: 8,
        start_difficulty: 3,
        order_position: 0,
        assessment_skills: {
          name: 'Fractions',
          standard: '4.NF',
          assessment_domains: {
            name: 'Number Sense',
            grade: 4,
            assessment_subjects: { name: 'Math' },
          },
        },
      },
      error: null,
    });
    const from = jest.fn().mockReturnValueOnce(skillQuery).mockReturnValueOnce(poolWrite);
    createSupabaseServiceClientMock.mockReturnValue({ from } as never);

    const result = await new AssessmentTestsService().addSkillPool(
      'test-1',
      { skillId: 'skill-1' },
      'org-1',
    );

    expect(skillQuery.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(poolWrite.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        test_id: 'test-1',
        skill_id: 'skill-1',
      }),
    );
    expect(result.skillId).toBe('skill-1');
  });
});
