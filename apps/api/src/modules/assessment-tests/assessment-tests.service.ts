import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type {
  AssessmentTestVM,
  AssessmentTestListVM,
  AssessmentTestSectionVM,
  AssessmentSkillPoolVM,
  AssessmentItemVM,
  AssessmentItemContent,
  AssessmentItemType,
} from '@iconicedu/shared-types';

type SubjectJoin = { name?: string } | null;
type DomainJoin = {
  name?: string;
  grade?: number;
  assessment_subjects?: SubjectJoin | SubjectJoin[] | null;
} | null;
type SkillJoin = {
  name?: string;
  standard?: string | null;
  assessment_domains?: DomainJoin | DomainJoin[] | null;
} | null;
type ItemJoinRow = {
  id: string;
  org_id: string;
  skill_id: string;
  title: string;
  type: AssessmentItemType;
  content: AssessmentItemContent;
  explanation?: string | null;
  difficulty: number;
  estimated_time_seconds?: number | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  assessment_skills?: SkillJoin | SkillJoin[] | null;
};

@Injectable()
export class AssessmentTestsService {
  async listTests(orgId: string): Promise<AssessmentTestListVM[]> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_tests')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      orgId: row.org_id,
      title: row.title,
      mode: row.mode,
      totalItems: 0,
      estimatedMinutes: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getTest(id: string, orgId: string): Promise<AssessmentTestVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_tests')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Test not found');

    const [sections, skillPools] = await Promise.all([
      this.getSectionsForTest(id),
      this.getSkillPoolsForTest(id),
    ]);

    const totalItems =
      data.mode === 'adaptive'
        ? skillPools.reduce((sum, p) => sum + p.targetItems, 0)
        : sections.reduce((sum, s) => sum + s.items.length, 0);

    return {
      id: data.id,
      orgId: data.org_id,
      title: data.title,
      description: data.description,
      instructions: data.instructions,
      mode: data.mode,
      timeLimitMinutes: data.time_limit_minutes,
      passingScorePercent: data.passing_score_percent,
      shuffleSections: data.shuffle_sections,
      showResultsImmediately: data.show_results_immediately,
      showCorrectAnswers: data.show_correct_answers,
      adaptiveConfig: data.adaptive_config,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      sections,
      skillPools,
      totalItems,
    };
  }

  async createTest(
    orgId: string,
    createdBy: string,
    body: {
      title: string;
      description?: string;
      instructions?: string;
      mode?: string;
      timeLimitMinutes?: number;
      passingScorePercent?: number;
      shuffleSections?: boolean;
      showResultsImmediately?: boolean;
      showCorrectAnswers?: boolean;
      adaptiveConfig?: Record<string, unknown>;
    },
  ): Promise<AssessmentTestVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_tests')
      .insert({
        org_id: orgId,
        created_by: createdBy,
        title: body.title,
        description: body.description,
        instructions: body.instructions,
        mode: body.mode ?? 'standard',
        time_limit_minutes: body.timeLimitMinutes,
        passing_score_percent: body.passingScorePercent,
        shuffle_sections: body.shuffleSections ?? false,
        show_results_immediately: body.showResultsImmediately ?? true,
        show_correct_answers: body.showCorrectAnswers ?? false,
        adaptive_config: body.adaptiveConfig,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return {
      id: data.id,
      orgId: data.org_id,
      title: data.title,
      mode: data.mode,
      description: data.description,
      instructions: data.instructions,
      timeLimitMinutes: data.time_limit_minutes,
      passingScorePercent: data.passing_score_percent,
      shuffleSections: data.shuffle_sections,
      showResultsImmediately: data.show_results_immediately,
      showCorrectAnswers: data.show_correct_answers,
      adaptiveConfig: data.adaptive_config,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      sections: [],
      skillPools: [],
      totalItems: 0,
    };
  }

  async updateTest(
    id: string,
    orgId: string,
    body: Record<string, unknown>,
  ): Promise<AssessmentTestVM> {
    const supabase = createSupabaseServiceClient();
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.description !== undefined) update.description = body.description;
    if (body.instructions !== undefined) update.instructions = body.instructions;
    if (body.timeLimitMinutes !== undefined)
      update.time_limit_minutes = body.timeLimitMinutes;
    if (body.passingScorePercent !== undefined)
      update.passing_score_percent = body.passingScorePercent;
    if (body.shuffleSections !== undefined)
      update.shuffle_sections = body.shuffleSections;
    if (body.showResultsImmediately !== undefined)
      update.show_results_immediately = body.showResultsImmediately;
    if (body.showCorrectAnswers !== undefined)
      update.show_correct_answers = body.showCorrectAnswers;
    if (body.adaptiveConfig !== undefined) update.adaptive_config = body.adaptiveConfig;

    const { data, error } = await supabase
      .from('assessment_tests')
      .update(update)
      .eq('id', id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Test not found');
    return this.getTest(id, orgId);
  }

  async deleteTest(id: string, orgId: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('assessment_tests')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);
    if (error) throw new BadRequestException(error.message);
  }

  // ---------------------------------------------------------------------------
  // Sections (static tests)
  // ---------------------------------------------------------------------------

  async getSectionsForTest(testId: string): Promise<AssessmentTestSectionVM[]> {
    const supabase = createSupabaseServiceClient();
    const { data: sections } = await supabase
      .from('assessment_test_sections')
      .select('*')
      .eq('test_id', testId)
      .order('order_position');

    if (!sections?.length) return [];

    const sectionIds = sections.map((s) => s.id);
    const { data: sectionItems } = await supabase
      .from('assessment_test_section_items')
      .select(
        `
        *,
        assessment_items!inner(
          *,
          assessment_skills!inner(name, standard, assessment_domains!inner(name, grade, subject_id, assessment_subjects(name)))
        )
      `,
      )
      .in('section_id', sectionIds)
      .order('order_position');

    return sections.map((s) => ({
      id: s.id,
      testId: s.test_id,
      title: s.title,
      orderPosition: s.order_position,
      shuffleItems: s.shuffle_items,
      itemsToShow: s.items_to_show,
      items: (sectionItems ?? [])
        .filter((si) => si.section_id === s.id)
        .map((si) => ({
          id: si.id,
          sectionId: si.section_id,
          itemId: si.item_id,
          orderPosition: si.order_position,
          points: si.points,
          item: si.assessment_items
            ? this.mapItemFromRow(si.assessment_items as unknown as ItemJoinRow)
            : undefined,
        })),
    }));
  }

  async addSection(
    testId: string,
    body: {
      title?: string;
      orderPosition?: number;
      shuffleItems?: boolean;
      itemsToShow?: number;
    },
  ): Promise<AssessmentTestSectionVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_test_sections')
      .insert({
        test_id: testId,
        title: body.title,
        order_position: body.orderPosition ?? 0,
        shuffle_items: body.shuffleItems ?? false,
        items_to_show: body.itemsToShow,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return {
      id: data.id,
      testId: data.test_id,
      title: data.title,
      orderPosition: data.order_position,
      shuffleItems: data.shuffle_items,
      itemsToShow: data.items_to_show,
      items: [],
    };
  }

  async addItemToSection(
    sectionId: string,
    body: { itemId: string; orderPosition?: number; points?: number },
  ): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from('assessment_test_section_items').insert({
      section_id: sectionId,
      item_id: body.itemId,
      order_position: body.orderPosition ?? 0,
      points: body.points ?? 1,
    });
    if (error) throw new BadRequestException(error.message);
  }

  async removeItemFromSection(sectionId: string, itemId: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    await supabase
      .from('assessment_test_section_items')
      .delete()
      .eq('section_id', sectionId)
      .eq('item_id', itemId);
  }

  async reorderSectionItems(
    sectionId: string,
    itemOrders: { itemId: string; orderPosition: number }[],
  ): Promise<void> {
    const supabase = createSupabaseServiceClient();
    for (const o of itemOrders) {
      await supabase
        .from('assessment_test_section_items')
        .update({ order_position: o.orderPosition })
        .eq('section_id', sectionId)
        .eq('item_id', o.itemId);
    }
  }

  async deleteSection(sectionId: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    await supabase.from('assessment_test_sections').delete().eq('id', sectionId);
  }

  // ---------------------------------------------------------------------------
  // Skill pools (adaptive tests)
  // ---------------------------------------------------------------------------

  async getSkillPoolsForTest(testId: string): Promise<AssessmentSkillPoolVM[]> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_test_skill_pools')
      .select(
        `
        *,
        assessment_skills!inner(
          name, standard,
          assessment_domains!inner(name, grade, subject_id, assessment_subjects(name))
        )
      `,
      )
      .eq('test_id', testId)
      .order('order_position');

    return (data ?? []).map((row) => {
      const skill = Array.isArray(row.assessment_skills)
        ? row.assessment_skills[0]
        : row.assessment_skills;
      const domain = Array.isArray(skill?.assessment_domains)
        ? skill?.assessment_domains[0]
        : skill?.assessment_domains;
      const subject = Array.isArray(domain?.assessment_subjects)
        ? domain?.assessment_subjects[0]
        : domain?.assessment_subjects;
      return {
        id: row.id,
        testId: row.test_id,
        skillId: row.skill_id,
        skillName: skill?.name ?? '',
        domainName: domain?.name ?? '',
        subjectName: subject?.name ?? '',
        grade: domain?.grade ?? 0,
        standard: skill?.standard,
        targetItems: row.target_items,
        minItems: row.min_items,
        maxItems: row.max_items,
        startDifficulty: row.start_difficulty,
        orderPosition: row.order_position,
      };
    });
  }

  async addSkillPool(
    testId: string,
    body: {
      skillId: string;
      targetItems?: number;
      minItems?: number;
      maxItems?: number;
      startDifficulty?: number;
      orderPosition?: number;
    },
  ): Promise<AssessmentSkillPoolVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_test_skill_pools')
      .insert({
        test_id: testId,
        skill_id: body.skillId,
        target_items: body.targetItems ?? 5,
        min_items: body.minItems ?? 3,
        max_items: body.maxItems ?? 8,
        start_difficulty: body.startDifficulty ?? 3,
        order_position: body.orderPosition ?? 0,
      })
      .select(
        `*, assessment_skills!inner(name, standard, assessment_domains!inner(name, grade, subject_id, assessment_subjects(name)))`,
      )
      .single();
    if (error) throw new BadRequestException(error.message);
    const skill = Array.isArray(data.assessment_skills)
      ? data.assessment_skills[0]
      : data.assessment_skills;
    const domain = Array.isArray(skill?.assessment_domains)
      ? skill?.assessment_domains[0]
      : skill?.assessment_domains;
    const subject = Array.isArray(domain?.assessment_subjects)
      ? domain?.assessment_subjects[0]
      : domain?.assessment_subjects;
    return {
      id: data.id,
      testId: data.test_id,
      skillId: data.skill_id,
      skillName: skill?.name ?? '',
      domainName: domain?.name ?? '',
      subjectName: subject?.name ?? '',
      grade: domain?.grade ?? 0,
      standard: skill?.standard,
      targetItems: data.target_items,
      minItems: data.min_items,
      maxItems: data.max_items,
      startDifficulty: data.start_difficulty,
      orderPosition: data.order_position,
    };
  }

  async updateSkillPool(
    id: string,
    body: {
      targetItems?: number;
      minItems?: number;
      maxItems?: number;
      startDifficulty?: number;
      orderPosition?: number;
    },
  ): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const update: Record<string, unknown> = {};
    if (body.targetItems !== undefined) update.target_items = body.targetItems;
    if (body.minItems !== undefined) update.min_items = body.minItems;
    if (body.maxItems !== undefined) update.max_items = body.maxItems;
    if (body.startDifficulty !== undefined)
      update.start_difficulty = body.startDifficulty;
    if (body.orderPosition !== undefined) update.order_position = body.orderPosition;
    await supabase.from('assessment_test_skill_pools').update(update).eq('id', id);
  }

  async removeSkillPool(id: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    await supabase.from('assessment_test_skill_pools').delete().eq('id', id);
  }

  // ---------------------------------------------------------------------------
  // Helper: get all item IDs for a test (static) in order
  // ---------------------------------------------------------------------------
  async getStaticItemIds(
    testId: string,
  ): Promise<{ itemId: string; points: number; sectionId: string }[]> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_test_section_items')
      .select(
        'item_id, points, section_id, assessment_test_sections!inner(test_id, order_position, shuffle_items)',
      )
      .eq('assessment_test_sections.test_id', testId)
      .order('assessment_test_sections.order_position')
      .order('order_position');
    return (data ?? []).map((r) => ({
      itemId: r.item_id,
      points: r.points,
      sectionId: r.section_id,
    }));
  }

  private mapItemFromRow(row: ItemJoinRow): AssessmentItemVM {
    const skill = Array.isArray(row.assessment_skills)
      ? row.assessment_skills[0]
      : row.assessment_skills;
    const domain = Array.isArray(skill?.assessment_domains)
      ? skill?.assessment_domains[0]
      : skill?.assessment_domains;
    const subject = Array.isArray(domain?.assessment_subjects)
      ? domain?.assessment_subjects[0]
      : domain?.assessment_subjects;
    return {
      id: row.id,
      orgId: row.org_id,
      skillId: row.skill_id,
      skillName: skill?.name ?? '',
      domainName: domain?.name ?? '',
      subjectName: subject?.name ?? '',
      grade: domain?.grade ?? 0,
      standard: skill?.standard,
      title: row.title,
      type: row.type,
      content: row.content,
      explanation: row.explanation,
      difficulty: row.difficulty,
      estimatedTimeSeconds: row.estimated_time_seconds,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
