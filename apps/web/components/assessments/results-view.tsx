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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold">{Math.round(result.percentage ?? 0)}%</p>
              <p className="text-sm text-muted-foreground mt-1">Overall score</p>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {passed !== null && passed !== undefined && (
                  <Badge variant={passed ? 'default' : 'destructive'}>
                    {passed ? 'Passed' : 'Not passed'}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {result.totalScore} / {result.maxScore} points
                </span>
              </div>
              {skillScores.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {skillScores.length} skill{skillScores.length !== 1 ? 's' : ''} assessed
                </p>
              )}
              {result.needsManualGrading && (
                <Badge variant="outline" className="w-fit text-xs">
                  Essay answers pending manual grading
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
    <div className="flex flex-col gap-2">
      {sorted.map((skill) => {
        const pct = Math.round(skill.percentage);
        return (
          <Card key={skill.id}>
            <CardContent className="py-3 px-4">
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
                  <p className="text-xs text-muted-foreground">
                    {skill.subject} · {skill.domain}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium">{pct}%</span>
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ParentReportCard({ report }: { report: ParentReport }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="py-5">
          <p className="text-lg font-medium leading-relaxed">{report.overallMessage}</p>
          {report.passed !== null && (
            <Badge variant={report.passed ? 'default' : 'secondary'} className="mt-2">
              {report.passed ? '✓ Passed' : 'Keep practising'}
            </Badge>
          )}
        </CardContent>
      </Card>

      {report.highlights.map((h, i) => (
        <Card
          key={i}
          className={h.type === 'strength' ? 'border-green-200' : 'border-orange-200'}
        >
          <CardContent className="py-4 px-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">{h.type === 'strength' ? '⭐' : '📈'}</span>
              <div>
                <p className="text-sm font-medium">{h.skill}</p>
                <p className="text-sm text-muted-foreground mt-1">{h.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {report.suggestedHomeActivities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Things to try at home</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside flex flex-col gap-1">
              {report.suggestedHomeActivities.map((a, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {report.encouragement && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <p className="text-sm italic text-muted-foreground">{report.encouragement}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TutorReportCard({ report }: { report: TutorReport }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold">{Math.round(report.percentage)}%</p>
            <p className="text-xs text-muted-foreground">Overall</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold">{report.timeSpentMinutes}m</p>
            <p className="text-xs text-muted-foreground">Time spent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <Badge variant={report.testMode === 'adaptive' ? 'default' : 'secondary'}>
              {report.testMode}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Mode</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Skill Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.skillBreakdown.map((skill) => (
            <div key={skill.skillId} className="px-4 py-3 border-b last:border-b-0">
              <div className="flex items-center gap-2 justify-between flex-wrap">
                <div>
                  <span className="text-sm font-medium">{skill.skillName}</span>
                  {skill.standard && (
                    <span className="ml-2 text-xs text-muted-foreground font-mono">
                      {skill.standard}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {skill.domain} · Grade {skill.grade}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
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
                <p className="text-xs text-blue-600 mt-1">💡 {skill.recommendedAction}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {report.nextLessonSuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Next Lesson Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside flex flex-col gap-1">
              {report.nextLessonSuggestions.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {s}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LearningPlanCard({ plan }: { plan: StudentLearningPlan }) {
  return (
    <div className="flex flex-col gap-4">
      {plan.masteredSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Skills You&apos;ve Mastered 🎉</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {plan.masteredSkills.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-sm gap-1">
                {s.badge} {s.skill}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {plan.learningGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Your Learning Goals</h3>
          <Accordion type="multiple">
            {plan.learningGoals.map((goal, i) => (
              <AccordionItem key={i} value={String(i)} className="border rounded-lg mb-2">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2 text-left">
                    <span className="font-medium text-sm">{goal.skill}</span>
                    <Badge variant="outline" className="text-xs">
                      Gr. {goal.grade}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{goal.domain}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {goal.whyItMatters}
                  </p>
                  <p className="text-xs text-primary mb-3">{goal.currentLevel}</p>
                  <div className="flex flex-col gap-1.5">
                    {goal.steps.map((step, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground mt-0.5 w-4 flex-shrink-0">
                          {j + 1}.
                        </span>
                        <p className="text-sm">{step}</p>
                      </div>
                    ))}
                  </div>
                  {goal.prerequisiteSkills.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        Strengthen first:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {goal.prerequisiteSkills.map((p, j) => (
                          <Badge key={j} variant="outline" className="text-xs">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {plan.weeklyPracticePlan.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Weekly Practice Plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {plan.weeklyPracticePlan.map((week) => (
              <div key={week.week} className="border rounded-md px-3 py-2">
                <p className="text-sm font-medium">
                  Week {week.week} — {week.focus}
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {week.activities.map((act, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      • {act}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
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
