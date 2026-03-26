import * as React from 'react';
import { Briefcase, Check, X } from 'lucide-react';

import {
  DAY_KEYS,
  type DayAvailability,
  type StaffProfileSaveInput,
  type StaffProfileVM,
} from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import { UserSettingsTabSection } from '@iconicedu/ui-web/components/sidebar/user-settings/components/user-settings-tab-section';
import { AvailabilityScheduler } from '@iconicedu/ui-web/components/shared/availability-scheduler';
import { BorderBeam } from '@iconicedu/ui-web/ui/border-beam';
import { useSequentialHighlight } from '@iconicedu/ui-web/components/sidebar/user-settings/hooks/use-sequential-highlight';

const SPECIALTY_OPTIONS = [
  'Scheduling',
  'Billing',
  'Onboarding',
  'Customer success',
  'Curriculum design',
  'Operations',
  'Mentorship',
  'Technical support',
  'Program management',
];

const normalizeSpecialties = (values?: string[] | null) =>
  Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));

const AVAILABILITY_DAY_OPTIONS = DAY_KEYS.map((key) => ({ key, label: key }));

const DEFAULT_WORKING_HOURS = Array.from({ length: 9 }, (_, index) => 9 + index);
const createDefaultAvailability = (): DayAvailability => {
  return DAY_KEYS.reduce<DayAvailability>((acc, day) => {
    acc[day] = [...DEFAULT_WORKING_HOURS];
    return acc;
  }, {} as DayAvailability);
};

type StaffProfileTabProps = {
  staffProfile: StaffProfileVM;
  isStaffOnboarding?: boolean;
  onSave?: (input: StaffProfileSaveInput) => Promise<void> | void;
};

export function StaffProfileTab({
  staffProfile,
  isStaffOnboarding = false,
  onSave,
}: StaffProfileTabProps) {
  const [department, setDepartment] = React.useState(staffProfile.department ?? '');
  const [jobTitle, setJobTitle] = React.useState(staffProfile.jobTitle ?? '');
  const [specialties, setSpecialties] = React.useState<string[]>(() =>
    normalizeSpecialties(staffProfile.specialties),
  );
  const [availability, setAvailability] = React.useState<DayAvailability>(
    () => staffProfile.weeklyAvailability ?? createDefaultAvailability(),
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const initialDepartmentRef = React.useRef(staffProfile.department ?? '');
  const initialJobTitleRef = React.useRef(staffProfile.jobTitle ?? '');
  const initialSpecialtiesRef = React.useRef<string>(
    JSON.stringify(normalizeSpecialties(staffProfile.specialties)),
  );
  const initialAvailabilityRef = React.useRef<string>(
    JSON.stringify(staffProfile.weeklyAvailability ?? createDefaultAvailability()),
  );

  React.useEffect(() => {
    setDepartment(staffProfile.department ?? '');
    setJobTitle(staffProfile.jobTitle ?? '');
    initialDepartmentRef.current = staffProfile.department ?? '';
    initialJobTitleRef.current = staffProfile.jobTitle ?? '';
    const normalizedSpecialties = normalizeSpecialties(staffProfile.specialties);
    setSpecialties(normalizedSpecialties);
    initialSpecialtiesRef.current = JSON.stringify(normalizedSpecialties);
    const normalizedAvailability =
      staffProfile.weeklyAvailability ?? createDefaultAvailability();
    setAvailability(normalizedAvailability);
    initialAvailabilityRef.current = JSON.stringify(normalizedAvailability);
  }, [staffProfile]);

  const departmentRoleDescription = React.useMemo(() => {
    if (!department && !jobTitle) {
      return 'Select a department and job title so people know your focus.';
    }
    if (department && jobTitle) {
      return `Department: ${department}. Role: ${jobTitle}.`;
    }
    if (department) {
      return `Department: ${department}.`;
    }
    return `Role: ${jobTitle}.`;
  }, [department, jobTitle]);

  const toggleSpecialty = React.useCallback((value: string) => {
    setSpecialties((current) =>
      current.includes(value)
        ? current.filter((existing) => existing !== value)
        : [...current, value],
    );
  }, []);

  const hasWeeklyAvailability = React.useMemo(
    () =>
      Boolean(availability) &&
      DAY_KEYS.some((day) => (availability[day]?.length ?? 0) > 0),
    [availability],
  );
  const sequentialStaffHighlight = useSequentialHighlight<'availability'>({
    order: ['availability'],
    satisfied: {
      availability: hasWeeklyAvailability,
    },
    enabled: isStaffOnboarding,
  });
  const showAvailabilityBeam = sequentialStaffHighlight.isActive('availability');

  const availabilitySubtitle = React.useMemo(() => {
    return (
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {AVAILABILITY_DAY_OPTIONS.map(({ key, label }) => {
          const hasSlots = Boolean(availability[key]?.length);
          const Icon = hasSlots ? Check : X;
          return (
            <span key={key} className="inline-flex items-center gap-1">
              <Icon
                className={hasSlots ? 'size-3 text-primary' : 'size-3 text-destructive'}
              />
              {label}
            </span>
          );
        })}
      </div>
    );
  }, [availability]);

  const handleSave = React.useCallback(async () => {
    if (!onSave) {
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await onSave({
        profileId: staffProfile.ids.id,
        orgId: staffProfile.ids.orgId,
        department: department || null,
        jobTitle: jobTitle || null,
        weeklyAvailability: availability,
        specialties: specialties.length ? specialties : null,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to save staff profile.',
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [
    onSave,
    department,
    jobTitle,
    availability,
    specialties,
    staffProfile.ids.id,
    staffProfile.ids.orgId,
  ]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Staff profile</h3>
        <p className="text-sm text-muted-foreground">Department and role details.</p>
      </div>
      <UserSettingsTabSection
        title="Department & role"
        subtitle={departmentRoleDescription}
        icon={<Briefcase className="h-5 w-5" />}
        footer={
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="rounded-full">
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="staff-department">Department</Label>
            <Input
              id="staff-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Customer success"
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="staff-job-title">Job title</Label>
            <Input
              id="staff-job-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Support specialist"
              className="w-full"
            />
          </div>
          <p className="text-xs text-muted-foreground">{departmentRoleDescription}</p>
          <div className="flex flex-col gap-3">
            <Label>Specialties</Label>
            <div className="relative w-full rounded-xl border border-transparent">
              <div className="grid gap-2 sm:grid-cols-2">
                {SPECIALTY_OPTIONS.map((option) => {
                  const isSelected = specialties.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleSpecialty(option)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-foreground/60'
                      }`}
                    >
                      <span>{option}</span>
                      {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </UserSettingsTabSection>
      <UserSettingsTabSection
        title="Weekly availability"
        subtitle={availabilitySubtitle}
        icon={<Briefcase className="h-5 w-5" />}
        defaultOpen={isStaffOnboarding}
        footer={
          <div className="flex flex-col gap-2">
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
                  disabled={isSaving}
                  className="relative z-10 rounded-full"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        }
        showSeparator={false}
      >
        <AvailabilityScheduler value={availability} onChange={setAvailability} />
        {errorMessage ? (
          <p className="mt-2 text-xs text-destructive">{errorMessage}</p>
        ) : null}
      </UserSettingsTabSection>
    </div>
  );
}
