'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  toast,
} from '@iconicedu/ui-web';
import { Users, X } from 'lucide-react';

export type UserEditInitialData = {
  accountId: string;
  profileId: string | null;
  orgId: string;
  kind: string | null;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  bio: string;
  primaryRole: string;
  roleStatus: string;
  timezone: string;
  countryName: string;
  // child
  birthYear: number | null;
  schoolName: string;
  schoolYear: string;
  interests: string[];
  strengths: string[];
  learningPreferences: string[];
  confidenceLevel: string;
  guardianNames: string[];
  // educator
  headline: string;
  education: string;
  experienceYears: number | null;
  // staff
  jobTitle: string;
  department: string;
  // guardian
  linkedChildNames: string[];
};

const ROLE_OPTIONS = [
  { value: 'guardian', label: 'Parent' },
  { value: 'educator', label: 'Tutor' },
  { value: 'child', label: 'Student' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
];

const ROLE_STATUS_OPTIONS = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'pending', label: 'Pending review' },
  { value: 'active', label: 'Approved' },
  { value: 'blocked', label: 'Blocked' },
];

const CONFIDENCE_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = React.useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
          className="h-8 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
  );
}

export function UserEditForm({
  orgSlug,
  initialData,
}: {
  orgSlug: string;
  initialData: UserEditInitialData;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  // Common fields
  const [email, setEmail] = React.useState(initialData.email);
  const [displayName, setDisplayName] = React.useState(initialData.displayName);
  const [firstName, setFirstName] = React.useState(initialData.firstName);
  const [lastName, setLastName] = React.useState(initialData.lastName);
  const [bio, setBio] = React.useState(initialData.bio);
  const [primaryRole, setPrimaryRole] = React.useState(
    initialData.primaryRole || 'unassigned',
  );
  const [roleStatus, setRoleStatus] = React.useState(
    initialData.roleStatus || 'unassigned',
  );

  // Child fields
  const [birthYear, setBirthYear] = React.useState(
    initialData.birthYear ? String(initialData.birthYear) : '',
  );
  const [schoolName, setSchoolName] = React.useState(initialData.schoolName);
  const [schoolYear, setSchoolYear] = React.useState(initialData.schoolYear);
  const [interests, setInterests] = React.useState(initialData.interests);
  const [strengths, setStrengths] = React.useState(initialData.strengths);
  const [learningPreferences, setLearningPreferences] = React.useState(
    initialData.learningPreferences,
  );
  const [confidenceLevel, setConfidenceLevel] = React.useState(
    initialData.confidenceLevel,
  );

  // Educator fields
  const [headline, setHeadline] = React.useState(initialData.headline);
  const [education, setEducation] = React.useState(initialData.education);
  const [experienceYears, setExperienceYears] = React.useState(
    initialData.experienceYears ? String(initialData.experienceYears) : '',
  );

  // Staff fields
  const [jobTitle, setJobTitle] = React.useState(initialData.jobTitle);
  const [department, setDepartment] = React.useState(initialData.department);

  const handleSave = async () => {
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    setSaving(true);
    try {
      // 1. Update common fields (email, name, role)
      const baseRes = await fetch('/api/admin/users/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: initialData.accountId,
          email: email.trim(),
          displayName: displayName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          primaryRole,
          roleStatus,
        }),
      });
      const baseJson = await baseRes.json();
      if (!baseRes.ok || !baseJson.success) {
        throw new Error(baseJson.message ?? 'Failed to update account');
      }

      // 2. Update role-specific extended fields
      if (initialData.profileId && initialData.kind) {
        const extPayload: Record<string, unknown> = {
          accountId: initialData.accountId,
          profileId: initialData.profileId,
          orgId: initialData.orgId,
          kind: initialData.kind,
        };

        if (initialData.kind === 'child') {
          Object.assign(extPayload, {
            birthYear: birthYear ? Number(birthYear) : null,
            schoolName: schoolName.trim(),
            schoolYear: schoolYear.trim(),
            interests,
            strengths,
            learningPreferences,
            confidenceLevel: confidenceLevel.trim(),
          });
        } else if (initialData.kind === 'educator') {
          Object.assign(extPayload, {
            headline: headline.trim(),
            bio: bio.trim(),
            education: education.trim(),
            experienceYears: experienceYears ? Number(experienceYears) : null,
          });
        } else if (initialData.kind === 'staff') {
          Object.assign(extPayload, {
            jobTitle: jobTitle.trim(),
            department: department.trim(),
          });
        }

        const extRes = await fetch('/api/admin/users/update-profile-ext', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(extPayload),
        });
        const extJson = await extRes.json();
        if (!extRes.ok || !extJson.success) {
          throw new Error(extJson.message ?? 'Failed to update profile details');
        }
      }

      toast.success('Profile saved');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const kind = initialData.kind;

  return (
    <div className="space-y-8">
      {/* Account section */}
      <div className="rounded-xl border divide-y">
        <div className="p-5">
          <SectionHeader
            title="Account"
            description="Login email and account role assignment."
          />
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-email" className="text-xs text-muted-foreground">
              Email
            </Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role" className="text-xs text-muted-foreground">
                Role
              </Label>
              <Select value={primaryRole} onValueChange={setPrimaryRole}>
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role-status" className="text-xs text-muted-foreground">
                Role status
              </Label>
              <Select value={roleStatus} onValueChange={setRoleStatus}>
                <SelectTrigger id="edit-role-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Profile section */}
      <div className="rounded-xl border divide-y">
        <div className="p-5">
          <SectionHeader title="Profile" description="Name and identity information." />
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-display-name" className="text-xs text-muted-foreground">
              Display name
            </Label>
            <Input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first-name" className="text-xs text-muted-foreground">
                First name
              </Label>
              <Input
                id="edit-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-last-name" className="text-xs text-muted-foreground">
                Last name
              </Label>
              <Input
                id="edit-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>
          {(kind === 'educator' || kind === 'guardian' || kind === 'staff') && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-bio" className="text-xs text-muted-foreground">
                Bio
              </Label>
              <Textarea
                id="edit-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short bio"
                rows={3}
              />
            </div>
          )}
        </div>
      </div>

      {/* Child-specific section */}
      {kind === 'child' && (
        <div className="rounded-xl border divide-y">
          <div className="p-5">
            <SectionHeader
              title="Student details"
              description="Academic and learning profile for this student."
            />
          </div>
          <div className="p-5 space-y-4">
            {initialData.guardianNames.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Parents</p>
                <div className="flex flex-wrap gap-1.5">
                  {initialData.guardianNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      <Users className="h-3 w-3 shrink-0" aria-hidden />
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-birth-year"
                  className="text-xs text-muted-foreground"
                >
                  Birth year
                </Label>
                <Input
                  id="edit-birth-year"
                  type="number"
                  min={1980}
                  max={new Date().getFullYear()}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="e.g. 2015"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-confidence"
                  className="text-xs text-muted-foreground"
                >
                  Confidence level
                </Label>
                <Select value={confidenceLevel} onValueChange={setConfidenceLevel}>
                  <SelectTrigger id="edit-confidence">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIDENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-school-name"
                  className="text-xs text-muted-foreground"
                >
                  School name
                </Label>
                <Input
                  id="edit-school-name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Springfield Elementary"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-school-year"
                  className="text-xs text-muted-foreground"
                >
                  School year
                </Label>
                <Input
                  id="edit-school-year"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  placeholder="e.g. Grade 5 / Year 6"
                />
              </div>
            </div>
            <TagInput
              label="Interests"
              values={interests}
              onChange={setInterests}
              placeholder="Add interest and press Enter"
            />
            <TagInput
              label="Strengths"
              values={strengths}
              onChange={setStrengths}
              placeholder="Add strength and press Enter"
            />
            <TagInput
              label="Learning preferences"
              values={learningPreferences}
              onChange={setLearningPreferences}
              placeholder="Add preference and press Enter"
            />
          </div>
        </div>
      )}

      {/* Guardian-specific section */}
      {kind === 'guardian' && initialData.linkedChildNames.length > 0 && (
        <div className="rounded-xl border divide-y">
          <div className="p-5">
            <SectionHeader
              title="Linked children"
              description="Students linked to this parent account."
            />
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-1.5">
              {initialData.linkedChildNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <Users className="h-3 w-3 shrink-0" aria-hidden />
                  {name}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              To link or unlink children, use the Families section.
            </p>
          </div>
        </div>
      )}

      {/* Educator-specific section */}
      {kind === 'educator' && (
        <div className="rounded-xl border divide-y">
          <div className="p-5">
            <SectionHeader
              title="Tutor profile"
              description="Professional details shown to students and parents."
            />
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-headline" className="text-xs text-muted-foreground">
                Headline
              </Label>
              <Input
                id="edit-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Maths specialist · 8 years experience"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-education" className="text-xs text-muted-foreground">
                  Education
                </Label>
                <Input
                  id="edit-education"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="e.g. BSc Mathematics, Oxford"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-exp-years" className="text-xs text-muted-foreground">
                  Years of experience
                </Label>
                <Input
                  id="edit-exp-years"
                  type="number"
                  min={0}
                  max={60}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff-specific section */}
      {kind === 'staff' && (
        <div className="rounded-xl border divide-y">
          <div className="p-5">
            <SectionHeader
              title="Staff details"
              description="Role within the organisation."
            />
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-job-title" className="text-xs text-muted-foreground">
                  Job title
                </Label>
                <Input
                  id="edit-job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Operations Manager"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-department"
                  className="text-xs text-muted-foreground"
                >
                  Department
                </Label>
                <Input
                  id="edit-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Academic"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${orgSlug}/admin/users`)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
