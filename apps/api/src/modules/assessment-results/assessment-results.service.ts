import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type {
  AssessmentResultVM,
  AssessmentSkillScoreVM,
  AssessmentMasteryLevel,
} from '@iconicedu/shared-types';
import {
  masteryLevelFromPercentage,
  buildFeedbackReport,
  buildParentReport,
  buildTutorReport,
  buildLearningPlan,
} from './report-generators';

type TestJoinRow = {
  mode?: string;
  passing_score_percent?: number | null;
  time_limit_minutes?: number | null;
} | null;
type ItemJoinRow = {
  content?: Record<string, unknown>;
  explanation?: string | null;
  assessment_skills?: SkillJoinRow | SkillJoinRow[];
} | null;
type SkillJoinRow = {
  id?: string;
  name?: string;
  standard?: string | null;
  assessment_domains?: DomainJoinRow | DomainJoinRow[] | null;
} | null;
type DomainJoinRow = {
  id?: string;
  name?: string;
  grade?: number;
  subject_id?: string;
  assessment_subjects?: SubjectJoinRow | SubjectJoinRow[] | null;
} | null;
type SubjectJoinRow = { id?: string; name?: string } | null;

@Injectable()
export class AssessmentResultsService {
  // ---------------------------------------------------------------------------
  // Compute and store result (called after session submit)
  // ---------------------------------------------------------------------------

  async computeResult(sessionId: string): Promise<AssessmentResultVM> {
    const supabase = createSupabaseServiceClient();

    // Load session
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select(
        `
        *,
        assessment_deliveries!inner(
          test_id, org_id,
          assessment_tests(mode, show_results_immediately, show_correct_answers, passing_score_percent, time_limit_minutes)
        )
      `,
      )
      .eq('id', sessionId)
      .single();

    if (!session) throw new NotFoundException('Session not found');

    const deliveryRow = session.assessment_deliveries as {
      assessment_tests?: TestJoinRow;
    } | null;
    const test = deliveryRow?.assessment_tests;
    const passingPercent = test?.passing_score_percent ?? null;

    // Load responses
    const { data: responses } = await supabase
      .from('assessment_responses')
      .select(
        `*, assessment_items!inner(skill_id, difficulty, estimated_time_seconds, explanation, assessment_skills!inner(name, standard, assessment_domains!inner(name, grade, subject_id, assessment_subjects(name))))`,
      )
      .eq('session_id', sessionId);

    const responsesArr = responses ?? [];

    // Group by skill
    const skillGroups = new Map<string, typeof responsesArr>();
    for (const r of responsesArr) {
      const skillId = r.skill_id;
      if (!skillGroups.has(skillId)) skillGroups.set(skillId, []);
      skillGroups.get(skillId)!.push(r);
    }

    const skillScores: AssessmentSkillScoreVM[] = [];
    let totalScore = 0;
    let totalMax = 0;
    let needsManualGrading = false;

    for (const [skillId, skillResponses] of skillGroups.entries()) {
      const first = skillResponses[0];
      const item = first.assessment_items as ItemJoinRow;
      const skill = Array.isArray(item?.assessment_skills)
        ? item?.assessment_skills[0]
        : item?.assessment_skills;
      const domain = Array.isArray(skill?.assessment_domains)
        ? skill?.assessment_domains[0]
        : skill?.assessment_domains;
      const subject = Array.isArray(domain?.assessment_subjects)
        ? domain?.assessment_subjects[0]
        : domain?.assessment_subjects;

      let skillScore = 0;
      let skillMax = 0;
      let correct = 0;
      let difficultySum = 0;

      for (const r of skillResponses) {
        const effectiveScore = r.manual_score ?? r.auto_score;
        if (effectiveScore === null) needsManualGrading = true;
        skillScore += effectiveScore ?? 0;
        skillMax += r.max_score ?? 1;
        if (r.is_correct) correct++;
        difficultySum += r.difficulty ?? 3;
      }

      const pct = skillMax > 0 ? (skillScore / skillMax) * 100 : 0;
      const masteryLevel = masteryLevelFromPercentage(pct);
      const difficultyAvg =
        skillResponses.length > 0 ? difficultySum / skillResponses.length : 3;

      totalScore += skillScore;
      totalMax += skillMax;

      const scoreRow: AssessmentSkillScoreVM = {
        id: '',
        sessionId,
        deliveryId: session.delivery_id,
        profileId: session.profile_id,
        skillId,
        subject: subject?.name ?? '',
        domain: domain?.name ?? '',
        skillName: skill?.name ?? '',
        standard: skill?.standard,
        grade: domain?.grade ?? 0,
        difficultyAvg,
        score: skillScore,
        maxScore: skillMax,
        percentage: pct,
        itemsTotal: skillResponses.length,
        itemsCorrect: correct,
        masteryLevel,
      };

      // Write to assessment_skill_scores
      const { data: inserted } = await supabase
        .from('assessment_skill_scores')
        .upsert(
          {
            session_id: sessionId,
            delivery_id: session.delivery_id,
            profile_id: session.profile_id,
            skill_id: skillId,
            subject: scoreRow.subject,
            domain: scoreRow.domain,
            skill_name: scoreRow.skillName,
            standard: scoreRow.standard,
            grade: scoreRow.grade,
            difficulty_avg: difficultyAvg,
            score: skillScore,
            max_score: skillMax,
            percentage: pct,
            items_total: skillResponses.length,
            items_correct: correct,
            mastery_level: masteryLevel,
          },
          { onConflict: 'session_id,skill_id' },
        )
        .select('id')
        .single();

      if (inserted) scoreRow.id = inserted.id;
      skillScores.push(scoreRow);

      // Update skill mastery for authenticated users
      if (session.profile_id) {
        await supabase.from('assessment_skill_mastery').upsert(
          {
            profile_id: session.profile_id,
            skill_id: skillId,
            org_id: session.delivery_id,
            level: masteryLevel,
            best_percentage: pct,
            attempts: 1,
            last_assessed_at: new Date().toISOString(),
          },
          {
            onConflict: 'profile_id,skill_id',
            ignoreDuplicates: false,
          },
        );
        // Increment attempts and update best
        await supabase
          .rpc('upsert_skill_mastery', {
            p_profile_id: session.profile_id,
            p_skill_id: skillId,
            p_org_id: session.assessment_deliveries.org_id,
            p_percentage: pct,
            p_level: masteryLevel,
          })
          .then(
            () => null,
            () => null,
          );
      }
    }

    const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    const passed = passingPercent !== null ? percentage >= passingPercent : null;

    // Build reports
    const profileName = session.anon_name ?? 'Student';
    const completedAt = new Date().toISOString();
    const timeSpent = session.time_spent_seconds ?? 0;
    const estimatedTime = skillScores.reduce((sum) => sum + 90, 0);

    const missedItems = responsesArr
      .filter((r) => !r.is_correct && r.is_correct !== null)
      .map((r) => {
        const item = r.assessment_items as ItemJoinRow;
        const skill = Array.isArray(item?.assessment_skills)
          ? item?.assessment_skills[0]
          : item?.assessment_skills;
        return {
          itemId: r.item_id,
          stem: (item?.content as { stem?: string } | undefined)?.stem ?? '',
          explanation: item?.explanation,
          standard: skill?.standard,
        };
      });

    const feedbackReport = buildFeedbackReport(
      skillScores,
      missedItems,
      timeSpent,
      estimatedTime,
      percentage,
      passed,
    );
    const parentReport = buildParentReport(
      profileName,
      'Assessment',
      completedAt,
      percentage,
      passed,
      skillScores,
    );
    const tutorReport = buildTutorReport(
      sessionId,
      (test?.mode ?? 'standard') as 'standard' | 'adaptive',
      totalScore,
      totalMax,
      percentage,
      timeSpent,
      estimatedTime,
      skillScores,
    );

    const prereqMap = await this.getPrerequisiteMap(skillScores.map((s) => s.skillId));
    const skillNameMap = Object.fromEntries(
      skillScores.map((s) => [s.skillId, s.skillName]),
    );
    const learningPlan = buildLearningPlan(
      profileName,
      completedAt,
      skillScores,
      prereqMap,
      skillNameMap,
    );

    const resultPayload = {
      session_id: sessionId,
      delivery_id: session.delivery_id,
      profile_id: session.profile_id,
      total_score: totalScore,
      max_score: totalMax,
      percentage,
      passed,
      needs_manual_grading: needsManualGrading,
      feedback_report: feedbackReport,
      parent_report: parentReport,
      tutor_report: tutorReport,
      learning_plan: learningPlan,
      completed_at: completedAt,
    };

    const { data: result, error } = await supabase
      .from('assessment_results')
      .upsert(resultPayload, { onConflict: 'session_id' })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return {
      id: result.id,
      sessionId,
      deliveryId: session.delivery_id,
      profileId: session.profile_id,
      totalScore,
      maxScore: totalMax,
      percentage,
      passed,
      needsManualGrading,
      completedAt,
      createdAt: result.created_at,
      skillScores,
      feedbackReport,
      parentReport,
      tutorReport,
      learningPlan,
    };
  }

  // ---------------------------------------------------------------------------
  // Get result by session
  // ---------------------------------------------------------------------------

  async getResult(sessionId: string): Promise<AssessmentResultVM> {
    const supabase = createSupabaseServiceClient();
    const { data: result } = await supabase
      .from('assessment_results')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (!result) {
      return this.computeResult(sessionId);
    }

    const { data: skillScores } = await supabase
      .from('assessment_skill_scores')
      .select('*')
      .eq('session_id', sessionId)
      .order('percentage', { ascending: false });

    return {
      id: result.id,
      sessionId: result.session_id,
      deliveryId: result.delivery_id,
      profileId: result.profile_id,
      totalScore: result.total_score,
      maxScore: result.max_score,
      percentage: result.percentage,
      passed: result.passed,
      needsManualGrading: result.needs_manual_grading,
      completedAt: result.completed_at,
      createdAt: result.created_at,
      skillScores: (skillScores ?? []).map(this.mapSkillScore),
      feedbackReport: result.feedback_report,
      parentReport: result.parent_report,
      tutorReport: result.tutor_report,
      learningPlan: result.learning_plan,
    };
  }

  async getReport(sessionId: string, type: 'parent' | 'tutor' | 'learning-plan') {
    const result = await this.getResult(sessionId);
    if (type === 'parent') return result.parentReport;
    if (type === 'tutor') return result.tutorReport;
    return result.learningPlan;
  }

  // ---------------------------------------------------------------------------
  // Manual grading (essay)
  // ---------------------------------------------------------------------------

  async gradeItem(sessionId: string, itemId: string, score: number): Promise<void> {
    const supabase = createSupabaseServiceClient();
    await supabase
      .from('assessment_responses')
      .update({
        manual_score: score,
        grader_id: null,
        graded_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .eq('item_id', itemId);

    // Re-compute result
    await this.computeResult(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getPrerequisiteMap(
    skillIds: string[],
  ): Promise<Record<string, string[]>> {
    const supabase = createSupabaseServiceClient();
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

  private mapSkillScore(row: Record<string, unknown>): AssessmentSkillScoreVM {
    return {
      id: row['id'] as string,
      sessionId: row['session_id'] as string,
      deliveryId: row['delivery_id'] as string,
      profileId: row['profile_id'] as string | null,
      skillId: row['skill_id'] as string,
      subject: row['subject'] as string,
      domain: row['domain'] as string,
      skillName: row['skill_name'] as string,
      standard: row['standard'] as string | null | undefined,
      grade: row['grade'] as number,
      difficultyAvg: row['difficulty_avg'] as number,
      score: row['score'] as number,
      maxScore: row['max_score'] as number,
      percentage: row['percentage'] as number,
      itemsTotal: row['items_total'] as number,
      itemsCorrect: row['items_correct'] as number,
      masteryLevel: row['mastery_level'] as AssessmentMasteryLevel,
    };
  }
}
