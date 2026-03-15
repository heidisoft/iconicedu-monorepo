'use client';

import * as React from 'react';
import { Briefcase, Check, SlidersHorizontal, User, X } from 'lucide-react';

import type {
  CountryCode,
  EducatorProfileSaveInput,
  EducatorProfileVM,
  GradeLevel,
} from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import { Label } from '@iconicedu/ui-web/ui/label';
import { UserSettingsTabSection } from '@iconicedu/ui-web/components/sidebar/user-settings/components/user-settings-tab-section';
import { BorderBeam } from '@iconicedu/ui-web/ui/border-beam';
import { useSequentialHighlight } from '@iconicedu/ui-web/components/sidebar/user-settings/hooks/use-sequential-highlight';
import {
  GRADE_META,
  gradeLabel,
  normalizeCountryCode,
  optionsForCountry,
  STANDARD_SUBJECT_OPTIONS,
} from '@iconicedu/shared-types';

const listToString = (items?: string[] | null) => (items ?? []).join(', ');

const stringToList = (value: string) =>
  value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

const AGE_GROUP_OPTIONS = [
  'Toddlers',
  'Preschool',
  'Early elementary',
  'Upper elementary',
  'Middle school',
  'High school',
  'Adults',
];

const CURRICULUM_TAG_OPTIONS = [
  'Project-based learning',
  'Interdisciplinary',
  'Social-emotional',
  'Literacy',
  'Numeracy',
  'STEAM',
  'Inquiry-based',
  'Culturally responsive',
  'Differentiated',
];

const isValidGradeLevel = (value?: GradeLevel | null): value is GradeLevel =>
  typeof value === 'string' && Boolean(GRADE_META[value as GradeLevel]);

const sanitizeGrades = (grades?: GradeLevel[] | null): GradeLevel[] =>
  (grades ?? []).filter(isValidGradeLevel);

type EducatorProfileTabProps = {
  educatorProfile: EducatorProfileVM;
  subjectOptions?: string[];
  fallbackCountryCode?: string | null;
  onSave?: (input: EducatorProfileSaveInput) => Promise<void> | void;
  isEducatorOnboarding?: boolean;
};

export function EducatorProfileTab({
  educatorProfile,
  subjectOptions = [...STANDARD_SUBJECT_OPTIONS],
  fallbackCountryCode,
  onSave,
  isEducatorOnboarding = false,
}: EducatorProfileTabProps) {
  const educatorCountryCode = React.useMemo<CountryCode>(
    () =>
      normalizeCountryCode(educatorProfile.location?.countryCode ?? fallbackCountryCode),
    [educatorProfile.location?.countryCode, fallbackCountryCode],
  );
  const gradeOptions = React.useMemo(
    () => optionsForCountry(educatorCountryCode),
    [educatorCountryCode],
  );

  const [headlineValue, setHeadlineValue] = React.useState(
    educatorProfile.headline ?? '',
  );
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>(
    educatorProfile.subjects ?? [],
  );
  const [selectedGrades, setSelectedGrades] = React.useState<GradeLevel[]>(
    sanitizeGrades(educatorProfile.gradesSupported),
  );
  const [videoValue, setVideoValue] = React.useState(
    educatorProfile.featuredVideoIntroUrl ?? '',
  );
  const toggleSelection = React.useCallback(
    <T,>(value: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      setter((prev) =>
        prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
      );
    },
    [],
  );
  const [experienceValue, setExperienceValue] = React.useState(
    educatorProfile.experienceYears?.toString() ?? '',
  );
  const [educationValue, setEducationValue] = React.useState(
    educatorProfile.education ?? '',
  );
  const [certificationsValue, setCertificationsValue] = React.useState(
    listToString(educatorProfile.certifications?.map((cert) => cert.name) ?? []),
  );
  const [selectedAgeGroups, setSelectedAgeGroups] = React.useState<string[]>(
    educatorProfile.ageGroupsComfortableWith ?? [],
  );
  const [selectedCurriculumTags, setSelectedCurriculumTags] = React.useState<string[]>(
    educatorProfile.curriculumTags ?? [],
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [basicInfoOpen, setBasicInfoOpen] = React.useState(Boolean(isEducatorOnboarding));
  const sequentialEducatorHighlight = useSequentialHighlight<
    'headline' | 'subjects' | 'grades'
  >({
    order: ['headline', 'subjects', 'grades'],
    satisfied: {
      headline: Boolean(headlineValue.trim()),
      subjects: selectedSubjects.length > 0,
      grades: selectedGrades.length > 0,
    },
    enabled: isEducatorOnboarding,
  });
  const showSubjectsBeam = sequentialEducatorHighlight.isActive('subjects');
  const showGradesBeam = sequentialEducatorHighlight.isActive('grades');
  const showEducatorActionBeam =
    isEducatorOnboarding &&
    selectedSubjects.length > 0 &&
    selectedGrades.length > 0 &&
    !isSaving;
  const isBasicInfoComplete = selectedSubjects.length > 0 && selectedGrades.length > 0;
  const areAdditionalSectionsDisabled = isEducatorOnboarding && !isBasicInfoComplete;

  React.useEffect(() => {
    if (isEducatorOnboarding && !isBasicInfoComplete) {
      setBasicInfoOpen(true);
    }
  }, [isBasicInfoComplete, isEducatorOnboarding]);

  const handleBasicInfoOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (isEducatorOnboarding && !isBasicInfoComplete && !nextOpen) {
        return;
      }
      setBasicInfoOpen(nextOpen);
    },
    [isBasicInfoComplete, isEducatorOnboarding],
  );

  React.useEffect(() => {
    setHeadlineValue(educatorProfile.headline ?? '');
    setSelectedSubjects(educatorProfile.subjects ?? []);
    setSelectedGrades(sanitizeGrades(educatorProfile.gradesSupported));
    setVideoValue(educatorProfile.featuredVideoIntroUrl ?? '');
    setExperienceValue(educatorProfile.experienceYears?.toString() ?? '');
    setEducationValue(educatorProfile.education ?? '');
    setCertificationsValue(
      listToString(educatorProfile.certifications?.map((cert) => cert.name)),
    );
    setSelectedAgeGroups(educatorProfile.ageGroupsComfortableWith ?? []);
    setSelectedCurriculumTags(educatorProfile.curriculumTags ?? []);
  }, [educatorProfile]);

  const selectedGradeLabels = React.useMemo(
    () => selectedGrades.map((grade) => gradeLabel(grade, educatorCountryCode)),
    [selectedGrades, educatorCountryCode],
  );
  const subjectPickerOptions = React.useMemo(() => {
    const merged = new Map<string, string>();
    [...subjectOptions, ...(educatorProfile.subjects ?? []), ...selectedSubjects].forEach(
      (subject) => {
        const normalized = subject.trim();
        if (!normalized) {
          return;
        }
        const key = normalized.toLowerCase();
        if (!merged.has(key)) {
          merged.set(key, normalized);
        }
      },
    );
    return Array.from(merged.values());
  }, [educatorProfile.subjects, selectedSubjects, subjectOptions]);

  const handleSave = React.useCallback(async () => {
    if (!onSave) {
      return;
    }

    if (!selectedSubjects.length || !selectedGrades.length) {
      setErrorMessage('Subjects and grades are required.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    const experienceNumber = experienceValue.trim() ? Number(experienceValue) : null;
    const sanitizedExperience =
      experienceNumber !== null && Number.isNaN(experienceNumber)
        ? null
        : experienceNumber;

    const gradeLevels =
      selectedGrades.length > 0
        ? selectedGrades.map((grade) => ({
            gradeId: grade,
            gradeLabel: gradeLabel(grade, educatorCountryCode),
          }))
        : null;

    try {
      await onSave({
        profileId: educatorProfile.ids.id,
        orgId: educatorProfile.ids.orgId,
        headline: headlineValue.trim() || null,
        subjects: selectedSubjects,
        gradeLevels,
        featuredVideoIntroUrl: videoValue.trim() || null,
        education: educationValue.trim() || null,
        experienceYears: sanitizedExperience,
        certifications: stringToList(certificationsValue),
        ageGroups: selectedAgeGroups,
        curriculumTags: selectedCurriculumTags,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to save educator profile.',
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [
    educatorCountryCode,
    educatorProfile.ids.id,
    educatorProfile.ids.orgId,
    headlineValue,
    videoValue,
    educationValue,
    experienceValue,
    certificationsValue,
    selectedAgeGroups,
    selectedCurriculumTags,
    onSave,
    selectedSubjects,
    selectedGrades,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Educator profile</h3>
          <p className="text-sm text-muted-foreground">
            Teaching focus, credentials, and specialties.
          </p>
        </div>
      </div>
      <UserSettingsTabSection
        title="Basic info"
        subtitle={
          selectedSubjects.length || selectedGradeLabels.length
            ? [
                selectedSubjects.length
                  ? `Subjects: ${selectedSubjects.join(', ')}`
                  : 'Subjects not set',
                selectedGradeLabels.length
                  ? `Grades: ${selectedGradeLabels.join(', ')}`
                  : 'Grades not set',
              ].join(' · ')
            : 'Subjects and grades not set'
        }
        icon={<User className="h-5 w-5" />}
        open={basicInfoOpen}
        onOpenChange={handleBasicInfoOpenChange}
        footer={
          <div className="flex justify-end">
            <div className="relative inline-flex rounded-full">
              {showEducatorActionBeam ? (
                <BorderBeam
                  size={26}
                  initialOffset={8}
                  borderWidth={2}
                  className="from-transparent via-amber-700 to-transparent"
                  transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                />
              ) : null}
              <Button
                size="sm"
                className="relative z-10"
                onClick={handleSave}
                disabled={
                  isSaving ||
                  !onSave ||
                  !selectedSubjects.length ||
                  !selectedGrades.length
                }
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="settings-educator-headline">Headline</Label>
            <Input
              id="settings-educator-headline"
              value={headlineValue}
              onChange={(event) => setHeadlineValue(event.target.value)}
              placeholder="Short headline"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center gap-1 text-sm">
              <Label>Subjects</Label>
              <span className="text-destructive">*</span>
            </div>
            {!selectedSubjects.length ? (
              <p className="text-xs text-destructive">Select at least one subject.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {selectedSubjects.map((subject) => (
                <span
                  key={subject}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                >
                  {subject}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSubjects((prev) =>
                        prev.filter((entry) => entry !== subject),
                      )
                    }
                    aria-label={`Remove ${subject}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative w-full rounded-xl overflow-hidden">
              {showSubjectsBeam ? (
                <BorderBeam
                  size={52}
                  initialOffset={8}
                  borderWidth={2}
                  className="from-transparent via-amber-700 to-transparent"
                  transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                />
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {subjectPickerOptions.map((option) => {
                  const isSelected = selectedSubjects.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-foreground/60'
                      }`}
                      onClick={() => toggleSelection(option, setSelectedSubjects)}
                    >
                      <span>{option}</span>
                      {isSelected ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center gap-1 text-sm">
              <Label>Grades supported</Label>
              <span className="text-destructive">*</span>
            </div>
            {!selectedGrades.length ? (
              <p className="text-xs text-destructive">Select at least one grade.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {selectedGrades.map((grade, index) => (
                <span
                  key={grade}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                >
                  {selectedGradeLabels[index] ?? grade}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGrades((prev) => prev.filter((entry) => entry !== grade))
                    }
                    aria-label={`Remove ${selectedGradeLabels[index] ?? grade}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative w-full rounded-xl overflow-hidden">
              {showGradesBeam ? (
                <BorderBeam
                  size={52}
                  initialOffset={8}
                  borderWidth={2}
                  className="from-transparent via-amber-700 to-transparent"
                  transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                />
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {gradeOptions.map((option) => {
                  const isSelected = selectedGrades.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-foreground/60'
                      }`}
                      onClick={() => toggleSelection(option.value, setSelectedGrades)}
                    >
                      <span>{option.label}</span>
                      {isSelected ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="settings-educator-video">Intro video URL</Label>
            <Input
              id="settings-educator-video"
              value={videoValue}
              onChange={(event) => setVideoValue(event.target.value)}
              placeholder="Video intro URL"
            />
          </div>
        </div>
      </UserSettingsTabSection>
      <UserSettingsTabSection
        title="Expertise & background"
        subtitle={
          experienceValue
            ? `${experienceValue} year${experienceValue === '1' ? '' : 's'} experience`
            : 'Years of experience not set'
        }
        icon={<Briefcase className="h-5 w-5" />}
        disabled={areAdditionalSectionsDisabled}
        footer={
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                isSaving || !onSave || !selectedSubjects.length || !selectedGrades.length
              }
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-educator-experience">Experience years</Label>
            <Input
              id="settings-educator-experience"
              type="number"
              value={experienceValue}
              onChange={(event) => setExperienceValue(event.target.value)}
              placeholder="Years of experience"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="settings-educator-education">Education</Label>
            <Textarea
              id="settings-educator-education"
              value={educationValue}
              onChange={(event) => setEducationValue(event.target.value)}
              placeholder="Education background"
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="settings-educator-certifications">Certifications</Label>
            <Textarea
              id="settings-educator-certifications"
              value={certificationsValue}
              onChange={(event) => setCertificationsValue(event.target.value)}
              placeholder="Certifications (comma-separated)"
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      </UserSettingsTabSection>
      <UserSettingsTabSection
        title="Teaching preferences"
        subtitle={
          [
            selectedCurriculumTags.length
              ? `Curriculum: ${selectedCurriculumTags.join(', ')}`
              : null,
            selectedAgeGroups.length
              ? `Age groups: ${selectedAgeGroups.join(', ')}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Not set'
        }
        icon={<SlidersHorizontal className="h-5 w-5" />}
        disabled={areAdditionalSectionsDisabled}
        showSeparator={false}
        footer={
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                isSaving || !onSave || !selectedSubjects.length || !selectedGrades.length
              }
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Age groups comfortable with</Label>
            <div className="flex flex-wrap gap-2">
              {selectedAgeGroups.map((group) => (
                <span
                  key={group}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                >
                  {group}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAgeGroups((prev) =>
                        prev.filter((entry) => entry !== group),
                      )
                    }
                    aria-label={`Remove ${group}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AGE_GROUP_OPTIONS.map((option) => {
                const isSelected = selectedAgeGroups.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-foreground/60'
                    }`}
                    onClick={() => toggleSelection(option, setSelectedAgeGroups)}
                  >
                    <span>{option}</span>
                    {isSelected ? <Check className="h-4 w-4" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <Label>Curriculum tags</Label>
            <div className="flex flex-wrap gap-2">
              {selectedCurriculumTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCurriculumTags((prev) =>
                        prev.filter((entry) => entry !== tag),
                      )
                    }
                    aria-label={`Remove ${tag}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CURRICULUM_TAG_OPTIONS.map((option) => {
                const isSelected = selectedCurriculumTags.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-foreground/60'
                    }`}
                    onClick={() => toggleSelection(option, setSelectedCurriculumTags)}
                  >
                    <span>{option}</span>
                    {isSelected ? <Check className="h-4 w-4" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </UserSettingsTabSection>
      {errorMessage ? (
        <div className="pt-2">
          <p className="text-xs text-destructive">{errorMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
