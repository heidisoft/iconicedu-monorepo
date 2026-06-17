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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@iconicedu/ui-web';
import { BookMarked, Check, Link2, Pencil, Plus, Trash2 } from 'lucide-react';

interface Props {
  subject: AssessmentSubjectVM;
  domains: AssessmentDomainVM[];
  orgId: string;
}

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const DIFFICULTIES = [1, 2, 3, 4, 5];

function getApi() {
  return createAssessmentApiClient(createSupabaseBrowserClient());
}

export function CurriculumTreeEditor({ subject, domains: initialDomains, orgId }: Props) {
  const [domains, setDomains] = useState(initialDomains);

  const [addingDomain, setAddingDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainGrade, setNewDomainGrade] = useState(1);
  const [savingDomain, setSavingDomain] = useState(false);

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
      setAddingDomain(false);
    } finally {
      setSavingDomain(false);
    }
  }

  const sortedDomains = [...domains].sort(
    (a, b) => a.grade - b.grade || a.orderPosition - b.orderPosition,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Domains group skills by grade level. Every question must be tagged to a skill.
        </p>
        <Button size="sm" variant="outline" onClick={() => setAddingDomain(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Domain
        </Button>
      </div>

      {addingDomain && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="new-domain-name" className="text-xs">
                  Domain name
                </Label>
                <Input
                  id="new-domain-name"
                  className="mt-1"
                  placeholder="e.g. Fractions"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  autoFocus
                />
              </div>
              <div className="w-28">
                <Label className="text-xs">Grade</Label>
                <Select
                  value={String(newDomainGrade)}
                  onValueChange={(v) => setNewDomainGrade(Number(v))}
                >
                  <SelectTrigger className="mt-1">
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
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddDomain}
                disabled={savingDomain || !newDomainName.trim()}
              >
                {savingDomain ? 'Adding…' : 'Add domain'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingDomain(false);
                  setNewDomainName('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {domains.length === 0 && !addingDomain && (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-2">
            <BookMarked className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              No domains yet. Add one to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {sortedDomains.length > 0 && (
        <Accordion type="multiple" defaultValue={sortedDomains.map((d) => d.id)}>
          {sortedDomains.map((domain) => (
            <AccordionItem
              key={domain.id}
              value={domain.id}
              className="border rounded-lg mb-2 px-0"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="font-medium">{domain.name}</span>
                  <Badge variant="outline" className="text-xs">
                    Grade {domain.grade}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-1">
                    {(domain.skills ?? []).length} skill
                    {(domain.skills ?? []).length !== 1 ? 's' : ''}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <DomainSkills
                  domain={domain}
                  allSkills={domains.flatMap((d) => d.skills ?? [])}
                  orgId={orgId}
                  onSkillsChange={(skills) =>
                    setDomains((prev) =>
                      prev.map((d) => (d.id === domain.id ? { ...d, skills } : d)),
                    )
                  }
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// DomainSkills
// ──────────────────────────────────────────────────────────────────────────────

interface DomainSkillsProps {
  domain: AssessmentDomainVM;
  allSkills: AssessmentSkillVM[];
  orgId: string;
  onSkillsChange: (skills: AssessmentSkillVM[]) => void;
}

function DomainSkills({ domain, allSkills, orgId, onSkillsChange }: DomainSkillsProps) {
  const skills = domain.skills ?? [];
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

  async function handleDeleteSkill(skillId: string) {
    const api = getApi();
    await api.deleteSkill(skillId, orgId);
    onSkillsChange(skills.filter((s) => s.id !== skillId));
  }

  return (
    <div className="flex flex-col gap-0.5">
      {skills.length === 0 && (
        <p className="text-xs text-muted-foreground py-2 px-1">
          No skills in this domain yet.
        </p>
      )}

      {skills.map((skill) => (
        <SkillRow
          key={skill.id}
          skill={skill}
          allSkills={allSkills}
          orgId={orgId}
          onDelete={() => handleDeleteSkill(skill.id)}
          onUpdate={(updated) =>
            onSkillsChange(skills.map((s) => (s.id === updated.id ? updated : s)))
          }
        />
      ))}

      <Button
        size="sm"
        variant="ghost"
        className="mt-2 self-start text-xs h-7 text-muted-foreground hover:text-foreground"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="mr-1 h-3 w-3" /> Add skill
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add skill to {domain.name}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label htmlFor="add-skill-name">Skill name</Label>
              <Input
                id="add-skill-name"
                className="mt-1.5"
                placeholder="e.g. Compare fractions with unlike denominators"
                value={newSkill.name}
                onChange={(e) => setNewSkill((p) => ({ ...p, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="add-skill-standard">Standard (optional)</Label>
              <Input
                id="add-skill-standard"
                className="mt-1.5"
                placeholder="e.g. CCSS.Math.4.NF.A.2"
                value={newSkill.standard}
                onChange={(e) => setNewSkill((p) => ({ ...p, standard: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="add-skill-desc">Description (optional)</Label>
              <Textarea
                id="add-skill-desc"
                className="mt-1.5 resize-none"
                rows={2}
                placeholder="What students will learn or practise"
                value={newSkill.description}
                onChange={(e) =>
                  setNewSkill((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Baseline difficulty</Label>
                <Select
                  value={String(newSkill.difficultyBaseline)}
                  onValueChange={(v) =>
                    setNewSkill((p) => ({ ...p, difficultyBaseline: Number(v) }))
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Level {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="add-skill-time">Est. time (seconds)</Label>
                <Input
                  id="add-skill-time"
                  className="mt-1.5"
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
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SkillRow
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

  // Keep form in sync when skill prop updates
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

  async function handleTogglePrereq(prereqSkill: AssessmentSkillVM) {
    const api = getApi();
    const currentIds = skill.prerequisites.map((p) => p.id);
    const newIds = currentIds.includes(prereqSkill.id)
      ? currentIds.filter((id) => id !== prereqSkill.id)
      : [...currentIds, prereqSkill.id];
    const updated = await api.updateSkill(skill.id, orgId, { prerequisites: newIds });
    onUpdate(updated);
  }

  const otherSkills = allSkills.filter((s) => s.id !== skill.id);

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/30 group transition-colors min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{skill.name}</span>
            {skill.standard && (
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {skill.standard}
              </span>
            )}
          </div>
          {skill.prerequisites.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {skill.prerequisites.map((p) => (
                <Badge key={p.id} variant="outline" className="text-xs gap-1 py-0">
                  <Link2 className="h-2.5 w-2.5" /> {p.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {skill.itemCount !== undefined && (
            <span className="text-xs text-muted-foreground mr-1">
              {skill.itemCount} q
            </span>
          )}

          <Popover open={prereqOpen} onOpenChange={setPrereqOpen}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Set prerequisites"
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search skills…" />
                <CommandEmpty>No skills found.</CommandEmpty>
                <CommandGroup heading="Prerequisites">
                  {otherSkills.map((s) => {
                    const selected = skill.prerequisites.some((p) => p.id === s.id);
                    return (
                      <CommandItem key={s.id} onSelect={() => handleTogglePrereq(s)}>
                        <Check
                          className={`mr-2 h-4 w-4 ${selected ? 'opacity-100' : 'opacity-0'}`}
                        />
                        <span className="flex-1">{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.domainName}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div
          className="flex gap-0.5 ml-1 shrink-0"
          title={`Baseline difficulty: ${skill.difficultyBaseline}`}
        >
          {[1, 2, 3, 4, 5].map((d) => (
            <div
              key={d}
              className={`h-1.5 w-1.5 rounded-full ${d <= skill.difficultyBaseline ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit skill</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label htmlFor="edit-skill-name">Skill name</Label>
              <Input
                id="edit-skill-name"
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="edit-skill-standard">Standard (optional)</Label>
              <Input
                id="edit-skill-standard"
                className="mt-1.5"
                placeholder="e.g. CCSS.Math.4.NF.A.2"
                value={form.standard}
                onChange={(e) => setForm((p) => ({ ...p, standard: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="edit-skill-desc">Description (optional)</Label>
              <Textarea
                id="edit-skill-desc"
                className="mt-1.5 resize-none"
                rows={3}
                placeholder="What students will learn or practise"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Baseline difficulty</Label>
                <Select
                  value={String(form.difficultyBaseline)}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, difficultyBaseline: Number(v) }))
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Level {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-skill-time">Est. time (seconds)</Label>
                <Input
                  id="edit-skill-time"
                  className="mt-1.5"
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
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
