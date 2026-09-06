'use client';

import * as React from 'react';
import { CalendarDays, Check, SlidersHorizontal, User, Users, X } from 'lucide-react';

import { BorderBeam } from '@iconicedu/ui-web/ui/border-beam';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Slider } from '@iconicedu/ui-web/ui/slider';
import { Label } from '@iconicedu/ui-web/ui/label';
import { UserSettingsTabSection } from '@iconicedu/ui-web/components/sidebar/user-settings/components/user-settings-tab-section';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { AvailabilityScheduler } from '@iconicedu/ui-web/components/shared/availability-scheduler';
import {
  DAY_KEYS,
  EMPTY_DAY_AVAILABILITY,
  type DayAvailability,
  type EducatorAvailabilityInput,
  type EducatorAvailabilityVM,
} from '@iconicedu/shared-types';
import { useSequentialHighlight } from '@iconicedu/ui-web/components/sidebar/user-settings/hooks/use-sequential-highlight';

const CLASS_TYPE_OPTIONS = [
  { value: 'one-one', label: 'One-on-one', icon: User },
  { value: 'small-groups', label: 'Small groups', icon: Users },
] as const;

type ClassTypeOption = (typeof CLASS_TYPE_OPTIONS)[number];
type ClassTypeValue = ClassTypeOption['value'];

const AVAILABILITY_DAY_OPTIONS = DAY_KEYS.map((key) => ({ key, label: key }));

interface CommitmentSegment {
  label: 'Light' | 'Moderate' | 'Substantial' | 'Full-time';
  min: number;
  max: number;
  trackClass: string;
  textClass: string;
}

const COMMITMENT_SEGMENTS: CommitmentSegment[] = [
  {
    label: 'Light',
    min: 0,
    max: 10,
    trackClass: 'bg-success',
    textClass: 'text-success',
  },
  {
    label: 'Moderate',
    min: 10,
    max: 20,
    trackClass: 'bg-info',
    textClass: 'text-info',
  },
  {
    label: 'Substantial',
    min: 20,
    max: 30,
    trackClass: 'bg-warning',
    textClass: 'text-warning',
  },
  {
    label: 'Full-time',
    min: 30,
    max: 40,
    trackClass: 'bg-destructive',
    textClass: 'text-destructive',
  },
];

type EducatorAvailabilityTabProps = {
  initialClassTypes?: EducatorAvailabilityVM['classTypes'];
  initialWeeklyCommitment?: EducatorAvailabilityVM['weeklyCommitment'];
  initialAvailability?: EducatorAvailabilityVM['availability'];
  onSave?: (input: EducatorAvailabilityInput) => Promise<void> | void;
  isEducatorAvailabilityOnboarding?: boolean;
};

export function EducatorAvailabilityTab({
  initialClassTypes,
  initialWeeklyCommitment = 10,
  initialAvailability,
  onSave,
  isEducatorAvailabilityOnboarding = false,
}: EducatorAvailabilityTabProps) {
  const normalizeClassTypes = React.useCallback(
    (values?: EducatorAvailabilityVM['classTypes']): ClassTypeValue[] => {
      return (values ?? []).filter((value): value is ClassTypeValue =>
        CLASS_TYPE_OPTIONS.some((option) => option.value === value),
      );
    },
    [],
  );

  const [selectedClassTypes, setSelectedClassTypes] = React.useState<ClassTypeValue[]>(
    normalizeClassTypes(initialClassTypes),
  );
  const [weeklyCommitment, setWeeklyCommitment] = React.useState(
    initialWeeklyCommitment ?? 10,
  );
  const [availability, setAvailability] = React.useState<DayAvailability>(
    initialAvailability ?? EMPTY_DAY_AVAILABILITY,
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const hasAvailability = React.useMemo(
    () => DAY_KEYS.some((day) => Boolean(availability[day]?.length)),
    [availability],
  );
  const sequentialAvailabilityHighlight = useSequentialHighlight<'availability'>({
    order: ['availability'],
    satisfied: {
      availability: hasAvailability,
    },
    enabled: isEducatorAvailabilityOnboarding,
  });
  const showAvailabilityBeam = sequentialAvailabilityHighlight.isActive('availability');
  const isTeachingPreferencesDisabled =
    isEducatorAvailabilityOnboarding && !hasAvailability;

  React.useEffect(() => {
    setSelectedClassTypes(normalizeClassTypes(initialClassTypes));
    setWeeklyCommitment(initialWeeklyCommitment ?? 10);
    setAvailability(initialAvailability ?? EMPTY_DAY_AVAILABILITY);
  }, [
    initialAvailability,
    initialClassTypes,
    initialWeeklyCommitment,
    normalizeClassTypes,
  ]);

  const toggleClassType = React.useCallback((value: ClassTypeValue) => {
    setSelectedClassTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!onSave) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        classTypes: selectedClassTypes,
        weeklyCommitment,
        availability,
      });
    } finally {
      setIsSaving(false);
    }
  }, [availability, onSave, selectedClassTypes, weeklyCommitment]);

  const handleWeeklyChange = React.useCallback((values: number[]) => {
    const nextValue = values[0] ?? 0;
    setWeeklyCommitment(nextValue);
  }, []);

  const handleWeeklyInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      if (Number.isNaN(parsed)) {
        return;
      }
      setWeeklyCommitment(Math.min(Math.max(parsed, 0), 40));
    },
    [],
  );

  const activeCommitmentSegment = React.useMemo(() => {
    return (
      COMMITMENT_SEGMENTS.find((segment) => weeklyCommitment <= segment.max) ??
      COMMITMENT_SEGMENTS[COMMITMENT_SEGMENTS.length - 1]
    );
  }, [weeklyCommitment]);

  const getSegmentFillPercent = React.useCallback(
    (segment: CommitmentSegment) => {
      if (weeklyCommitment <= segment.min) {
        return 0;
      }
      if (weeklyCommitment >= segment.max) {
        return 100;
      }
      return ((weeklyCommitment - segment.min) / (segment.max - segment.min)) * 100;
    },
    [weeklyCommitment],
  );

  const classPreferencesSubtitle = React.useMemo(() => {
    const classSummary =
      selectedClassTypes
        .map(
          (value) => CLASS_TYPE_OPTIONS.find((option) => option.value === value)?.label,
        )
        .filter(Boolean)
        .join(', ') || 'Class types not set';
    return `${classSummary} · ${weeklyCommitment} hrs/week`;
  }, [selectedClassTypes, weeklyCommitment]);

  const availabilitySubtitle = React.useMemo(() => {
    return (
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {AVAILABILITY_DAY_OPTIONS.map(({ key, label }) => {
          const hasSlots = Boolean(availability[key]?.length);
          const Icon = hasSlots ? Check : X;
          return (
            <span key={key} className="inline-flex items-center gap-1">
              <Icon
                className={cn('size-3', hasSlots ? 'text-primary' : 'text-destructive')}
              />
              {label}
            </span>
          );
        })}
      </div>
    );
  }, [availability]);

  return (
    <div className="space-y-4">
      <UserSettingsTabSection
        title="Teaching Preferences"
        subtitle={classPreferencesSubtitle}
        icon={<SlidersHorizontal className="h-5 w-5" />}
        disabled={isTeachingPreferencesDisabled}
        footer={
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!onSave || isSaving}
              className="relative z-10"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Preferred class types</Label>
            <div className="flex flex-wrap gap-2">
              {selectedClassTypes.map((value) => {
                const option = CLASS_TYPE_OPTIONS.find((entry) => entry.value === value);
                if (!option) {
                  return null;
                }

                const Icon = option.icon;
                return (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                  >
                    <Icon className="size-3 text-muted-foreground" />
                    <span>{option.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedClassTypes((prev) =>
                          prev.filter((entry) => entry !== value),
                        )
                      }
                      aria-label={`Remove ${option.label}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CLASS_TYPE_OPTIONS.map((option) => {
                const isSelected = selectedClassTypes.includes(option.value);
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleClassType(option.value)}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition',
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-foreground/60',
                    )}
                    aria-pressed={isSelected}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-4" />
                      {option.label}
                    </span>
                    {isSelected ? <Check className="size-3" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Weekly commitment</h4>
              <span className="text-xs text-muted-foreground">
                1 - 40 hours available
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Slider
                  id="weekly-commitment"
                  value={[weeklyCommitment]}
                  min={0}
                  max={40}
                  step={1}
                  onValueChange={handleWeeklyChange}
                  className="h-3 rounded-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <Input
                  id="weekly-commitment-input"
                  type="number"
                  min={0}
                  max={40}
                  value={weeklyCommitment}
                  onChange={handleWeeklyInputChange}
                  className="w-20 text-center"
                />
                <span className="text-xs text-muted-foreground">hrs/week</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <span className={cn('font-semibold', activeCommitmentSegment.textClass)}>
                  {activeCommitmentSegment.label}
                </span>{' '}
                commitment
              </span>
              <span className="text-muted-foreground">{weeklyCommitment} hrs/week</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
                {COMMITMENT_SEGMENTS.map((segment) => (
                  <span
                    key={segment.label}
                    className={cn(
                      'flex-1 text-center font-semibold',
                      activeCommitmentSegment.label === segment.label
                        ? segment.textClass
                        : 'text-muted-foreground',
                    )}
                  >
                    {segment.label}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                {COMMITMENT_SEGMENTS.map((segment) => (
                  <div
                    key={segment.label}
                    className="flex-1 h-1 rounded-full bg-muted-foreground/30 overflow-hidden"
                  >
                    <div
                      className={cn('h-full', segment.trackClass)}
                      style={{ width: `${getSegmentFillPercent(segment)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </UserSettingsTabSection>
      <UserSettingsTabSection
        title="Teaching Availability"
        subtitle={availabilitySubtitle}
        icon={<CalendarDays className="h-5 w-5" />}
        defaultOpen={isEducatorAvailabilityOnboarding}
        showSeparator={false}
        footer={
          <div className="flex justify-end">
            <div className="relative inline-flex rounded-full">
              {showAvailabilityBeam ? (
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
                onClick={handleSave}
                disabled={!onSave || isSaving}
                className="relative z-10"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Click a day to select when you’re available to teach. You can update this
              anytime.
            </p>
            <AvailabilityScheduler value={availability} onChange={setAvailability} />
          </div>
        </div>
      </UserSettingsTabSection>
    </div>
  );
}
