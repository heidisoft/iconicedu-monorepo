import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type {
  AssessmentSessionVM,
  AssessmentSessionListVM,
  AssessmentNextItemVM,
  AssessmentItemVM,
  AdaptiveState,
  AdaptiveConfig,
} from '@iconicedu/shared-types';
import { DEFAULT_ADAPTIVE_CONFIG } from '@iconicedu/shared-types';
import { AssessmentItemsService } from '@iconicedu/api/modules/assessment-items/assessment-items.service';
import { AssessmentTestsService } from '@iconicedu/api/modules/assessment-tests/assessment-tests.service';
import { AssessmentResultsService } from '@iconicedu/api/modules/assessment-results/assessment-results.service';
import { runAdaptiveEngine, buildInitialAdaptiveState } from './adaptive-engine';
import { scoreItem } from './score-item';

type TestJoinRow = {
  mode: string;
  org_id?: string;
  adaptive_config?: unknown;
  passing_score_percent?: number | null;
  time_limit_minutes?: number | null;
} | null;
type ResultJoinRow =
  | { percentage?: number | null; passed?: boolean | null }
  | { percentage?: number | null; passed?: boolean | null }[]
  | null;

@Injectable()
export class AssessmentSessionsService {
  constructor(
    private readonly itemsService: AssessmentItemsService,
    private readonly testsService: AssessmentTestsService,
    private readonly resultsService: AssessmentResultsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Start session
  // ---------------------------------------------------------------------------

  async startSession(body: {
    deliveryId: string;
    profileId?: string;
    anonName?: string;
    anonEmail?: string;
  }): Promise<AssessmentSessionVM> {
    const supabase = createSupabaseServiceClient();

    // Load delivery + test
    const { data: delivery } = await supabase
      .from('assessment_deliveries')
      .select('*, assessment_tests(*)')
      .eq('id', body.deliveryId)
      .is('deleted_at', null)
      .single();

    if (!delivery) throw new NotFoundException('Delivery not found');

    // Check if already in progress for authenticated users
    if (body.profileId) {
      const { data: existing } = await supabase
        .from('assessment_sessions')
        .select('id, status')
        .eq('delivery_id', body.deliveryId)
        .eq('profile_id', body.profileId)
        .eq('status', 'in_progress')
        .maybeSingle();
      if (existing) {
        return this.getSession(existing.id);
      }
    }

    const test = delivery.assessment_tests as TestJoinRow;
    const isAdaptive = test?.mode === 'adaptive';

    // For adaptive tests, build initial AdaptiveState from skill pools
    let adaptiveState: AdaptiveState | null = null;
    let firstItem: AssessmentItemVM | null = null;
    let itemOrder: string[] = [];

    if (isAdaptive) {
      const pools = await this.testsService.getSkillPoolsForTest(delivery.test_id);
      if (!pools.length)
        throw new BadRequestException('Adaptive test has no skill pools defined');

      adaptiveState = buildInitialAdaptiveState(
        pools.map((p) => ({ skillId: p.skillId, startDifficulty: p.startDifficulty })),
      );

      // Pick first item
      const firstSkill = pools[0];
      firstItem = await this.itemsService.pickItemForSkillAndDifficulty(
        firstSkill.skillId,
        firstSkill.startDifficulty,
        [],
      );
      if (firstItem) {
        itemOrder = [firstItem.id];
        adaptiveState.skills[firstSkill.skillId].itemsServed.push(firstItem.id);
        adaptiveState.skills[firstSkill.skillId].status = 'active';
        adaptiveState.activeSkillId = firstSkill.skillId;
      }
    } else {
      // Static: load all items in order
      const staticItems = await this.testsService.getStaticItemIds(delivery.test_id);
      itemOrder = staticItems.map((s) => s.itemId);
      if (itemOrder.length > 0) {
        const itemRow = await this.itemsService.getItem(
          itemOrder[0],
          delivery.org_id as string,
        );
        firstItem = itemRow;
      }
    }

    const { data: session, error } = await supabase
      .from('assessment_sessions')
      .insert({
        delivery_id: body.deliveryId,
        profile_id: body.profileId ?? null,
        anon_name: body.anonName ?? null,
        anon_email: body.anonEmail ?? null,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        current_item_id: firstItem?.id ?? null,
        item_order: itemOrder,
        adaptive_state: adaptiveState,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return {
      id: session.id,
      deliveryId: session.delivery_id,
      profileId: session.profile_id,
      anonName: session.anon_name,
      anonEmail: session.anon_email,
      status: 'in_progress',
      attemptNumber: session.attempt_number,
      currentItemId: firstItem?.id ?? null,
      currentItem: firstItem,
      itemOrder,
      adaptiveState,
      startedAt: session.started_at,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      totalItems: isAdaptive ? null! : itemOrder.length,
      answeredItems: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Get session (with resume support)
  // ---------------------------------------------------------------------------

  async getSession(sessionId: string): Promise<AssessmentSessionVM> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) throw new NotFoundException('Session not found');

    const responses = await this.getResponses(sessionId);

    // Determine current item: in static tests it's next unanswered; in adaptive it's stored
    const answeredIds = new Set(responses.map((r) => r.item_id));
    let currentItem: AssessmentItemVM | null = null;

    if (data.current_item_id) {
      const { data: delivery } = await supabase
        .from('assessment_deliveries')
        .select('org_id')
        .eq('id', data.delivery_id)
        .single();
      if (delivery?.org_id) {
        currentItem = await this.itemsService
          .getItem(data.current_item_id, delivery.org_id as string)
          .catch(() => null);
      }
    }

    return {
      id: data.id,
      deliveryId: data.delivery_id,
      profileId: data.profile_id,
      anonName: data.anon_name,
      anonEmail: data.anon_email,
      status: data.status,
      attemptNumber: data.attempt_number,
      currentItemId: data.current_item_id,
      currentItem,
      itemOrder: data.item_order ?? [],
      adaptiveState: data.adaptive_state,
      startedAt: data.started_at,
      submittedAt: data.submitted_at,
      timeSpentSeconds: data.time_spent_seconds,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      totalItems: (data.item_order as string[])?.length ?? null!,
      answeredItems: answeredIds.size,
      flaggedItems: responses.filter((r) => r.is_flagged).length,
    };
  }

  // ---------------------------------------------------------------------------
  // Save response + return next item
  // ---------------------------------------------------------------------------

  async saveResponse(
    sessionId: string,
    body: {
      itemId: string;
      responseData: unknown;
      isFlagged?: boolean;
      timeSpentSeconds?: number;
    },
  ): Promise<AssessmentNextItemVM> {
    const supabase = createSupabaseServiceClient();

    const { data: session } = await supabase
      .from('assessment_sessions')
      .select(
        '*, assessment_deliveries!inner(org_id, test_id, assessment_tests(mode, adaptive_config))',
      )
      .eq('id', sessionId)
      .single();

    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'completed')
      throw new ForbiddenException('Session already submitted');

    const deliveryRow = session.assessment_deliveries as {
      org_id?: string;
      test_id?: string;
      assessment_tests?: TestJoinRow;
    } | null;
    const test = deliveryRow?.assessment_tests;
    const isAdaptive = test?.mode === 'adaptive';
    const orgId = deliveryRow?.org_id as string | undefined;

    // Load the item to score
    const item = await this.itemsService.getItem(body.itemId, orgId ?? '');
    const { isCorrect, autoScore, maxScore } = scoreItem(item, body.responseData);

    // Upsert response
    await supabase.from('assessment_responses').upsert(
      {
        session_id: sessionId,
        item_id: body.itemId,
        skill_id: item.skillId,
        difficulty: item.difficulty,
        response_data: body.responseData as Record<string, unknown>,
        is_correct: isCorrect,
        is_flagged: body.isFlagged ?? false,
        auto_score: autoScore,
        max_score: maxScore,
        time_spent_seconds: body.timeSpentSeconds,
      },
      { onConflict: 'session_id,item_id' },
    );

    // Determine next item
    let nextItem: AssessmentItemVM | null = null;
    let note: string | null = null;
    let updatedAdaptiveState = session.adaptive_state as AdaptiveState | null;

    if (isAdaptive && updatedAdaptiveState) {
      const config: AdaptiveConfig = {
        ...DEFAULT_ADAPTIVE_CONFIG,
        ...(test.adaptive_config ?? {}),
      };
      const prereqMap = await this.getSkillPrerequisiteMap(
        session.assessment_deliveries.test_id,
      );

      const result = await runAdaptiveEngine(
        updatedAdaptiveState,
        config,
        body.itemId,
        isCorrect ?? false,
        this.itemsService,
        prereqMap,
      );

      nextItem = result.nextItem;
      updatedAdaptiveState = result.updatedState;
      note = result.note;

      // Update session with new adaptive state and current_item_id
      const newItemOrder = [...((session.item_order as string[]) ?? [])];
      if (nextItem && !newItemOrder.includes(nextItem.id)) newItemOrder.push(nextItem.id);

      await supabase
        .from('assessment_sessions')
        .update({
          current_item_id: nextItem?.id ?? null,
          item_order: newItemOrder,
          adaptive_state: updatedAdaptiveState,
        })
        .eq('id', sessionId);
    } else {
      // Static test: find next unanswered item in order
      const answeredIds = await this.getAnsweredItemIds(sessionId);
      answeredIds.add(body.itemId);
      const itemOrder = (session.item_order as string[]) ?? [];
      const nextItemId = itemOrder.find((id) => !answeredIds.has(id));

      if (nextItemId) {
        nextItem = await this.itemsService
          .getItem(nextItemId, orgId ?? '')
          .catch(() => null);
        await supabase
          .from('assessment_sessions')
          .update({ current_item_id: nextItemId })
          .eq('id', sessionId);
      }
    }

    const answeredCount = (await this.getAnsweredItemIds(sessionId)).size;
    const itemOrder = (session.item_order as string[]) ?? [];

    return {
      nextItem,
      isComplete: nextItem === null,
      sessionStatus: nextItem === null ? 'completed' : 'in_progress',
      adaptiveNote: note,
      itemsAnswered: answeredCount,
      itemsTotal: isAdaptive ? null : itemOrder.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Submit session
  // ---------------------------------------------------------------------------

  async submitSession(
    sessionId: string,
  ): Promise<{ sessionId: string; resultId: string }> {
    const supabase = createSupabaseServiceClient();
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'completed') {
      // Already submitted — just return the existing result
      const { data: existing } = await supabase
        .from('assessment_results')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();
      return { sessionId, resultId: existing?.id ?? sessionId };
    }

    await supabase
      .from('assessment_sessions')
      .update({
        status: 'completed',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // Score the session and generate all reports
    const result = await this.resultsService.computeResult(sessionId);
    return { sessionId, resultId: result.id };
  }

  async getMySessions(profileId: string): Promise<AssessmentSessionListVM[]> {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_sessions')
      .select('*, assessment_results(percentage, passed)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    return (data ?? []).map((row) => ({
      id: row.id,
      deliveryId: row.delivery_id,
      profileId: row.profile_id,
      status: row.status,
      attemptNumber: row.attempt_number,
      submittedAt: row.submitted_at,
      timeSpentSeconds: row.time_spent_seconds,
      createdAt: row.created_at,
      percentage:
        (Array.isArray(row.assessment_results)
          ? row.assessment_results[0]
          : (row.assessment_results as ResultJoinRow)
        )?.percentage ?? null,
      passed:
        (Array.isArray(row.assessment_results)
          ? row.assessment_results[0]
          : (row.assessment_results as ResultJoinRow)
        )?.passed ?? null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getResponses(sessionId: string) {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from('assessment_responses')
      .select('*')
      .eq('session_id', sessionId);
    return data ?? [];
  }

  private async getAnsweredItemIds(sessionId: string): Promise<Set<string>> {
    const responses = await this.getResponses(sessionId);
    return new Set(responses.map((r) => r.item_id));
  }

  private async getSkillPrerequisiteMap(
    testId: string,
  ): Promise<Record<string, string[]>> {
    const supabase = createSupabaseServiceClient();
    const pools = await supabase
      .from('assessment_test_skill_pools')
      .select('skill_id')
      .eq('test_id', testId);
    const skillIds = (pools.data ?? []).map((r) => r.skill_id);

    const { data } = await supabase
      .from('assessment_skill_prerequisites')
      .select('skill_id, prerequisite_skill_id')
      .in('skill_id', skillIds);

    const map: Record<string, string[]> = {};
    for (const r of data ?? []) {
      if (!map[r.skill_id]) map[r.skill_id] = [];
      map[r.skill_id].push(r.prerequisite_skill_id);
    }
    return map;
  }
}
