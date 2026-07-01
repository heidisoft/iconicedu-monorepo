import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type {
  AssessmentDeliveryVM,
  AssessmentDeliveryListVM,
  AssessmentAccessType,
} from '@iconicedu/shared-types';

@Injectable()
export class AssessmentDeliveriesService {
  async listDeliveries(
    orgId: string,
    filters?: { search?: string; accessType?: string; page?: number; limit?: number },
  ): Promise<{ deliveries: AssessmentDeliveryListVM[]; total: number }> {
    const supabase = createSupabaseServiceClient();
    const page = Math.max(1, filters?.page ?? 1);
    const limit = filters?.limit ?? 20;
    const from = (page - 1) * limit;

    let q = supabase
      .from('assessment_deliveries')
      .select('*, assessment_tests(title)', { count: 'exact' })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (filters?.search) q = q.ilike('title', `%${filters.search}%`);
    if (filters?.accessType) q = q.eq('access_type', filters.accessType);

    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);

    return {
      total: count ?? 0,
      deliveries: (data ?? []).map((row) => ({
        id: row.id,
        orgId: row.org_id,
        testId: row.test_id,
        testTitle: (row.assessment_tests as { title?: string } | null)?.title ?? '',
        title: row.title,
        accessType: row.access_type,
        accessToken: row.access_token,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        sessionCount: 0,
        completedCount: 0,
        createdAt: row.created_at,
      })),
    };
  }

  async getDelivery(id: string, orgId: string): Promise<AssessmentDeliveryVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_deliveries')
      .select('*, assessment_tests(title, mode, time_limit_minutes)')
      .eq('id', id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Delivery not found');

    const test = data.assessment_tests as {
      title?: string;
      mode?: string;
      time_limit_minutes?: number | null;
    } | null;
    return this.mapDelivery(data, test);
  }

  async getDeliveryByToken(token: string): Promise<AssessmentDeliveryVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_deliveries')
      .select('*, assessment_tests(title, mode, time_limit_minutes)')
      .eq('access_token', token)
      .eq('access_type', 'public')
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Delivery not found');
    const test = data.assessment_tests as {
      title?: string;
      mode?: string;
      time_limit_minutes?: number | null;
    } | null;
    return this.mapDelivery(data, test);
  }

  async createDelivery(
    orgId: string,
    createdBy: string,
    body: {
      testId: string;
      title: string;
      accessType?: string;
      channelId?: string;
      startsAt?: string;
      endsAt?: string;
      maxAttempts?: number;
      collectNameEmail?: boolean;
      allowResume?: boolean;
    },
  ): Promise<AssessmentDeliveryVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_deliveries')
      .insert({
        org_id: orgId,
        created_by: createdBy,
        test_id: body.testId,
        title: body.title,
        access_type: body.accessType ?? 'authenticated',
        channel_id: body.channelId,
        starts_at: body.startsAt,
        ends_at: body.endsAt,
        max_attempts: body.maxAttempts ?? 1,
        collect_name_email: body.collectNameEmail ?? false,
        allow_resume: body.allowResume ?? true,
      })
      .select('*, assessment_tests(title, mode, time_limit_minutes)')
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.mapDelivery(
      data,
      data.assessment_tests as {
        title?: string;
        mode?: string;
        time_limit_minutes?: number | null;
      } | null,
    );
  }

  async updateDelivery(
    id: string,
    orgId: string,
    body: Record<string, unknown>,
  ): Promise<AssessmentDeliveryVM> {
    const supabase = createSupabaseServiceClient();
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.accessType !== undefined) update.access_type = body.accessType;
    if (body.channelId !== undefined) update.channel_id = body.channelId;
    if (body.startsAt !== undefined) update.starts_at = body.startsAt;
    if (body.endsAt !== undefined) update.ends_at = body.endsAt;
    if (body.maxAttempts !== undefined) update.max_attempts = body.maxAttempts;
    if (body.collectNameEmail !== undefined)
      update.collect_name_email = body.collectNameEmail;
    if (body.allowResume !== undefined) update.allow_resume = body.allowResume;

    const { data, error } = await supabase
      .from('assessment_deliveries')
      .update(update)
      .eq('id', id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .select('*, assessment_tests(title, mode, time_limit_minutes)')
      .single();

    if (error || !data) throw new NotFoundException('Delivery not found');
    return this.mapDelivery(
      data,
      data.assessment_tests as {
        title?: string;
        mode?: string;
        time_limit_minutes?: number | null;
      } | null,
    );
  }

  async deleteDelivery(id: string, orgId: string): Promise<void> {
    const supabase = createSupabaseServiceClient();
    await supabase
      .from('assessment_deliveries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);
  }

  async generateToken(
    id: string,
    orgId: string,
  ): Promise<{ accessToken: string; publicUrl: string }> {
    const supabase = createSupabaseServiceClient();
    const token = randomBytes(6).toString('base64url');
    const { error } = await supabase
      .from('assessment_deliveries')
      .update({ access_token: token, access_type: 'public' })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) throw new BadRequestException(error.message);
    return { accessToken: token, publicUrl: `/a/${token}` };
  }

  async addParticipants(
    deliveryId: string,
    orgId: string,
    profileIds: string[],
  ): Promise<void> {
    if (!profileIds.length) return;
    const supabase = createSupabaseServiceClient();
    const uniqueProfileIds = Array.from(new Set(profileIds));
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .in('id', uniqueProfileIds);

    if (profilesError) throw new BadRequestException(profilesError.message);

    const allowedIds = new Set((profiles ?? []).map((profile) => profile.id as string));
    const hasExternalProfile = uniqueProfileIds.some((id) => !allowedIds.has(id));
    if (hasExternalProfile) {
      throw new ForbiddenException('Assessment participants must belong to this org');
    }

    const rows = profileIds.map((pid) => ({ delivery_id: deliveryId, profile_id: pid }));
    const { error } = await supabase
      .from('assessment_delivery_participants')
      .upsert(rows, { onConflict: 'delivery_id,profile_id' });
    if (error) throw new BadRequestException(error.message);
  }

  async getDeliveryResults(deliveryId: string, orgId: string) {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_results')
      .select(
        `
        id, session_id, profile_id, total_score, max_score, percentage, passed, needs_manual_grading, completed_at,
        assessment_deliveries!inner(org_id),
        assessment_sessions!inner(status, anon_name, anon_email, submitted_at, time_spent_seconds)
      `,
      )
      .eq('delivery_id', deliveryId)
      .eq('assessment_deliveries.org_id', orgId)
      .order('completed_at', { ascending: false });
    return data ?? [];
  }

  async getDeliverySkillBreakdown(deliveryId: string, orgId: string) {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_skill_scores')
      .select('*, assessment_deliveries!inner(org_id)')
      .eq('delivery_id', deliveryId)
      .eq('assessment_deliveries.org_id', orgId);

    const map = new Map<
      string,
      {
        skillName: string;
        domain: string;
        subject: string;
        grade: number;
        standard?: string;
        percentages: number[];
        masteryLevels: string[];
      }
    >();
    for (const row of data ?? []) {
      if (!map.has(row.skill_id)) {
        map.set(row.skill_id, {
          skillName: row.skill_name,
          domain: row.domain,
          subject: row.subject,
          grade: row.grade,
          standard: row.standard,
          percentages: [],
          masteryLevels: [],
        });
      }
      const entry = map.get(row.skill_id)!;
      entry.percentages.push(row.percentage);
      entry.masteryLevels.push(row.mastery_level);
    }

    return Array.from(map.entries()).map(([skillId, v]) => ({
      skillId,
      skillName: v.skillName,
      domain: v.domain,
      subject: v.subject,
      grade: v.grade,
      standard: v.standard,
      avgPercentage:
        v.percentages.reduce((s, p) => s + p, 0) / (v.percentages.length || 1),
      sessionCount: v.percentages.length,
      masteryDistribution: this.computeMasteryDistribution(v.masteryLevels),
    }));
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private computeMasteryDistribution(levels: string[]) {
    const dist: Record<string, number> = {
      not_started: 0,
      emerging: 0,
      developing: 0,
      approaching: 0,
      proficient: 0,
      mastered: 0,
    };
    for (const l of levels) dist[l] = (dist[l] ?? 0) + 1;
    return dist;
  }

  private mapDelivery(
    row: Record<string, unknown>,
    test: { title?: string; mode?: string; time_limit_minutes?: number | null } | null,
  ): AssessmentDeliveryVM {
    return {
      id: row['id'] as string,
      orgId: row['org_id'] as string,
      testId: row['test_id'] as string,
      testTitle: test?.title ?? '',
      testMode: (test?.mode ?? 'standard') as 'standard' | 'adaptive',
      title: row['title'] as string,
      accessType: row['access_type'] as AssessmentAccessType,
      accessToken: row['access_token'] as string | null | undefined,
      publicUrl: row['access_token'] ? `/a/${row['access_token']}` : undefined,
      channelId: row['channel_id'] as string | null | undefined,
      startsAt: row['starts_at'] as string | null | undefined,
      endsAt: row['ends_at'] as string | null | undefined,
      maxAttempts: row['max_attempts'] as number,
      collectNameEmail: row['collect_name_email'] as boolean,
      allowResume: row['allow_resume'] as boolean,
      createdBy: row['created_by'] as string | null | undefined,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    };
  }
}
