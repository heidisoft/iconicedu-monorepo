import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type {
  AssessmentSubjectVM,
  AssessmentDomainVM,
  AssessmentSkillVM,
} from '@iconicedu/shared-types';

@Injectable()
export class AssessmentCurriculumService {
  // ---------------------------------------------------------------------------
  // Subjects
  // ---------------------------------------------------------------------------

  async listSubjects(orgId: string, search?: string): Promise<AssessmentSubjectVM[]> {
    const supabase = createSupabaseServiceClient();
    let q = supabase
      .from('assessment_subjects')
      .select('*')
      .eq('org_id', orgId)
      .order('name');
    if (search) q = q.ilike('name', `%${search}%`);
    const { data, error } = await q;

    if (error) throw new BadRequestException(error.message);

    const domainCounts = await this.getDomainCountsBySubject(orgId);
    const skillCounts = await this.getSkillCountsBySubject(orgId);
    const itemCounts = await this.getItemCountsBySubject(orgId);

    return (data ?? []).map((row) => ({
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      domainCount: domainCounts[row.id] ?? 0,
      skillCount: skillCounts[row.id] ?? 0,
      itemCount: itemCounts[row.id] ?? 0,
    }));
  }

  async createSubject(
    orgId: string,
    createdBy: string,
    body: { name: string; icon?: string; color?: string },
  ): Promise<AssessmentSubjectVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_subjects')
      .insert({
        org_id: orgId,
        created_by: createdBy,
        name: body.name,
        icon: body.icon,
        color: body.color,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      icon: data.icon,
      color: data.color,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateSubject(
    id: string,
    orgId: string,
    body: { name?: string; icon?: string; color?: string },
  ): Promise<AssessmentSubjectVM> {
    const supabase = createSupabaseServiceClient();
    const { name, icon, color } = body;
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (icon !== undefined) update.icon = icon;
    if (color !== undefined) update.color = color;
    const { data, error } = await supabase
      .from('assessment_subjects')
      .update(update)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Subject not found');
    return {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      icon: data.icon,
      color: data.color,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteSubject(id: string, orgId: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('assessment_subjects')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);
    if (error) throw new BadRequestException(error.message);
  }

  // ---------------------------------------------------------------------------
  // Subject tree (full subject → domains → skills)
  // ---------------------------------------------------------------------------

  async getSubjectTree(
    subjectId: string,
    orgId: string,
  ): Promise<{ subject: AssessmentSubjectVM; domains: AssessmentDomainVM[] }> {
    const supabase = createSupabaseServiceClient();

    const { data: subject, error: se } = await supabase
      .from('assessment_subjects')
      .select('*')
      .eq('id', subjectId)
      .eq('org_id', orgId)
      .single();

    if (se || !subject) throw new NotFoundException('Subject not found');

    const domains = await this.listDomains(orgId, subjectId);
    for (const d of domains) {
      d.skills = await this.listSkills(orgId, { domainId: d.id });
    }

    return {
      subject: {
        id: subject.id,
        orgId: subject.org_id,
        name: subject.name,
        icon: subject.icon,
        color: subject.color,
        createdAt: subject.created_at,
        updatedAt: subject.updated_at,
      },
      domains,
    };
  }

  // ---------------------------------------------------------------------------
  // Domains
  // ---------------------------------------------------------------------------

  async listDomains(orgId: string, subjectId?: string): Promise<AssessmentDomainVM[]> {
    const supabase = createSupabaseServiceClient();
    let q = supabase
      .from('assessment_domains')
      .select('*, assessment_subjects(name)')
      .eq('org_id', orgId)
      .order('grade')
      .order('order_position');

    if (subjectId) q = q.eq('subject_id', subjectId);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((row) => this.mapDomain(row));
  }

  async createDomain(
    orgId: string,
    body: { subjectId: string; name: string; grade: number; description?: string },
  ): Promise<AssessmentDomainVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_domains')
      .insert({
        org_id: orgId,
        subject_id: body.subjectId,
        name: body.name,
        grade: body.grade,
        description: body.description,
      })
      .select('*, assessment_subjects(name)')
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.mapDomain(data);
  }

  async updateDomain(
    id: string,
    orgId: string,
    body: { name?: string; grade?: number; description?: string; orderPosition?: number },
  ): Promise<AssessmentDomainVM> {
    const supabase = createSupabaseServiceClient();
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.grade !== undefined) update.grade = body.grade;
    if (body.description !== undefined) update.description = body.description;
    if (body.orderPosition !== undefined) update.order_position = body.orderPosition;

    const { data, error } = await supabase
      .from('assessment_domains')
      .update(update)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*, assessment_subjects(name)')
      .single();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Domain not found');
    return this.mapDomain(data);
  }

  async deleteDomain(id: string, orgId: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('assessment_domains')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);
    if (error) throw new BadRequestException(error.message);
  }

  // ---------------------------------------------------------------------------
  // Skills
  // ---------------------------------------------------------------------------

  async listSkills(
    orgId: string,
    filters: {
      domainId?: string;
      subjectId?: string;
      grade?: number;
      standard?: string;
    } = {},
  ): Promise<AssessmentSkillVM[]> {
    const supabase = createSupabaseServiceClient();
    let q = supabase
      .from('assessment_skills')
      .select(
        `
        *,
        assessment_domains!inner(
          name, grade, subject_id,
          assessment_subjects(name)
        )
      `,
      )
      .eq('org_id', orgId)
      .order('order_position');

    if (filters.domainId) q = q.eq('domain_id', filters.domainId);
    if (filters.grade) q = q.eq('assessment_domains.grade', filters.grade);
    if (filters.standard) q = q.ilike('standard', `%${filters.standard}%`);

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);

    const prerequisites = await this.getPrerequisiteMap(orgId);
    const itemCounts = await this.getItemCountsBySkill(orgId);

    return (data ?? []).map((row) =>
      this.mapSkill(row, prerequisites[row.id] ?? [], itemCounts[row.id] ?? 0),
    );
  }

  async getSkill(id: string, orgId: string): Promise<AssessmentSkillVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_skills')
      .select(
        `
        *,
        assessment_domains!inner(
          name, grade, subject_id,
          assessment_subjects(name)
        )
      `,
      )
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !data) throw new NotFoundException('Skill not found');
    const prerequisites = await this.getPrerequisiteMap(orgId);
    const itemCounts = await this.getItemCountsBySkill(orgId);
    return this.mapSkill(data, prerequisites[id] ?? [], itemCounts[id] ?? 0);
  }

  async createSkill(
    orgId: string,
    body: {
      domainId: string;
      name: string;
      description?: string;
      standard?: string;
      difficultyBaseline?: number;
      estimatedTimeSeconds?: number;
    },
  ): Promise<AssessmentSkillVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_skills')
      .insert({
        org_id: orgId,
        domain_id: body.domainId,
        name: body.name,
        description: body.description,
        standard: body.standard,
        difficulty_baseline: body.difficultyBaseline ?? 3,
        estimated_time_seconds: body.estimatedTimeSeconds ?? 90,
      })
      .select(
        `*, assessment_domains!inner(name, grade, subject_id, assessment_subjects(name))`,
      )
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.mapSkill(data, [], 0);
  }

  async updateSkill(
    id: string,
    orgId: string,
    body: {
      name?: string;
      description?: string;
      standard?: string;
      difficultyBaseline?: number;
      estimatedTimeSeconds?: number;
      orderPosition?: number;
      prerequisiteIds?: string[];
    },
  ): Promise<AssessmentSkillVM> {
    const supabase = createSupabaseServiceClient();
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.standard !== undefined) update.standard = body.standard;
    if (body.difficultyBaseline !== undefined)
      update.difficulty_baseline = body.difficultyBaseline;
    if (body.estimatedTimeSeconds !== undefined)
      update.estimated_time_seconds = body.estimatedTimeSeconds;
    if (body.orderPosition !== undefined) update.order_position = body.orderPosition;

    let data: Record<string, unknown> | null = null;
    if (Object.keys(update).length > 0) {
      const { data: updated, error } = await supabase
        .from('assessment_skills')
        .update(update)
        .eq('id', id)
        .eq('org_id', orgId)
        .select(
          `*, assessment_domains!inner(name, grade, subject_id, assessment_subjects(name))`,
        )
        .single();
      if (error || !updated) throw new BadRequestException(error?.message ?? 'Not found');
      data = updated as Record<string, unknown>;
    } else {
      const { data: fetched, error } = await supabase
        .from('assessment_skills')
        .select(
          `*, assessment_domains!inner(name, grade, subject_id, assessment_subjects(name))`,
        )
        .eq('id', id)
        .eq('org_id', orgId)
        .single();
      if (error || !fetched) throw new BadRequestException(error?.message ?? 'Not found');
      data = fetched as Record<string, unknown>;
    }

    if (!data) throw new BadRequestException('Not found');

    if (body.prerequisiteIds !== undefined) {
      await this.setPrerequisites(id, body.prerequisiteIds);
    }

    const prerequisites = await this.getPrerequisiteMap(orgId);
    const itemCounts = await this.getItemCountsBySkill(orgId);
    return this.mapSkill(data, prerequisites[id] ?? [], itemCounts[id] ?? 0);
  }

  async deleteSkill(id: string, orgId: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('assessment_skills')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);
    if (error) throw new BadRequestException(error.message);
  }

  // ---------------------------------------------------------------------------
  // Prerequisites
  // ---------------------------------------------------------------------------

  async setPrerequisites(skillId: string, prerequisiteIds: string[]): Promise<void> {
    const supabase = createSupabaseServiceClient();
    await supabase
      .from('assessment_skill_prerequisites')
      .delete()
      .eq('skill_id', skillId);
    if (prerequisiteIds.length > 0) {
      const rows = prerequisiteIds.map((pid) => ({
        skill_id: skillId,
        prerequisite_skill_id: pid,
      }));
      const { error } = await supabase
        .from('assessment_skill_prerequisites')
        .insert(rows);
      if (error) throw new BadRequestException(error.message);
    }
  }

  async getPrerequisitesForSkill(
    skillId: string,
  ): Promise<{ id: string; name: string }[]> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_skill_prerequisites')
      .select(
        'prerequisite_skill_id, assessment_skills!assessment_skill_prerequisites_prerequisite_skill_id_fkey(id, name)',
      )
      .eq('skill_id', skillId);

    if (error) return [];
    return (data ?? []).map((r) => {
      const s = r.assessment_skills as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
      const skill = Array.isArray(s) ? s[0] : s;
      return { id: skill?.id ?? '', name: skill?.name ?? '' };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getPrerequisiteMap(
    orgId: string,
  ): Promise<Record<string, { id: string; name: string }[]>> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_skill_prerequisites')
      .select(
        `
        skill_id,
        assessment_skills!assessment_skill_prerequisites_prerequisite_skill_id_fkey(id, name)
      `,
      )
      .in('skill_id', await this.getSkillIdsForOrg(orgId));

    const map: Record<string, { id: string; name: string }[]> = {};
    for (const row of data ?? []) {
      if (!map[row.skill_id]) map[row.skill_id] = [];
      if (row.assessment_skills) {
        const s = row.assessment_skills as
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
        const skill = Array.isArray(s) ? s[0] : s;
        if (skill) map[row.skill_id].push({ id: skill.id, name: skill.name });
      }
    }
    return map;
  }

  private async getSkillIdsForOrg(orgId: string): Promise<string[]> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_skills')
      .select('id')
      .eq('org_id', orgId);
    return (data ?? []).map((r) => r.id);
  }

  private async getDomainCountsBySubject(orgId: string): Promise<Record<string, number>> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_domains')
      .select('subject_id')
      .eq('org_id', orgId);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[r.subject_id] = (counts[r.subject_id] ?? 0) + 1;
    return counts;
  }

  private async getSkillCountsBySubject(orgId: string): Promise<Record<string, number>> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_skills')
      .select('org_id, assessment_domains!inner(subject_id)')
      .eq('org_id', orgId);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) {
      const subjectId = (r.assessment_domains as { subject_id?: string } | null)
        ?.subject_id;
      if (subjectId) counts[subjectId] = (counts[subjectId] ?? 0) + 1;
    }
    return counts;
  }

  private async getItemCountsBySubject(orgId: string): Promise<Record<string, number>> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_items')
      .select(`skill_id, assessment_skills!inner(assessment_domains!inner(subject_id))`)
      .eq('org_id', orgId)
      .is('deleted_at', null);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) {
      const subjectId = (
        r.assessment_skills as {
          assessment_domains?: { subject_id?: string } | null;
        } | null
      )?.assessment_domains?.subject_id;
      if (subjectId) counts[subjectId] = (counts[subjectId] ?? 0) + 1;
    }
    return counts;
  }

  private async getItemCountsBySkill(orgId: string): Promise<Record<string, number>> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_items')
      .select('skill_id')
      .eq('org_id', orgId)
      .is('deleted_at', null);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[r.skill_id] = (counts[r.skill_id] ?? 0) + 1;
    return counts;
  }

  private mapDomain(row: Record<string, unknown>): AssessmentDomainVM {
    const subjRaw = row['assessment_subjects'];
    const subject = (Array.isArray(subjRaw) ? subjRaw[0] : subjRaw) as {
      name?: string;
    } | null;
    return {
      id: row['id'] as string,
      orgId: row['org_id'] as string,
      subjectId: row['subject_id'] as string,
      subjectName: subject?.name ?? '',
      name: row['name'] as string,
      grade: row['grade'] as number,
      description: row['description'] as string | null | undefined,
      orderPosition: (row['order_position'] as number | null | undefined) ?? 0,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
      skills: [],
    };
  }

  private mapSkill(
    row: Record<string, unknown>,
    prerequisites: { id: string; name: string }[],
    itemCount: number,
  ): AssessmentSkillVM {
    const domainRaw = row['assessment_domains'];
    const domain = (Array.isArray(domainRaw) ? domainRaw[0] : domainRaw) as {
      name?: string;
      subject_id?: string;
      grade?: number;
      assessment_subjects?: { name?: string } | { name?: string }[] | null;
    } | null;
    const subjRaw = domain?.assessment_subjects;
    const subject = (Array.isArray(subjRaw) ? subjRaw[0] : subjRaw) as {
      name?: string;
    } | null;
    return {
      id: row['id'] as string,
      orgId: row['org_id'] as string,
      domainId: row['domain_id'] as string,
      domainName: domain?.name ?? '',
      subjectId: domain?.subject_id ?? '',
      subjectName: subject?.name ?? '',
      name: row['name'] as string,
      description: row['description'] as string | null | undefined,
      standard: row['standard'] as string | null | undefined,
      grade: domain?.grade ?? 0,
      difficultyBaseline: row['difficulty_baseline'] as number,
      estimatedTimeSeconds: row['estimated_time_seconds'] as number,
      orderPosition: (row['order_position'] as number | null | undefined) ?? 0,
      prerequisites,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
      itemCount,
    };
  }
}
