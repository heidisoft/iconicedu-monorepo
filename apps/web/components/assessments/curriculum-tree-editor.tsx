'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type {
  AssessmentSubjectVM,
  AssessmentDomainVM,
  AssessmentSkillVM,
} from '@iconicedu/shared-types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web';
import {
  BookMarked,
  Check,
  ChevronDown,
  ChevronRight,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useConfirm } from './confirm-dialog';

interface Props {
  subject: AssessmentSubjectVM;
  domains: AssessmentDomainVM[];
  orgId: string;
}

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const DIFFICULTIES = [1, 2, 3, 4, 5];
const DIFFICULTY_LABELS = ['', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

function getApi() {
  return createAssessmentApiClient(createSupabaseBrowserClient());
}

export function CurriculumTreeEditor({ subject, domains: initialDomains, orgId }: Props) {
  const [domains, setDomains] = useState(initialDomains);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainGrade, setNewDomainGrade] = useState(1);
  const [savingDomain, setSavingDomain] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(() => {
    if (initialDomains.length === 0) return null;
    return Math.min(...initialDomains.map((d) => d.grade));
  });

  async function handleAddDomain() {
    if (!newDomainName.trim()) return;
    setSavingDomain(true);
    try {
      const api = getApi();
      const created = await api.createDomain(orgId, {
        subjectId: subject.id,
        name: newDomainName.trim(),
        grade: newDomainGrade,
      });
      setDomains((prev) => [...prev, { ...created, skills: [] }]);
      setNewDomainName('');
      setSelectedGrade(created.grade);
      setNewDomainGrade(1);
      setAddDomainOpen(false);
    } finally {
      setSavingDomain(false);
    }
  }

  // Group domains by grade, sorted grade-first then by orderPosition within each grade
  const gradeGroups = domains.reduce<Record<number, AssessmentDomainVM[]>>((acc, d) => {
    if (!acc[d.grade]) acc[d.grade] = [];
    acc[d.grade].push(d);
    return acc;
  }, {});
  const sortedGrades = Object.keys(gradeGroups)
    .map(Number)
    .sort((a, b) => a - b);
  for (const grade of sortedGrades) {
    gradeGroups[grade].sort((a, b) => a.orderPosition - b.orderPosition);
  }

  const allSkills = domains.flatMap((d) => d.skills ?? []);

  const visibleGrades = selectedGrade !== null ? [selectedGrade] : sortedGrades;

  const visibleDomains = visibleGrades.flatMap((g) => gradeGroups[g] ?? []);
  const visibleSkillCount = visibleDomains.reduce(
    (sum, d) => sum + (d.skills?.length ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Subject title + reactive subtitle */}
      <div className="flex items-center gap-3">
        {subject.icon && (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: subject.color ? `${subject.color}20` : undefined }}
          >
            {subject.icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{subject.name}</h1>
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Pencil className="h-3 w-3" /> Editing
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedGrade !== null ? `Grade ${selectedGrade} · ` : ''}
            {visibleDomains.length} domain{visibleDomains.length !== 1 ? 's' : ''} ·{' '}
            {visibleSkillCount} skill{visibleSkillCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {/* Grade filter */}
        <div className="flex items-center gap-2">
          {sortedGrades.length > 0 && (
            <>
              {sortedGrades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(selectedGrade === g ? null : g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedGrade === g
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Grade {g}
                </button>
              ))}
            </>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddDomainOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Domain
        </Button>
      </div>

      {/* Empty state */}
      {domains.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <BookMarked className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">No domains yet</p>
            <p className="text-sm text-muted-foreground">
              Add a domain to start organising skills by grade level.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddDomainOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Domain
          </Button>
        </div>
      )}

      {/* Grade groups */}
      {visibleGrades.map((grade) => (
        <div key={grade} className="flex flex-col gap-3">
          {/* Domains within this grade */}
          {gradeGroups[grade].map((domain) => (
            <DomainSection
              key={domain.id}
              domain={domain}
              allSkills={allSkills}
              orgId={orgId}
              onSkillsChange={(skills) =>
                setDomains((prev) =>
                  prev.map((d) => (d.id === domain.id ? { ...d, skills } : d)),
                )
              }
            />
          ))}
        </div>
      ))}

      {/* Add domain dialog */}
      <Dialog open={addDomainOpen} onOpenChange={setAddDomainOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Domain</DialogTitle>
            <DialogDescription>
              Domains group related skills within a subject, organised by grade level.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-domain-name">
                Domain name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-domain-name"
                placeholder="e.g. Fractions"
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Grade level</Label>
              <Select
                value={String(newDomainGrade)}
                onValueChange={(v) => setNewDomainGrade(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDomainOpen(false)}
              disabled={savingDomain}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddDomain}
              disabled={savingDomain || !newDomainName.trim()}
            >
              {savingDomain ? 'Adding…' : 'Add domain'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// DomainSection — one bordered container per domain
// ──────────────────────────────────────────────────────────────────────────────

interface DomainSectionProps {
  domain: AssessmentDomainVM;
  allSkills: AssessmentSkillVM[];
  orgId: string;
  onSkillsChange: (skills: AssessmentSkillVM[]) => void;
}

function DomainSection({ domain, allSkills, orgId, onSkillsChange }: DomainSectionProps) {
  const skills = domain.skills ?? [];
  const { confirm, ConfirmDialog } = useConfirm();
  const [collapsed, setCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newSkill, setNewSkill] = useState({
    name: '',
    standard: '',
    description: '',
    difficultyBaseline: 3,
    estimatedTimeSeconds: 90,
  });
  const [savingSkill, setSavingSkill] = useState(false);

  async function handleAddSkill() {
    if (!newSkill.name.trim()) return;
    setSavingSkill(true);
    try {
      const api = getApi();
      const created = await api.createSkill(orgId, {
        domainId: domain.id,
        name: newSkill.name.trim(),
        standard: newSkill.standard || undefined,
        difficultyBaseline: newSkill.difficultyBaseline,
        estimatedTimeSeconds: newSkill.estimatedTimeSeconds,
      });
      onSkillsChange([...skills, created]);
      setNewSkill({
        name: '',
        standard: '',
        description: '',
        difficultyBaseline: 3,
        estimatedTimeSeconds: 90,
      });
      setAddOpen(false);
    } finally {
      setSavingSkill(false);
    }
  }

  async function handleDeleteSkill(skillId: string, skillName: string) {
    const ok = await confirm({
      title: `Delete "${skillName}"?`,
      description:
        'This skill and any linked items will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete skill',
      destructive: true,
    });
    if (!ok) return;
    const api = getApi();
    await api.deleteSkill(skillId, orgId);
    onSkillsChange(skills.filter((s) => s.id !== skillId));
  }

  return (
    <>
      <ConfirmDialog />
      <div className="rounded-xl border overflow-hidden">
        {/* Domain header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-muted/30 border-b">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left group"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-semibold truncate">{domain.name}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              Grade {domain.grade}
            </Badge>
            <span className="text-xs text-muted-foreground shrink-0">
              {skills.length} skill{skills.length !== 1 ? 's' : ''}
            </span>
          </button>

          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-8 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1 h-3 w-3" /> Add skill
          </Button>
        </div>

        {/* Skills list */}
        {!collapsed && (
          <>
            {skills.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No skills yet.{' '}
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="ml-1.5 text-primary hover:underline underline-offset-4"
                >
                  Add the first skill
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {skills.map((skill) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    allSkills={allSkills}
                    orgId={orgId}
                    onDelete={() => handleDeleteSkill(skill.id, skill.name)}
                    onUpdate={(updated) =>
                      onSkillsChange(
                        skills.map((s) => (s.id === updated.id ? updated : s)),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Add skill dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add skill to {domain.name}</DialogTitle>
              <DialogDescription>
                Skills are the most granular unit of learning. Every question must be
                tagged to a skill.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-skill-name">
                  Skill name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-skill-name"
                  placeholder="e.g. Compare fractions with unlike denominators"
                  value={newSkill.name}
                  onChange={(e) => setNewSkill((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-skill-standard">Standard (optional)</Label>
                <Input
                  id="add-skill-standard"
                  placeholder="e.g. CCSS.Math.4.NF.A.2"
                  value={newSkill.standard}
                  onChange={(e) =>
                    setNewSkill((p) => ({ ...p, standard: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-skill-desc">Description (optional)</Label>
                <Textarea
                  id="add-skill-desc"
                  className="resize-none"
                  rows={2}
                  placeholder="What students will learn or practise"
                  value={newSkill.description}
                  onChange={(e) =>
                    setNewSkill((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Baseline difficulty</Label>
                  <Select
                    value={String(newSkill.difficultyBaseline)}
                    onValueChange={(v) =>
                      setNewSkill((p) => ({ ...p, difficultyBaseline: Number(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {DIFFICULTY_LABELS[d]} (Level {d})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-skill-time">Est. time (seconds)</Label>
                  <Input
                    id="add-skill-time"
                    type="number"
                    min={10}
                    value={newSkill.estimatedTimeSeconds}
                    onChange={(e) =>
                      setNewSkill((p) => ({
                        ...p,
                        estimatedTimeSeconds: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddSkill}
                disabled={savingSkill || !newSkill.name.trim()}
              >
                {savingSkill ? 'Adding…' : 'Add skill'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SkillRow — a single row inside a domain section
// ──────────────────────────────────────────────────────────────────────────────

interface SkillRowProps {
  skill: AssessmentSkillVM;
  allSkills: AssessmentSkillVM[];
  orgId: string;
  onDelete: () => void;
  onUpdate: (updated: AssessmentSkillVM) => void;
}

function SkillRow({ skill, allSkills, orgId, onDelete, onUpdate }: SkillRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: skill.name,
    standard: skill.standard ?? '',
    description: skill.description ?? '',
    difficultyBaseline: skill.difficultyBaseline,
    estimatedTimeSeconds: skill.estimatedTimeSeconds,
  });
  const [saving, setSaving] = useState(false);
  const [prereqOpen, setPrereqOpen] = useState(false);
  const [prereqSearch, setPrereqSearch] = useState('');
  const [prereqSelected, setPrereqSelected] = useState<Set<string>>(new Set());
  const [prereqSaving, setPrereqSaving] = useState(false);

  function openEdit() {
    setForm({
      name: skill.name,
      standard: skill.standard ?? '',
      description: skill.description ?? '',
      difficultyBaseline: skill.difficultyBaseline,
      estimatedTimeSeconds: skill.estimatedTimeSeconds,
    });
    setEditOpen(true);
  }

  function openPrereq() {
    setPrereqSelected(new Set(skill.prerequisites.map((p) => p.id)));
    setPrereqSearch('');
    setPrereqOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const api = getApi();
      const updated = await api.updateSkill(skill.id, orgId, {
        name: form.name.trim(),
        standard: form.standard || undefined,
        description: form.description || undefined,
        difficultyBaseline: form.difficultyBaseline,
        estimatedTimeSeconds: form.estimatedTimeSeconds,
      });
      onUpdate(updated);
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePrereqs() {
    setPrereqSaving(true);
    try {
      const api = getApi();
      const updated = await api.updateSkill(skill.id, orgId, {
        prerequisiteIds: Array.from(prereqSelected),
      });
      onUpdate(updated);
      setPrereqOpen(false);
    } finally {
      setPrereqSaving(false);
    }
  }

  function togglePrereq(id: string) {
    setPrereqSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Same-grade skills only (excluding self)
  const sameGradeSkills = allSkills.filter(
    (s) => s.id !== skill.id && s.grade === skill.grade,
  );

  const filteredPrereqSkills = prereqSearch.trim()
    ? sameGradeSkills.filter(
        (s) =>
          s.name.toLowerCase().includes(prereqSearch.toLowerCase()) ||
          (s.standard ?? '').toLowerCase().includes(prereqSearch.toLowerCase()) ||
          s.domainName.toLowerCase().includes(prereqSearch.toLowerCase()),
      )
    : sameGradeSkills;

  // Group filtered prereq candidates by domain
  const prereqByDomain = filteredPrereqSkills.reduce<
    Record<string, { domainName: string; skills: AssessmentSkillVM[] }>
  >((acc, s) => {
    if (!acc[s.domainId]) acc[s.domainId] = { domainName: s.domainName, skills: [] };
    acc[s.domainId].skills.push(s);
    return acc;
  }, {});

  return (
    <>
      <div className="group flex items-center gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors">
        {/* Skill info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{skill.name}</span>
            {skill.standard && (
              <span className="text-xs text-muted-foreground font-mono shrink-0 hidden sm:inline">
                {skill.standard}
              </span>
            )}
          </div>
          {skill.prerequisites.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {skill.prerequisites.map((p) => (
                <Badge key={p.id} variant="outline" className="text-xs gap-1 py-0 h-5">
                  <Link2 className="h-2.5 w-2.5" />
                  {p.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Item count — always visible */}
        {skill.itemCount !== undefined && skill.itemCount > 0 && (
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {skill.itemCount} q
          </span>
        )}

        {/* Difficulty dots — always visible */}
        <div
          className="flex gap-0.5 shrink-0"
          title={`Baseline: ${DIFFICULTY_LABELS[skill.difficultyBaseline]}`}
        >
          {[1, 2, 3, 4, 5].map((d) => (
            <div
              key={d}
              className={`h-2 w-2 rounded-full ${d <= skill.difficultyBaseline ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Set prerequisites"
            onClick={openPrereq}
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Edit skill"
            onClick={openEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete skill"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit skill</DialogTitle>
            <DialogDescription>
              Update the skill details. Changes apply immediately after saving.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-skill-name">
                Skill name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-skill-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-skill-standard">Standard (optional)</Label>
              <Input
                id="edit-skill-standard"
                placeholder="e.g. CCSS.Math.4.NF.A.2"
                value={form.standard}
                onChange={(e) => setForm((p) => ({ ...p, standard: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-skill-desc">Description (optional)</Label>
              <Textarea
                id="edit-skill-desc"
                className="resize-none"
                rows={3}
                placeholder="What students will learn or practise"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Baseline difficulty</Label>
                <Select
                  value={String(form.difficultyBaseline)}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, difficultyBaseline: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {DIFFICULTY_LABELS[d]} (Level {d})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-skill-time">Est. time (seconds)</Label>
                <Input
                  id="edit-skill-time"
                  type="number"
                  min={10}
                  value={form.estimatedTimeSeconds}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      estimatedTimeSeconds: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prerequisites Dialog */}
      <Dialog open={prereqOpen} onOpenChange={setPrereqOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set Prerequisites</DialogTitle>
            <DialogDescription>
              Select skills that must be mastered before{' '}
              <span className="font-medium text-foreground">{skill.name}</span>. Only
              Grade {skill.grade} skills are shown.
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="flex items-center gap-2.5 h-10 rounded-lg border bg-background px-3.5 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search by name, domain, or standard…"
              value={prereqSearch}
              onChange={(e) => setPrereqSearch(e.target.value)}
            />
          </div>

          {/* Skill list */}
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {sameGradeSkills.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No other Grade {skill.grade} skills available.
              </p>
            ) : filteredPrereqSkills.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No skills match your search.
              </p>
            ) : (
              Object.values(prereqByDomain).map(({ domainName, skills: ds }) => (
                <div key={domainName}>
                  <div className="sticky top-0 flex items-center gap-2 border-b bg-muted/60 px-4 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {domainName}
                    </span>
                  </div>
                  <div className="divide-y">
                    {ds.map((s) => {
                      const checked = prereqSelected.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                          onClick={() => togglePrereq(s.id)}
                        >
                          <div
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              checked
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/40'
                            }`}
                          >
                            {checked && <Check className="h-2.5 w-2.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">{s.name}</p>
                            {s.standard && (
                              <p className="mt-0.5 text-xs font-mono text-muted-foreground">
                                {s.standard}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPrereqOpen(false)}
              disabled={prereqSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePrereqs} disabled={prereqSaving}>
              {prereqSaving
                ? 'Saving…'
                : `Save${prereqSelected.size > 0 ? ` (${prereqSelected.size})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
