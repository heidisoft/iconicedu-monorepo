export type CountryCode = 'us' | 'gb' | 'in' | 'lk' | 'au' | 'ib' | 'global';

export enum GradeBand {
  EarlyChildhood = 'early_childhood',
  Primary = 'primary',
  Middle = 'middle',
  Secondary = 'secondary',
  PostSecondary = 'post_secondary',
}

export enum GradeMilestone {
  SriLanka_Scholarship = 'sri_lanka_scholarship',
  SriLanka_OL_Prep = 'sri_lanka_ol_prep',
  SriLanka_OL_Exam = 'sri_lanka_ol_exam',
  SriLanka_AL_Year1 = 'sri_lanka_al_year1',
  SriLanka_AL_Year2 = 'sri_lanka_al_year2',
  UK_GCSE = 'uk_gcse',
  UK_ALevels = 'uk_a_levels',
  NYS_Grades3to8_ELA = 'nys_grades_3_8_ela',
  NYS_Grades3to8_Math = 'nys_grades_3_8_math',
  NYS_Regents = 'nys_regents',
  ExamYear = 'exam_year',
}

export enum GradeLevel {
  PreK = 'pre_k',
  Kindergarten = 'kindergarten',
  Grade1 = 'grade_1',
  Grade2 = 'grade_2',
  Grade3 = 'grade_3',
  Grade4 = 'grade_4',
  Grade5 = 'grade_5',
  Grade6 = 'grade_6',
  Grade7 = 'grade_7',
  Grade8 = 'grade_8',
  Grade9 = 'grade_9',
  Grade10 = 'grade_10',
  Grade11 = 'grade_11',
  Grade12 = 'grade_12',
  Grade13 = 'grade_13',
  Undergraduate = 'undergraduate',
  Graduate = 'graduate',
}

export type AgeRange = Readonly<{
  min: number;
  max: number;
}>;

export type GradeMeta = Readonly<{
  level: GradeLevel;
  band: GradeBand;
  display: string;
  ageRange?: AgeRange;
  labels: Partial<Record<CountryCode, string>>;
  milestones?: readonly GradeMilestone[];
  sortOrder: number;
}>;

export const GRADE_LEVEL_ORDER: readonly GradeLevel[] = [
  GradeLevel.PreK,
  GradeLevel.Kindergarten,
  GradeLevel.Grade1,
  GradeLevel.Grade2,
  GradeLevel.Grade3,
  GradeLevel.Grade4,
  GradeLevel.Grade5,
  GradeLevel.Grade6,
  GradeLevel.Grade7,
  GradeLevel.Grade8,
  GradeLevel.Grade9,
  GradeLevel.Grade10,
  GradeLevel.Grade11,
  GradeLevel.Grade12,
  GradeLevel.Grade13,
  GradeLevel.Undergraduate,
  GradeLevel.Graduate,
] as const;

export const GRADE_META: Readonly<Record<GradeLevel, GradeMeta>> = {
  [GradeLevel.PreK]: {
    level: GradeLevel.PreK,
    band: GradeBand.EarlyChildhood,
    display: 'Pre-K',
    ageRange: { min: 3, max: 4 },
    labels: {
      us: 'Pre-K',
      gb: 'Nursery',
      in: 'Nursery',
      lk: 'Preschool',
      au: 'Preschool / Kindergarten',
      global: 'Pre-K',
    },
    sortOrder: 10,
  },
  [GradeLevel.Kindergarten]: {
    level: GradeLevel.Kindergarten,
    band: GradeBand.EarlyChildhood,
    display: 'Kindergarten',
    ageRange: { min: 5, max: 5 },
    labels: {
      us: 'Kindergarten',
      gb: 'Reception',
      in: 'LKG / UKG',
      lk: 'Kindergarten',
      au: 'Foundation (Prep)',
      global: 'Kindergarten',
    },
    sortOrder: 20,
  },
  [GradeLevel.Grade1]: {
    level: GradeLevel.Grade1,
    band: GradeBand.Primary,
    display: 'Grade 1',
    ageRange: { min: 6, max: 6 },
    labels: {
      us: 'Grade 1',
      gb: 'Year 1',
      in: 'Class I',
      lk: 'Grade 1',
      au: 'Year 1',
      global: 'Grade 1',
    },
    sortOrder: 30,
  },
  [GradeLevel.Grade2]: {
    level: GradeLevel.Grade2,
    band: GradeBand.Primary,
    display: 'Grade 2',
    ageRange: { min: 7, max: 7 },
    labels: {
      us: 'Grade 2',
      gb: 'Year 2',
      in: 'Class II',
      lk: 'Grade 2',
      au: 'Year 2',
      global: 'Grade 2',
    },
    sortOrder: 40,
  },
  [GradeLevel.Grade3]: {
    level: GradeLevel.Grade3,
    band: GradeBand.Primary,
    display: 'Grade 3',
    ageRange: { min: 8, max: 8 },
    labels: {
      us: 'Grade 3',
      gb: 'Year 3',
      in: 'Class III',
      lk: 'Grade 3',
      au: 'Year 3',
      global: 'Grade 3',
    },
    milestones: [GradeMilestone.NYS_Grades3to8_ELA, GradeMilestone.NYS_Grades3to8_Math],
    sortOrder: 50,
  },
  [GradeLevel.Grade4]: {
    level: GradeLevel.Grade4,
    band: GradeBand.Primary,
    display: 'Grade 4',
    ageRange: { min: 9, max: 9 },
    labels: {
      us: 'Grade 4',
      gb: 'Year 4',
      in: 'Class IV',
      lk: 'Grade 4',
      au: 'Year 4',
      global: 'Grade 4',
    },
    milestones: [GradeMilestone.NYS_Grades3to8_ELA, GradeMilestone.NYS_Grades3to8_Math],
    sortOrder: 60,
  },
  [GradeLevel.Grade5]: {
    level: GradeLevel.Grade5,
    band: GradeBand.Primary,
    display: 'Grade 5',
    ageRange: { min: 10, max: 10 },
    labels: {
      us: 'Grade 5',
      gb: 'Year 5',
      in: 'Class V',
      lk: 'Grade 5 (Scholarship)',
      au: 'Year 5',
      global: 'Grade 5',
    },
    milestones: [
      GradeMilestone.SriLanka_Scholarship,
      GradeMilestone.ExamYear,
      GradeMilestone.NYS_Grades3to8_ELA,
      GradeMilestone.NYS_Grades3to8_Math,
    ],
    sortOrder: 70,
  },
  [GradeLevel.Grade6]: {
    level: GradeLevel.Grade6,
    band: GradeBand.Middle,
    display: 'Grade 6',
    ageRange: { min: 11, max: 11 },
    labels: {
      us: 'Grade 6',
      gb: 'Year 6',
      in: 'Class VI',
      lk: 'Grade 6',
      au: 'Year 6',
      global: 'Grade 6',
    },
    milestones: [GradeMilestone.NYS_Grades3to8_ELA, GradeMilestone.NYS_Grades3to8_Math],
    sortOrder: 80,
  },
  [GradeLevel.Grade7]: {
    level: GradeLevel.Grade7,
    band: GradeBand.Middle,
    display: 'Grade 7',
    ageRange: { min: 12, max: 12 },
    labels: {
      us: 'Grade 7',
      gb: 'Year 7',
      in: 'Class VII',
      lk: 'Grade 7',
      au: 'Year 7',
      global: 'Grade 7',
    },
    milestones: [GradeMilestone.NYS_Grades3to8_ELA, GradeMilestone.NYS_Grades3to8_Math],
    sortOrder: 90,
  },
  [GradeLevel.Grade8]: {
    level: GradeLevel.Grade8,
    band: GradeBand.Middle,
    display: 'Grade 8',
    ageRange: { min: 13, max: 13 },
    labels: {
      us: 'Grade 8',
      gb: 'Year 8',
      in: 'Class VIII',
      lk: 'Grade 8',
      au: 'Year 8',
      global: 'Grade 8',
    },
    milestones: [GradeMilestone.NYS_Grades3to8_ELA, GradeMilestone.NYS_Grades3to8_Math],
    sortOrder: 100,
  },
  [GradeLevel.Grade9]: {
    level: GradeLevel.Grade9,
    band: GradeBand.Secondary,
    display: 'Grade 9',
    ageRange: { min: 14, max: 14 },
    labels: {
      us: 'Grade 9',
      gb: 'Year 9',
      in: 'Class IX',
      lk: 'Grade 9',
      au: 'Year 9',
      global: 'Grade 9',
    },
    milestones: [GradeMilestone.NYS_Regents],
    sortOrder: 110,
  },
  [GradeLevel.Grade10]: {
    level: GradeLevel.Grade10,
    band: GradeBand.Secondary,
    display: 'Grade 10',
    ageRange: { min: 15, max: 15 },
    labels: {
      us: 'Grade 10',
      gb: 'Year 10 (GCSE)',
      in: 'Class X',
      lk: 'Grade 10 (O/L prep)',
      au: 'Year 10',
      global: 'Grade 10',
    },
    milestones: [
      GradeMilestone.SriLanka_OL_Prep,
      GradeMilestone.UK_GCSE,
      GradeMilestone.NYS_Regents,
    ],
    sortOrder: 120,
  },
  [GradeLevel.Grade11]: {
    level: GradeLevel.Grade11,
    band: GradeBand.Secondary,
    display: 'Grade 11',
    ageRange: { min: 16, max: 16 },
    labels: {
      us: 'Grade 11',
      gb: 'Year 11 (GCSE)',
      in: 'Class XI',
      lk: 'Grade 11 (O/L exam)',
      au: 'Year 11',
      global: 'Grade 11',
    },
    milestones: [
      GradeMilestone.SriLanka_OL_Exam,
      GradeMilestone.ExamYear,
      GradeMilestone.UK_GCSE,
      GradeMilestone.NYS_Regents,
    ],
    sortOrder: 130,
  },
  [GradeLevel.Grade12]: {
    level: GradeLevel.Grade12,
    band: GradeBand.Secondary,
    display: 'Grade 12',
    ageRange: { min: 17, max: 18 },
    labels: {
      us: 'Grade 12',
      gb: 'Year 12',
      in: 'Class XII',
      lk: 'Grade 12 (A/L year 1)',
      au: 'Year 12',
      global: 'Grade 12',
    },
    milestones: [
      GradeMilestone.SriLanka_AL_Year1,
      GradeMilestone.UK_ALevels,
      GradeMilestone.NYS_Regents,
    ],
    sortOrder: 140,
  },
  [GradeLevel.Grade13]: {
    level: GradeLevel.Grade13,
    band: GradeBand.Secondary,
    display: 'Grade 13',
    ageRange: { min: 18, max: 19 },
    labels: {
      lk: 'Grade 13 (A/L year 2)',
      global: 'Grade 13',
    },
    milestones: [GradeMilestone.SriLanka_AL_Year2, GradeMilestone.ExamYear],
    sortOrder: 150,
  },
  [GradeLevel.Undergraduate]: {
    level: GradeLevel.Undergraduate,
    band: GradeBand.PostSecondary,
    display: 'Undergraduate',
    ageRange: { min: 18, max: 99 },
    labels: { global: 'Undergraduate' },
    sortOrder: 1000,
  },
  [GradeLevel.Graduate]: {
    level: GradeLevel.Graduate,
    band: GradeBand.PostSecondary,
    display: 'Graduate',
    ageRange: { min: 21, max: 99 },
    labels: { global: 'Graduate' },
    sortOrder: 1010,
  },
};

export const COUNTRY_CODE_VALUES: readonly CountryCode[] = [
  'us',
  'gb',
  'in',
  'lk',
  'au',
  'ib',
  'global',
] as const;

const COUNTRY_CODE_ALIASES: Record<string, CountryCode> = {
  us: 'us',
  gb: 'gb',
  uk: 'gb',
  in: 'in',
  india: 'in',
  lk: 'lk',
  sri_lanka: 'lk',
  au: 'au',
  australia: 'au',
  ib: 'ib',
  global: 'global',
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
const gradeLookup = new Map<string, GradeLevel>();
GRADE_LEVEL_ORDER.forEach((level) => {
  const meta = GRADE_META[level];
  gradeLookup.set(normalizeKey(level), level);
  gradeLookup.set(normalizeKey(meta.display), level);
  Object.values(meta.labels).forEach((label) => {
    gradeLookup.set(normalizeKey(label), level);
  });
});

export type GradeLevelOption = GradeLevel | null;

export function gradeLabel(level: GradeLevel, country: CountryCode = 'global'): string {
  const meta = GRADE_META[level];
  return meta.labels[country] ?? meta.display;
}

export function gradeBand(level: GradeLevel): GradeBand {
  return GRADE_META[level].band;
}

export function gradeSortOrder(level: GradeLevel): number {
  return GRADE_META[level].sortOrder;
}

export function hasMilestone(level: GradeLevel, milestone: GradeMilestone): boolean {
  const m = GRADE_META[level].milestones ?? [];
  return m.includes(milestone);
}

export function normalizeCountryCode(value?: string | null): CountryCode {
  if (!value) {
    return 'global';
  }
  const normalized = value.toLowerCase();
  if (normalized in COUNTRY_CODE_ALIASES) {
    return COUNTRY_CODE_ALIASES[normalized];
  }
  if (COUNTRY_CODE_VALUES.includes(normalized as CountryCode)) {
    return normalized as CountryCode;
  }
  return 'global';
}

export function parseGradeLevel(raw?: string | null): GradeLevel | null {
  if (!raw) {
    return null;
  }
  const normalized = normalizeKey(raw);
  return gradeLookup.get(normalized) ?? null;
}

export function allGrades(includePostSecondary = true): GradeLevel[] {
  return GRADE_LEVEL_ORDER.filter((g) => {
    if (includePostSecondary) return true;
    return ![GradeLevel.Undergraduate, GradeLevel.Graduate].includes(g);
  });
}

export function optionsForCountry(
  country: CountryCode,
  includePostSecondary = true,
): Array<{ value: GradeLevel; label: string }> {
  return allGrades(includePostSecondary).map((level) => ({
    value: level,
    label: gradeLabel(level, country),
  }));
}
