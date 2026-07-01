import type {
  AssessmentSkillScoreVM,
  AssessmentMasteryLevel,
  ParentReport,
  TutorReport,
  StudentLearningPlan,
  FeedbackReport,
} from '@iconicedu/shared-types';

// ---------------------------------------------------------------------------
// Mastery level helpers
// ---------------------------------------------------------------------------

export function masteryLevelFromPercentage(pct: number): AssessmentMasteryLevel {
  if (pct >= 90) return 'mastered';
  if (pct >= 80) return 'proficient';
  if (pct >= 70) return 'approaching';
  if (pct >= 50) return 'developing';
  return 'emerging';
}

export function masteryLevelLabel(level: AssessmentMasteryLevel): string {
  const labels: Record<AssessmentMasteryLevel, string> = {
    not_started: 'Not started',
    emerging: 'Just getting started',
    developing: 'Making progress',
    approaching: 'Almost there',
    proficient: 'Good understanding',
    mastered: 'Mastered',
  };
  return labels[level];
}

// ---------------------------------------------------------------------------
// Feedback report (student-facing, post-exam)
// ---------------------------------------------------------------------------

export function buildFeedbackReport(
  skillScores: AssessmentSkillScoreVM[],
  missedItems: {
    itemId: string;
    stem: string;
    explanation?: string | null;
    standard?: string | null;
  }[],
  timeSpentSeconds: number,
  estimatedTimeSeconds: number,
  percentage: number,
  passed: boolean | null,
): FeedbackReport {
  const strengthAreas = skillScores
    .filter((s) => s.percentage >= 80)
    .map((s) => ({
      skillId: s.skillId,
      skillName: s.skillName,
      domain: s.domain,
      subject: s.subject,
      grade: s.grade,
      standard: s.standard,
      difficultyAvg: s.difficultyAvg,
      score: s.score,
      maxScore: s.maxScore,
      percentage: s.percentage,
      masteryLevel: s.masteryLevel,
      explanations: [],
      prerequisiteSkills: [],
    }));

  const improvementAreas = skillScores
    .filter((s) => s.percentage < 80)
    .sort((a, b) => b.maxScore - b.score - (a.maxScore - a.score))
    .map((s) => ({
      skillId: s.skillId,
      skillName: s.skillName,
      domain: s.domain,
      subject: s.subject,
      grade: s.grade,
      standard: s.standard,
      difficultyAvg: s.difficultyAvg,
      score: s.score,
      maxScore: s.maxScore,
      percentage: s.percentage,
      masteryLevel: s.masteryLevel,
      explanations: missedItems
        .filter((m) => m.standard === s.standard)
        .map((m) => m.explanation)
        .filter(Boolean) as string[],
      prerequisiteSkills: [],
    }));

  return {
    overallPercent: percentage,
    passed,
    estimatedTimeSpent: timeSpentSeconds,
    estimatedTimeExpected: estimatedTimeSeconds,
    strengthAreas,
    improvementAreas,
    missedExplanations: missedItems,
  };
}

// ---------------------------------------------------------------------------
// Parent report
// ---------------------------------------------------------------------------

export function buildParentReport(
  studentName: string,
  testTitle: string,
  completedAt: string,
  percentage: number,
  passed: boolean | null,
  skillScores: AssessmentSkillScoreVM[],
): ParentReport {
  const sorted = [...skillScores].sort((a, b) => b.percentage - a.percentage);
  const top = sorted.slice(0, 2);
  const worst = sorted[sorted.length - 1];

  const name = studentName || 'Your child';
  const overallMessage =
    percentage >= 80
      ? `Great work! ${name} showed strong understanding in most areas.`
      : percentage >= 60
        ? `Good effort! ${name} is making solid progress. There are a few areas to continue working on.`
        : `${name} gave it their best effort! This test highlighted some areas where extra practice will really help.`;

  const highlights = [
    ...top
      .filter((s) => s.percentage >= 70)
      .map((s) => ({
        type: 'strength' as const,
        subject: s.subject,
        skill: s.skillName,
        message: `${name} did really well with "${s.skillName}" — scoring ${Math.round(s.percentage)}%.`,
      })),
    ...(worst && worst.percentage < 70
      ? [
          {
            type: 'growth_area' as const,
            subject: worst.subject,
            skill: worst.skillName,
            message: `${name} could use a bit more practice with "${worst.skillName}". Working on this regularly will help build confidence.`,
          },
        ]
      : []),
  ].slice(0, 3);

  const encouragement =
    percentage >= 80
      ? `Keep up the fantastic effort!`
      : `Every practice session builds understanding. Celebrate this effort!`;

  const suggestedHomeActivities = worst
    ? [
        `Practice ${worst.skillName.toLowerCase()} with everyday examples`,
        `Try online games or worksheets focused on ${worst.domain}`,
        `Ask their teacher for recommended activities at home`,
      ]
    : [`Keep reviewing strong areas to maintain mastery`];

  return {
    studentName: name,
    testTitle,
    completedAt,
    overallPercentage: percentage,
    passed,
    overallMessage,
    highlights,
    encouragement,
    suggestedHomeActivities,
  };
}

// ---------------------------------------------------------------------------
// Tutor report
// ---------------------------------------------------------------------------

export function buildTutorReport(
  sessionId: string,
  testMode: 'standard' | 'adaptive',
  totalScore: number,
  maxScore: number,
  percentage: number,
  timeSpentSeconds: number,
  estimatedTimeSeconds: number,
  skillScores: AssessmentSkillScoreVM[],
  adaptivePath?: {
    itemsServed: number;
    skillsResolved: string[];
    difficultyProgression: {
      skillId: string;
      skillName: string;
      difficulties: number[];
    }[];
  } | null,
): TutorReport {
  const prereqGaps: TutorReport['prerequisiteGapSummary'] = [];

  const skillBreakdown = skillScores.map((s) => ({
    skillId: s.skillId,
    skillName: s.skillName,
    domain: s.domain,
    standard: s.standard,
    grade: s.grade,
    difficultyAvg: s.difficultyAvg,
    score: s.score,
    maxScore: s.maxScore,
    percentage: s.percentage,
    masteryLevel: s.masteryLevel,
    itemsCorrect: s.itemsCorrect,
    itemsTotal: s.itemsTotal,
    prerequisiteGapsDetected: [],
    recommendedAction: recommendedActionForLevel(s.masteryLevel, s.skillName),
  }));

  const nextLessonSuggestions = skillScores
    .filter((s) => s.percentage < 70)
    .sort((a, b) => b.maxScore - b.score - (a.maxScore - a.score))
    .slice(0, 3)
    .map(
      (s) =>
        `Focus on ${s.skillName} (${s.domain}) — currently at ${Math.round(s.percentage)}%`,
    );

  return {
    sessionId,
    testMode,
    totalScore,
    maxScore,
    percentage,
    timeSpentMinutes: Math.round(timeSpentSeconds / 60),
    estimatedTimeMinutes: Math.round(estimatedTimeSeconds / 60),
    skillBreakdown,
    prerequisiteGapSummary: prereqGaps,
    adaptivePath,
    nextLessonSuggestions,
  };
}

function recommendedActionForLevel(level: AssessmentMasteryLevel, skill: string): string {
  switch (level) {
    case 'mastered':
      return `${skill} is mastered. Introduce extension challenges.`;
    case 'proficient':
      return `${skill} is solid. Occasional review to maintain.`;
    case 'approaching':
      return `${skill} needs light reinforcement. Practice with varied examples.`;
    case 'developing':
      return `Re-teach ${skill} with visual models. Practice with concrete examples.`;
    case 'emerging':
      return `${skill} needs focused reteaching. Revisit prerequisite concepts first.`;
    default:
      return `Review ${skill} in next session.`;
  }
}

// ---------------------------------------------------------------------------
// Student learning plan
// ---------------------------------------------------------------------------

export function buildLearningPlan(
  studentName: string,
  generatedAt: string,
  skillScores: AssessmentSkillScoreVM[],
  prerequisiteMap: Record<string, string[]>,
  skillNameMap: Record<string, string>,
): StudentLearningPlan {
  const masteredSkills = skillScores
    .filter((s) => s.masteryLevel === 'mastered' || s.masteryLevel === 'proficient')
    .map((s) => ({
      skill: s.skillName,
      badge: s.masteryLevel === 'mastered' ? '🌟 Expert' : '✅ Proficient',
    }));

  const learningGoals = skillScores
    .filter((s) => s.percentage < 80)
    .sort((a, b) => b.maxScore - b.score - (a.maxScore - a.score))
    .map((s) => {
      const prereqNames = (prerequisiteMap[s.skillId] ?? []).map(
        (pid) => skillNameMap[pid] ?? pid,
      );
      const gap = 80 - s.percentage;
      const estimatedWeeks = gap < 20 ? 1 : gap < 40 ? 2 : gap < 60 ? 4 : 6;

      return {
        skill: s.skillName,
        domain: s.domain,
        grade: s.grade,
        standard: s.standard,
        whyItMatters: `${s.skillName} is an important building block in ${s.domain}. Mastering it unlocks more advanced topics.`,
        currentLevel: masteryLevelLabel(s.masteryLevel),
        steps: [
          prereqNames.length > 0
            ? `First strengthen prerequisites: ${prereqNames.join(', ')}`
            : `Review foundational concepts in ${s.domain}`,
          `Practice ${s.skillName} with 5–10 questions daily`,
          `Work through examples with explanations`,
          `Take a short quiz when you feel ready to check progress`,
        ].filter(Boolean),
        prerequisiteSkills: prereqNames,
        estimatedWeeksToMastery: estimatedWeeks,
      };
    });

  const weeklyPracticePlan = learningGoals.slice(0, 4).map((goal, i) => ({
    week: i + 1,
    focus: goal.skill,
    activities: [
      `Review notes on ${goal.skill}`,
      `Complete 10 practice problems`,
      `Ask your teacher for help on tricky parts`,
    ],
  }));

  return {
    studentName: studentName || 'Student',
    generatedAt,
    masteredSkills,
    learningGoals,
    weeklyPracticePlan,
  };
}
