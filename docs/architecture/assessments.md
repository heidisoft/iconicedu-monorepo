# Assessments Architecture

## Purpose

Reference guide for the assessments feature — covering how it is built, how data flows from curriculum to scored result, and how each concept (difficulty, mastery, adaptive engine, reports) works in practice.

## Intended Audience

Engineers and educators who need to understand the system before authoring content, building integrations, or extending the feature.

## Last Updated

2026-06-17

## Related Docs

- [Architecture Overview](overview.md)
- [Database](database.md)

---

## Concept Map

```
Subject
  └── Domain (grade-level grouping)
        └── Skill (leaf node — every question tagged here)
              └── Prerequisite Skills (DAG links to other Skills)

Item Bank
  └── Item (question) — tagged to exactly one Skill + difficulty 1–5

Test
  └── Static Test  →  Sections  →  Section Items (fixed order)
  └── Adaptive Test  →  Skill Pools (engine selects items at runtime)

Delivery (how a Test reaches learners)
  └── access_type: public | authenticated | class | specific_users
  └── Assessment Session (one per learner attempt)
        └── Responses (one per item answered)
        └── Assessment Result (computed on submit)
              └── Skill Scores (one per skill exercised)
              └── Reports: Parent | Tutor | Learning Plan
```

---

## Feature Flag

The assessments feature ships behind a [Vercel Flags SDK](../../apps/web/flags.ts) toggle:

```
Flag name: assessments-enabled
Default:   false
```

Enable it in your Vercel project's feature flags dashboard (or locally via the Flags SDK dev override). Both the admin sidebar section and the student sidebar entry are gated behind this flag. The public anonymous delivery route (`/a/[token]`) is always accessible regardless of the flag.

---

## Setting Up Assessments (Step-by-step)

### 1 — Build the Curriculum

Navigate to **Admin → Assessments → Curriculum**.

Every question must be tagged to a **Skill**. Skills live inside **Domains**, and Domains live inside **Subjects**.

```
Subject: Mathematics
  Domain: Fractions (Grade 4)
    Skill: Identify equivalent fractions
    Skill: Compare fractions with unlike denominators
  Domain: Decimals (Grade 5)
    Skill: Add and subtract decimals to hundredths
```

**Create a Subject** — give it a name, pick an emoji icon, and choose a color. The icon and color are purely cosmetic; they appear on the curriculum list page.

**Create a Domain** — name it and assign a grade level (1–12). Grade is used for sorting and for filtering the adaptive engine's difficulty progression.

**Create a Skill** — this is the most important step. Fill in:

| Field                   | What it means                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**                | Short verb phrase — what the student will do. "Compare fractions with unlike denominators."                                              |
| **Standard**            | Curriculum standard code, e.g. `CCSS.Math.Content.4.NF.A.2`. Optional but useful for reporting.                                          |
| **Description**         | Longer explanation for educators. Shown in the Tutor Report.                                                                             |
| **Baseline difficulty** | The _typical_ difficulty of items for this skill (1–5). Used as the entry difficulty when the adaptive engine starts testing this skill. |
| **Estimated time**      | Expected seconds per item for this skill. Used to estimate total test duration.                                                          |

**Link prerequisites** — click the link icon on any skill to declare which skills a student should have mastered first. The adaptive engine uses these links: if a student struggles with a skill, the engine injects prerequisite items automatically.

---

### 2 — Build the Item Bank

Navigate to **Admin → Assessments → Item Bank**.

Each item belongs to one skill and one difficulty level. There are seven item types:

| Type                | Student interaction                                                               |
| ------------------- | --------------------------------------------------------------------------------- |
| `multiple_choice`   | Pick one option from a list                                                       |
| `true_false`        | Pick True or False                                                                |
| `multiple_response` | Select all correct options (partial credit)                                       |
| `short_answer`      | Type a free-text answer matched against a list of accepted answers                |
| `ordering`          | Drag items into the correct sequence (partial credit by position)                 |
| `matching`          | Click left-side items then right-side items to pair them (partial credit by pair) |
| `gap_match`         | Fill blanks in a sentence from a word bank (partial credit by gap)                |
| `essay`             | Open-ended written response — always flagged for manual grading                   |

**Difficulty 1–5 guide:**

| Level | Description                           | Example                                                                                |
| ----- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| 1     | Recall / recognition                  | "Which picture shows a fraction?"                                                      |
| 2     | Single-step application               | "What is 1/2 + 1/4?"                                                                   |
| 3     | Multi-step or familiar context        | "Compare 3/4 and 2/3 using a number line."                                             |
| 4     | Problem-solving with less scaffolding | "Order four fractions from least to greatest and explain your reasoning."              |
| 5     | Transfer / novel context              | Word problem combining fractions, decimals, and percentages in an unfamiliar scenario. |

Aim for **at least 3 items at each difficulty level** per skill. The adaptive engine needs variety so it does not serve the same item twice in a session. The curriculum page shows a coverage badge per skill to flag thin areas.

**Content fields by type:**

_multiple_choice_ and _true_false_ — the item content is stored as:

```json
// multiple_choice
{ "stem": "Which fraction equals 2/4?", "options": [
  { "id": "a", "text": "1/2", "correct": true },
  { "id": "b", "text": "1/3", "correct": false }
]}

// true_false
{ "stem": "3/6 and 1/2 are equivalent.", "correct": true }
```

_ordering_ — items must include `correctPosition` (1-indexed):

```json
{
  "stem": "Arrange from smallest to largest.",
  "items": [
    { "id": "a", "text": "1/4", "correctPosition": 1 },
    { "id": "b", "text": "1/2", "correctPosition": 3 },
    { "id": "c", "text": "1/3", "correctPosition": 2 }
  ]
}
```

_short_answer_ — supply an array of accepted answers, with optional case sensitivity:

```json
{
  "stem": "What is 1/2 + 1/4?",
  "correctAnswers": ["3/4", "0.75"],
  "caseSensitive": false
}
```

---

### 3 — Assemble a Test

Navigate to **Admin → Assessments → Tests**.

Choose between two modes:

**Standard (static)** — you hand-pick every item in every section. The student always sees the same questions in the same order. Sections can have a `shuffleItems` flag to randomise order within the section.

**Adaptive** — you define a pool of skills to assess. The engine selects items at runtime based on the student's live performance. See [Adaptive Engine](#adaptive-engine) below.

Common test-level settings:

| Setting                    | Effect                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `time_limit_minutes`       | Hard cutoff; session auto-submits when timer expires.                                                               |
| `passing_score_percent`    | Determines pass/fail badge on the result screen.                                                                    |
| `show_results_immediately` | If false, the student sees "submitted" but not their score until you release it.                                    |
| `show_correct_answers`     | If true, the item-level review section on the results page shows the correct answer alongside the student's answer. |
| `shuffle_sections`         | Randomise section order (static tests only).                                                                        |

---

### 4 — Create a Delivery

Navigate to **Admin → Assessments → Deliveries**.

A Delivery connects a Test to learners. One test can have many deliveries (e.g. different classes, different dates, different access types).

| Access type      | Who can take it                          |
| ---------------- | ---------------------------------------- |
| `authenticated`  | Any logged-in user in the org            |
| `class`          | Members of a specific channel/class      |
| `specific_users` | An explicit allowlist                    |
| `public`         | Anyone with the link — no login required |

For `public` deliveries, set `collect_name_email: true` if you want the student's name and email recorded alongside the anonymous session.

`allow_resume: true` (default) lets an authenticated student close the browser and return to where they left off. For timed tests set this to `false` if the timer should not pause.

`max_attempts` controls how many times a student can retake the same delivery.

**Sending to a class** — if `access_type = class` and a `channel_id` is set, you can click "Send to channel". This posts a `message_assessment` card into the class channel. Students tap the card to go straight to the pre-test screen.

---

## Adaptive Engine

The adaptive engine runs server-side inside `apps/api/src/modules/assessment-sessions/adaptive-engine.ts`. It is triggered on every call to `PUT /assessment-sessions/:id/response`.

### How it selects the next item

1. Score the just-submitted response and update the skill's live state.
2. Check **stopping rules** for the current skill:
   - `consecutiveCorrect >= stopOnConsecutiveCorrect` → skill resolved (mastered)
   - `consecutiveWrong >= stopOnConsecutiveWrong` → skill resolved (needs work)
   - `itemsServed.length >= maxItemsPerSkill` → skill resolved (cap reached)
3. Check **advancement rules**:
   - `consecutiveCorrect >= advanceTriggerCorrectCount` → bump `currentDifficulty` up by `advanceDifficultyStep` (cap at 5)
4. Check **prerequisite trigger**:
   - If wrong answers in the skill reached `prereqTriggerMissCount` AND the skill has prerequisites → push prerequisite skill + lower difficulty onto the queue
5. **Pick next item** from:
   - Prerequisite queue (priority)
   - Current skill at current difficulty
   - Next pending skill in pool order
   - `null` → test is complete

Items are drawn randomly from `assessment_items WHERE skill_id = X AND difficulty = Y AND id NOT IN (already served)`.

### AdaptiveConfig fields

These live on `assessment_tests.adaptive_config` (JSON). All have sensible defaults.

| Field                        | Default | What it controls                                                |
| ---------------------------- | ------- | --------------------------------------------------------------- |
| `prereqTriggerMissCount`     | 2       | Wrong answers in a skill before prerequisite items are injected |
| `prereqItemsToInject`        | 2       | How many prerequisite items to serve per trigger                |
| `advanceTriggerCorrectCount` | 3       | Consecutive correct answers before difficulty steps up          |
| `advanceDifficultyStep`      | 1       | How many levels difficulty jumps on advancement                 |
| `stopOnConsecutiveCorrect`   | 3       | Consecutive correct answers to declare skill mastered           |
| `stopOnConsecutiveWrong`     | 2       | Consecutive wrong answers to stop testing a skill               |
| `maxItemsPerSkill`           | 8       | Hard cap per skill regardless of stopping rules                 |
| `minItemsPerSkill`           | 3       | Must serve at least this many items before allowing early stop  |

**Practical guidance:**

- A low `prereqTriggerMissCount` (1–2) makes the engine more sensitive — it injects remedial content early. Good for younger students.
- A high `stopOnConsecutiveCorrect` (4–5) makes the engine more conservative about declaring mastery. Good for high-stakes assessments.
- If your item bank is thin at extreme difficulties, keep `advanceDifficultyStep = 1` and set `maxItemsPerSkill` lower to avoid the engine running out of items.

---

## Understanding Difficulty

There are two separate difficulty numbers in the system. They work together but mean different things.

### Item Difficulty (set on each question)

Every question in the item bank has a difficulty from **1 to 5**, fixed at creation time. It describes how hard that specific question is regardless of which student sees it or which test it appears in.

| Level | Meaning                               | Example                                                                                |
| ----- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| 1     | Pure recall / recognition             | "Which picture shows a fraction?"                                                      |
| 2     | Single-step application               | "What is 1/2 + 1/4?"                                                                   |
| 3     | Multi-step or familiar context        | "Compare 3/4 and 2/3 using a number line."                                             |
| 4     | Problem-solving with less scaffolding | "Order four fractions from least to greatest and explain your reasoning."              |
| 5     | Transfer / novel context              | Word problem combining fractions, decimals, and percentages in an unfamiliar scenario. |

This number is recorded on every response row. The Tutor Report surfaces the average difficulty served per skill, which tells educators whether a student was challenged appropriately.

### Skill Baseline Difficulty (set on each skill)

The **baseline difficulty** on a skill is not about any single question — it is the _entry point_ the adaptive engine uses when it begins testing that skill, before it knows anything about how the student is performing.

It answers: "at what level should we start this student?"

Examples:

- **Identify equivalent fractions** → baseline 2 (foundational concept, start easy)
- **Compare fractions with unlike denominators** → baseline 3 (more complex, start mid-range)
- **Multi-step fraction word problems** → baseline 4 (advanced, students reaching this should already be strong)

In a static test the baseline has no runtime effect — it is only used by the adaptive engine.

### How the Two Numbers Interact in an Adaptive Test

```
Skill baseline difficulty = 3
↓
Engine serves a difficulty-3 question

Student gets it right
Student gets it right again
Student gets it right a 3rd time  ← advanceTriggerCorrectCount reached
↓
Engine bumps currentDifficulty to 4

Student gets difficulty-4 wrong
Student gets difficulty-4 wrong again  ← stopOnConsecutiveWrong reached
↓
Skill is resolved (student plateaued at difficulty 3–4)

Along the way: 2 wrong answers total hit prereqTriggerMissCount (prerequisite trigger threshold)
↓
Engine injects 2 prerequisite-skill items before continuing to the next skill
```

The baseline is the _starting position_. The engine then moves up when the student is doing well, or injects prerequisite content when the student struggles — all relative to that starting point.

### Why You Need Items at Every Difficulty Level

For the adaptive engine to function correctly, each skill needs items at **every difficulty level** it might serve:

```
Skill: Compare fractions with unlike denominators (baseline 3)

Difficulty 1: ≥1 item  ← needed if engine drops below baseline for remediation
Difficulty 2: ≥2 items ← prerequisite injection range
Difficulty 3: ≥3 items ← engine starts here, needs variety so same item isn't repeated
Difficulty 4: ≥3 items ← needed for advancement
Difficulty 5: ≥2 items ← ceiling for strong students
```

If you set a baseline of 3 but only have items at difficulty 3 and 4, the engine cannot serve lower-difficulty content when a student struggles. It will run out of items and end the session early (returning `null`). The curriculum page's **coverage badge** per skill flags any difficulty level that has fewer than 3 items.

**Practical authoring rule:** write items at the baseline and one level above first. Fill in levels below for prerequisite support, and level 5 for extension.

---

## Scoring

### Per-item auto-scoring

| Type                | Algorithm                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `multiple_choice`   | 1 point if selected option matches the correct option; 0 otherwise                                         |
| `true_false`        | 1 point if boolean response matches `content.correct`; 0 otherwise                                         |
| `multiple_response` | `max(0, (correctSelected − incorrectSelected) / totalCorrect)` — partial credit, penalised for wrong picks |
| `short_answer`      | 1 if response matches any entry in `correctAnswers` (respects `caseSensitive`); 0 otherwise                |
| `ordering`          | Fraction of items placed at their correct position — e.g. 3 of 4 correct = 0.75                            |
| `matching`          | Fraction of pairs matched correctly                                                                        |
| `gap_match`         | Fraction of gaps filled with a correct answer                                                              |
| `essay`             | Not auto-scored; flagged as `needs_manual_grading = true`                                                  |

Manual grades entered by an educator override the auto score and trigger a skill score recomputation.

### Mastery levels

After a session is submitted, one `assessment_skill_scores` row is written per skill exercised. The `percentage` is mapped to a mastery level:

| Percentage | Level           |
| ---------- | --------------- |
| ≥ 90%      | **Mastered**    |
| 80–89%     | **Proficient**  |
| 70–79%     | **Approaching** |
| 50–69%     | **Developing**  |
| < 50%      | **Emerging**    |

The level feeds into `assessment_skill_mastery` (one row per student per skill across all sessions). Only `best_percentage` is retained — re-taking a test can improve mastery but never reduce it.

---

## Reports

Three reports are generated automatically on session submit (or when the last manual grade is saved for an essay-heavy test).

### Parent Report

Plain-language summary for non-technical parents. Highlights up to 2 strengths and 1 growth area. Includes 1–3 simple home activities.

```json
{
  "studentName": "Sam",
  "overallPercentage": 78,
  "passed": true,
  "highlights": [
    {
      "type": "strength",
      "skill": "Identify equivalent fractions",
      "message": "Sam did really well here."
    },
    {
      "type": "growth_area",
      "skill": "Compare fractions with unlike denominators",
      "message": "A little more practice here would help."
    }
  ],
  "suggestedHomeActivities": [
    "Try the fraction wall app together",
    "Measure ingredients when baking"
  ]
}
```

### Tutor Report

Diagnostic report for educators. Full skill breakdown with standard codes, average difficulty served, items correct vs total, and prerequisite gaps detected.

```json
{
  "skillBreakdown": [
    {
      "skillName": "Identify equivalent fractions",
      "standard": "CCSS.Math.Content.4.NF.A.1",
      "percentage": 92,
      "masteryLevel": "mastered",
      "itemsCorrect": 4,
      "itemsTotal": 4,
      "difficultyAvg": 3.0,
      "prerequisiteGapsDetected": [],
      "recommendedAction": "Extend to harder applications."
    }
  ],
  "prerequisiteGapSummary": [],
  "nextLessonSuggestions": ["Compare fractions with unlike denominators"]
}
```

### Student Learning Plan

Action-oriented plan written for the student. Ordered by priority (largest gap first). Includes a week-by-week practice schedule.

```json
{
  "masteredSkills": [{ "skill": "Identify equivalent fractions", "badge": "Expert" }],
  "learningGoals": [
    {
      "skill": "Compare fractions with unlike denominators",
      "currentLevel": "You're getting there!",
      "steps": [
        "Review what a common denominator is",
        "Practice with fractions that have denominators 2, 4, and 8",
        "Try comparing 3 fractions at once"
      ],
      "prerequisiteSkills": ["Identify equivalent fractions"],
      "estimatedWeeksToMastery": 2
    }
  ],
  "weeklyPracticePlan": [
    {
      "week": 1,
      "focus": "Equivalent fractions",
      "activities": ["Fraction wall", "Khan Academy NF.A.1"]
    },
    {
      "week": 2,
      "focus": "Comparing fractions",
      "activities": ["Number line exercises", "Compare fractions game"]
    }
  ]
}
```

---

## Data Model (key tables)

```
assessment_subjects          id, org_id, name, icon, color
assessment_domains           id, org_id, subject_id, name, grade, order_position
assessment_skills            id, org_id, domain_id, name, standard, difficulty_baseline, estimated_time_seconds
assessment_skill_prerequisites  skill_id → prerequisite_skill_id (DAG)

assessment_items             id, org_id, skill_id, type, content (JSONB), difficulty 1–5
assessment_tests             id, org_id, mode (standard|adaptive), adaptive_config (JSONB)
assessment_test_sections     id, test_id, title, order_position          [static only]
assessment_test_section_items id, section_id, item_id, points            [static only]
assessment_test_skill_pools  id, test_id, skill_id, target/min/max items [adaptive only]

assessment_deliveries        id, org_id, test_id, access_type, access_token, channel_id
assessment_sessions          id, delivery_id, profile_id, status, item_order, adaptive_state
assessment_responses         id, session_id, item_id, skill_id, response_data, auto_score, is_correct

assessment_results           id, session_id, total_score, percentage, passed, parent_report, tutor_report, learning_plan
assessment_skill_scores      id, session_id, skill_id, score, percentage, mastery_level
assessment_skill_mastery     id, profile_id, skill_id, level, best_percentage, attempts
```

All tables are in the `public` schema of the Supabase Postgres database. Row-Level Security (RLS) is enabled; the API uses a service-role client that bypasses RLS for writes.

---

## API Endpoints

All endpoints live under `apps/api` (NestJS, `localhost:3001`). Full Swagger docs at `localhost:3001/docs`.

| Module                  | Key endpoints                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `assessment-curriculum` | `GET /subjects`, `POST /subjects`, `GET /subjects/:id/tree`, `POST /domains`, `POST /skills`, `PUT /skills/:id`, `DELETE /skills/:id`          |
| `assessment-items`      | `GET /items`, `POST /items`, `PUT /items/:id`, `DELETE /items/:id`                                                                             |
| `assessment-tests`      | `GET /tests`, `POST /tests`, `GET /tests/:id/full`, `PUT /tests/:id`, `POST /tests/:id/skill-pools`                                            |
| `assessment-deliveries` | `GET /deliveries`, `POST /deliveries`, `GET /deliveries/by-token/:token`, `GET /deliveries/:id/results`, `POST /deliveries/:id/generate-token` |
| `assessment-sessions`   | `POST /sessions` (start), `GET /sessions/:id`, `PUT /sessions/:id/response` (save + next item), `POST /sessions/:id/submit`                    |
| `assessment-results`    | `GET /results/:sessionId`, `GET /results/:sessionId/reports/:type`, `PUT /results/:sessionId/grade/:itemId`                                    |

---

## Web Routes

| Route                                                 | Who sees it                                     |
| ----------------------------------------------------- | ----------------------------------------------- |
| `/{orgSlug}/admin/assessments`                        | Staff/owner — overview dashboard                |
| `/{orgSlug}/admin/assessments/curriculum`             | Staff/owner — subject list                      |
| `/{orgSlug}/admin/assessments/curriculum/[subjectId]` | Staff/owner — domain + skill tree editor        |
| `/{orgSlug}/admin/assessments/items`                  | Staff/owner — item bank                         |
| `/{orgSlug}/admin/assessments/tests`                  | Staff/owner — tests list + builder              |
| `/{orgSlug}/admin/assessments/deliveries`             | Staff/owner — deliveries list                   |
| `/{orgSlug}/admin/assessments/deliveries/[id]`        | Staff/owner — results + class skill heatmap     |
| `/{orgSlug}/assessments/[deliveryId]/take`            | Authenticated student — test player             |
| `/{orgSlug}/assessments/[deliveryId]/results`         | Authenticated student — results + learning plan |
| `/a/[token]`                                          | Anyone (public link) — anonymous test landing   |
| `/a/[token]/take`                                     | Anyone — anonymous test player                  |
| `/a/[token]/complete`                                 | Anyone — anonymous results                      |

---

## Adding a New Question Type

1. Add the new type to the `ItemType` union in `packages/shared-types/src/vm/assessment-item.ts` and add a matching content interface.
2. Re-export it from `packages/shared-types/src/index.ts`.
3. Run `pnpm build:packages`.
4. Add a new `case` to `scoreItem()` in `apps/api/src/modules/assessment-sessions/score-item.ts`.
5. Add a corresponding widget in the `ItemResponseWidget` switch in `apps/web/components/assessments/question-player.tsx`.
6. Add unit tests for the new scorer case in `apps/api/src/modules/assessment-sessions/score-item.spec.ts`.

---

## Common Pitfalls

**"No questions available" when starting a session**
The API queries item order from `assessment_test_sections` (not from `assessment_test_section_items` directly). Always verify that `test_id` exists on `assessment_test_sections` and that items are linked via `assessment_test_section_items`. Run `supabase db reset` after seed changes.

**0% score after completing a session**
The scorer reads `response_data` as raw primitive values — a string for MCQ, a boolean for true/false, a string array for ordering/multiple-response, and a plain object for matching/gap-match. Do not wrap the response in `{ selectedId: ... }` — send the raw value directly from the widget's `onChange`.

**True/false items always wrong**
`TrueFalseContent` stores `correct: boolean`, not an options array. The seed (and any manually created items) must have content in the form `{ "stem": "...", "correct": true }`, not `{ "options": [...] }`.

**Adaptive engine returns null immediately**
Check that the test has at least one skill pool (`assessment_test_skill_pools`) and that the item bank has items at the pool skill's `startDifficulty`. The engine queries `assessment_items WHERE skill_id = X AND difficulty = Y` — if no rows match, it returns null and ends the session.

**Supabase PostgREST filter on a join column is silently ignored**
Never filter on a column that belongs to an embedded parent join (e.g. `.eq('assessment_tests.org_id', x)` from `assessment_sessions`). Always query from the table that owns the column directly. See [ADR decisions](../decisions/) for the rule.
