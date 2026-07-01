'use client';

import type {
  AssessmentResultVM,
  AssessmentSkillScoreVM,
  ParentReport,
  TutorReport,
  StudentLearningPlan,
} from '@iconicedu/shared-types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@iconicedu/ui-web';

interface Props {
  result: AssessmentResultVM;
  showAllReports?: boolean;
}

const MASTERY_COLOR: Record<string, string> = {
  mastered: 'text-green-600 bg-green-50',
  proficient: 'text-green-500 bg-green-50',
  approaching: 'text-yellow-600 bg-yellow-50',
  developing: 'text-orange-500 bg-orange-50',
  emerging: 'text-red-500 bg-red-50',
  not_started: 'text-gray-400 bg-gray-50',
};

const MASTERY_LABEL: Record<string, string> = {
  mastered: 'Mastered',
  proficient: 'Proficient',
  approaching: 'Approaching',
  developing: 'Developing',
  emerging: 'Emerging',
  not_started: 'Not started',
};

export function ResultsView({ result, showAllReports = false }: Props) {
  const skillScores: AssessmentSkillScoreVM[] = result.skillScores ?? [];
  const passed = result.passed;

  const tabs = [
    { value: 'scorecard', label: 'Skill Scorecard' },
    ...(showAllReports
      ? [
          { value: 'parent', label: 'Parent Report' },
          { value: 'tutor', label: 'Tutor Report' },
          { value: 'plan', label: 'Learning Plan' },
        ]
      : [{ value: 'plan', label: 'Learning Plan' }]),
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Score hero */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center gap-6 px-6 py-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <span className="text-2xl font-bold text-primary">
              {Math.round(result.percentage ?? 0)}%
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {passed !== null && passed !== undefined && (
                <Badge variant={passed ? 'default' : 'destructive'}>
                  {passed ? 'Passed' : 'Not passed'}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {result.totalScore} / {result.maxScore} points
              </span>
              {skillScores.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  · {skillScores.length} skill{skillScores.length !== 1 ? 's' : ''}{' '}
                  assessed
                </span>
              )}
            </div>
            {result.needsManualGrading && (
              <Badge variant="outline" className="w-fit text-xs">
                Essay answers pending manual grading
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="scorecard">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="scorecard" className="pt-4">
          <SkillScorecard skillScores={skillScores} />
        </TabsContent>

        {showAllReports && (
          <TabsContent value="parent" className="pt-4">
            {result.parentReport ? (
              <ParentReportCard report={result.parentReport as ParentReport} />
            ) : (
              <NoReport />
            )}
          </TabsContent>
        )}

        {showAllReports && (
          <TabsContent value="tutor" className="pt-4">
            {result.tutorReport ? (
              <TutorReportCard report={result.tutorReport as TutorReport} />
            ) : (
              <NoReport />
            )}
          </TabsContent>
        )}

        <TabsContent value="plan" className="pt-4">
          {result.learningPlan ? (
            <LearningPlanCard plan={result.learningPlan as StudentLearningPlan} />
          ) : (
            <NoReport />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function SkillScorecard({ skillScores }: { skillScores: AssessmentSkillScoreVM[] }) {
  if (skillScores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No skill scores available.</p>
    );
  }

  const sorted = [...skillScores].sort((a, b) => a.percentage - b.percentage);

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="px-6 py-3 border-b bg-muted/30">
        <span className="text-sm font-medium text-muted-foreground">
          Skills ({skillScores.length})
        </span>
      </div>
      <div className="divide-y divide-border">
        {sorted.map((skill) => {
          const pct = Math.round(skill.percentage);
          return (
            <div key={skill.id} className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{skill.skillName}</span>
                    {skill.standard && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {skill.standard}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Gr. {skill.grade}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {skill.subject} · {skill.domain}
                  </p>
                  <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold">{pct}%</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${MASTERY_COLOR[skill.masteryLevel] ?? ''}`}
                  >
                    {MASTERY_LABEL[skill.masteryLevel] ?? skill.masteryLevel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {skill.itemsCorrect}/{skill.itemsTotal}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ParentReportCard({ report }: { report: ParentReport }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card px-5 py-5">
        <p className="text-lg font-medium leading-relaxed">{report.overallMessage}</p>
        {report.passed !== null && (
          <Badge variant={report.passed ? 'default' : 'secondary'} className="mt-2">
            {report.passed ? '✓ Passed' : 'Keep practising'}
          </Badge>
        )}
      </div>

      {report.highlights.map((h, i) => (
        <div
          key={i}
          className={`rounded-xl border bg-card px-4 py-4 ${h.type === 'strength' ? 'border-green-200' : 'border-orange-200'}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{h.type === 'strength' ? '⭐' : '📈'}</span>
            <div>
              <p className="text-sm font-medium">{h.skill}</p>
              <p className="text-sm text-muted-foreground mt-1">{h.message}</p>
            </div>
          </div>
        </div>
      ))}

      {report.suggestedHomeActivities.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/30">
            <p className="text-sm font-semibold">Things to try at home</p>
          </div>
          <ul className="divide-y divide-border">
            {report.suggestedHomeActivities.map((a, i) => (
              <li key={i} className="px-5 py-3 text-sm text-muted-foreground">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.encouragement && (
        <div className="rounded-xl border bg-muted/30 px-5 py-4">
          <p className="text-sm italic text-muted-foreground">{report.encouragement}</p>
        </div>
      )}
    </div>
  );
}

function TutorReportCard({ report }: { report: TutorReport }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border overflow-hidden">
        <div className="grid grid-cols-3 divide-x">
          <div className="px-6 py-4 text-center">
            <p className="text-2xl font-bold">{Math.round(report.percentage)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Overall</p>
          </div>
          <div className="px-6 py-4 text-center">
            <p className="text-2xl font-bold">{report.timeSpentMinutes}m</p>
            <p className="text-xs text-muted-foreground mt-0.5">Time spent</p>
          </div>
          <div className="px-6 py-4 flex flex-col items-center justify-center gap-1">
            <Badge variant={report.testMode === 'adaptive' ? 'default' : 'secondary'}>
              {report.testMode}
            </Badge>
            <p className="text-xs text-muted-foreground">Mode</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="px-6 py-3 border-b bg-muted/30">
          <span className="text-sm font-medium text-muted-foreground">
            Skill Breakdown
          </span>
        </div>
        <div className="divide-y divide-border">
          {report.skillBreakdown.map((skill) => (
            <div key={skill.skillId} className="px-6 py-4">
              <div className="flex items-center gap-2 justify-between flex-wrap">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{skill.skillName}</span>
                  {skill.standard && (
                    <span className="ml-2 text-xs text-muted-foreground font-mono">
                      {skill.standard}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {skill.domain} · Grade {skill.grade}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold">
                    {Math.round(skill.percentage)}%
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${MASTERY_COLOR[skill.masteryLevel] ?? ''}`}
                  >
                    {MASTERY_LABEL[skill.masteryLevel] ?? skill.masteryLevel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {skill.itemsCorrect}/{skill.itemsTotal}
                  </span>
                </div>
              </div>
              {skill.recommendedAction && (
                <p className="text-xs text-blue-600 mt-1.5">
                  💡 {skill.recommendedAction}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {report.nextLessonSuggestions.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-6 py-3 border-b bg-muted/30">
            <span className="text-sm font-medium text-muted-foreground">
              Next Lesson Suggestions
            </span>
          </div>
          <ol className="divide-y divide-border">
            {report.nextLessonSuggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-3 px-6 py-3.5">
                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function LearningPlanCard({ plan }: { plan: StudentLearningPlan }) {
  return (
    <div className="flex flex-col gap-4">
      {plan.masteredSkills.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/30">
            <p className="text-sm font-semibold">Skills You&apos;ve Mastered 🎉</p>
          </div>
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {plan.masteredSkills.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-sm gap-1">
                {s.badge} {s.skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {plan.learningGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Your Learning Goals</h3>
          <Accordion type="multiple" className="flex flex-col gap-2">
            {plan.learningGoals.map((goal, i) => (
              <AccordionItem
                key={i}
                value={String(i)}
                className="border rounded-xl overflow-hidden bg-card"
              >
                <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors [&>svg]:text-muted-foreground [&>svg]:flex-shrink-0">
                  <div className="flex items-center gap-2.5 text-left min-w-0 flex-1 mr-2">
                    <span className="font-semibold text-sm leading-snug">
                      {goal.skill}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-xs flex-shrink-0 font-medium"
                    >
                      Gr.&nbsp;{goal.grade}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {goal.domain}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-1">
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {goal.whyItMatters}
                    </p>
                    <p className="text-xs font-medium text-primary bg-primary/8 rounded-md px-2.5 py-1.5 w-fit">
                      {goal.currentLevel}
                    </p>
                    <div className="flex flex-col gap-2">
                      {goal.steps.map((step, j) => (
                        <div key={j} className="flex items-start gap-3">
                          <span className="flex-shrink-0 h-5 w-5 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center mt-0.5">
                            {j + 1}
                          </span>
                          <p className="text-sm leading-snug">{step}</p>
                        </div>
                      ))}
                    </div>
                    {goal.prerequisiteSkills.length > 0 && (
                      <div className="mt-1 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          Strengthen first:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {goal.prerequisiteSkills.map((p, j) => (
                            <Badge key={j} variant="outline" className="text-xs">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {plan.weeklyPracticePlan.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/30">
            <p className="text-sm font-semibold">Weekly Practice Plan</p>
          </div>
          <div className="divide-y divide-border">
            {plan.weeklyPracticePlan.map((week) => (
              <div key={week.week} className="px-5 py-4">
                <p className="text-sm font-medium">
                  Week {week.week} — {week.focus}
                </p>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {week.activities.map((act, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      • {act}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoReport() {
  return (
    <p className="text-sm text-muted-foreground py-4">
      Report not yet generated. Submit the session to generate reports.
    </p>
  );
}
