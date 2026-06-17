import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type {
  AssessmentItemVM,
  AssessmentItemListVM,
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
type ItemRow = {
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
export class AssessmentItemsService {
  async listItems(
    orgId: string,
    filters: {
      skillId?: string;
      type?: string;
      difficulty?: number;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{ items: AssessmentItemListVM[]; total: number }> {
    const supabase = createSupabaseServiceClient();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    let q = supabase
      .from('assessment_items')
      .select(
        `
        id, org_id, skill_id, title, type, difficulty, estimated_time_seconds, created_at, updated_at,
        assessment_skills!inner(
          name, standard,
          assessment_domains!inner(
            name, grade, subject_id,
            assessment_subjects(name)
          )
        )
      `,
        { count: 'exact' },
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (filters.skillId) q = q.eq('skill_id', filters.skillId);
    if (filters.type) q = q.eq('type', filters.type);
    if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
    if (filters.search) q = q.ilike('title', `%${filters.search}%`);

    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);

    return {
      items: (data ?? []).map((row) => this.mapItemList(row as unknown as ItemRow)),
      total: count ?? 0,
    };
  }

  async getItem(id: string, orgId: string): Promise<AssessmentItemVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_items')
      .select(
        `
        *,
        assessment_skills!inner(
          name, standard,
          assessment_domains!inner(
            name, grade, subject_id,
            assessment_subjects(name)
          )
        )
      `,
      )
      .eq('id', id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Item not found');
    return this.mapItem(data);
  }

  async createItem(
    orgId: string,
    createdBy: string,
    body: {
      skillId: string;
      title: string;
      type: string;
      content: Record<string, unknown>;
      explanation?: string;
      difficulty: number;
      estimatedTimeSeconds?: number;
    },
  ): Promise<AssessmentItemVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_items')
      .insert({
        org_id: orgId,
        created_by: createdBy,
        skill_id: body.skillId,
        title: body.title,
        type: body.type,
        content: body.content,
        explanation: body.explanation,
        difficulty: body.difficulty,
        estimated_time_seconds: body.estimatedTimeSeconds,
      })
      .select(
        `
        *,
        assessment_skills!inner(
          name, standard,
          assessment_domains!inner(name, grade, subject_id, assessment_subjects(name))
        )
      `,
      )
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.mapItem(data);
  }

  async updateItem(
    id: string,
    orgId: string,
    body: {
      skillId?: string;
      title?: string;
      content?: Record<string, unknown>;
      explanation?: string;
      difficulty?: number;
      estimatedTimeSeconds?: number;
    },
  ): Promise<AssessmentItemVM> {
    const supabase = createSupabaseServiceClient();
    const update: Record<string, unknown> = {};
    if (body.skillId !== undefined) update.skill_id = body.skillId;
    if (body.title !== undefined) update.title = body.title;
    if (body.content !== undefined) update.content = body.content;
    if (body.explanation !== undefined) update.explanation = body.explanation;
    if (body.difficulty !== undefined) update.difficulty = body.difficulty;
    if (body.estimatedTimeSeconds !== undefined)
      update.estimated_time_seconds = body.estimatedTimeSeconds;

    const { data, error } = await supabase
      .from('assessment_items')
      .update(update)
      .eq('id', id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .select(
        `
        *,
        assessment_skills!inner(
          name, standard,
          assessment_domains!inner(name, grade, subject_id, assessment_subjects(name))
        )
      `,
      )
      .single();

    if (error || !data) throw new NotFoundException('Item not found');
    return this.mapItem(data);
  }

  async deleteItem(id: string, orgId: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('assessment_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);
    if (error) throw new BadRequestException(error.message);
  }

  async getSkillCoverage(skillId: string): Promise<Record<number, number>> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_items')
      .select('difficulty')
      .eq('skill_id', skillId)
      .is('deleted_at', null);

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of data ?? []) counts[r.difficulty] = (counts[r.difficulty] ?? 0) + 1;
    return counts;
  }

  // Used by adaptive engine to pick next item
  async pickItemForSkillAndDifficulty(
    skillId: string,
    difficulty: number,
    excludeIds: string[],
  ): Promise<AssessmentItemVM | null> {
    const supabase = createSupabaseServiceClient();
    let q = supabase
      .from('assessment_items')
      .select(
        `
        *,
        assessment_skills!inner(
          name, standard,
          assessment_domains!inner(name, grade, subject_id, assessment_subjects(name))
        )
      `,
      )
      .eq('skill_id', skillId)
      .eq('difficulty', difficulty)
      .is('deleted_at', null)
      .limit(20);

    if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`);

    const { data } = await q;
    if (!data || data.length === 0) return null;
    const random = data[Math.floor(Math.random() * data.length)];
    return this.mapItem(random);
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------

  private mapItemList(row: ItemRow): AssessmentItemListVM {
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
      difficulty: row.difficulty,
      estimatedTimeSeconds: row.estimated_time_seconds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  mapItem(row: ItemRow): AssessmentItemVM {
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
