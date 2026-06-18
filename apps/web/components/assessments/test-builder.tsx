'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type {
  AssessmentTestVM,
  AssessmentTestSectionVM,
  AssessmentSkillPoolVM,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@iconicedu/ui-web';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useConfirm } from './confirm-dialog';
import { SkillPicker } from './skill-picker';
import { TestForm } from './test-form';

interface Props {
  test: AssessmentTestVM;
  orgId: string;
  orgSlug: string;
}

function getApi() {
  return createAssessmentApiClient(createSupabaseBrowserClient());
}

export function TestBuilder({ test, orgId, orgSlug }: Props) {
  return (
    <Tabs defaultValue={test.mode === 'adaptive' ? 'skills' : 'sections'}>
      <TabsList>
        {test.mode === 'adaptive' ? (
          <TabsTrigger value="skills">Skill Pools</TabsTrigger>
        ) : (
          <TabsTrigger value="sections">Sections & Questions</TabsTrigger>
        )}
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      {test.mode === 'adaptive' ? (
        <TabsContent value="skills" className="pt-6">
          <SkillPoolManager test={test} orgId={orgId} />
        </TabsContent>
      ) : (
        <TabsContent value="sections" className="pt-6">
          <SectionManager test={test} orgId={orgId} />
        </TabsContent>
      )}

      <TabsContent value="settings" className="pt-6">
        <TestForm orgId={orgId} orgSlug={orgSlug} test={test} />
      </TabsContent>
    </Tabs>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SkillPoolManager — for adaptive tests
// ──────────────────────────────────────────────────────────────────────────────

function SkillPoolManager({ test, orgId }: { test: AssessmentTestVM; orgId: string }) {
  const { confirm: confirmPool, ConfirmDialog: PoolConfirmDialog } = useConfirm();
  const [pools, setPools] = useState<AssessmentSkillPoolVM[]>(test.skillPools ?? []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPool, setNewPool] = useState({
    skillId: '',
    targetItems: 5,
    startDifficulty: 3,
  });
  const [saving, setSaving] = useState(false);

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setNewPool({ skillId: '', targetItems: 5, startDifficulty: 3 });
  }

  async function handleAddPool() {
    if (!newPool.skillId) return;
    setSaving(true);
    try {
      const result = (await getApi().addSkillPool(
        test.id,
        newPool,
      )) as AssessmentSkillPoolVM;
      setPools((p) => [...p, result]);
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePool(poolId: string, skillName: string) {
    const ok = await confirmPool({
      title: `Remove "${skillName}"?`,
      description:
        'This skill will be removed from the adaptive pool. This cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    await getApi().removeSkillPool(poolId);
    setPools((p) => p.filter((pool) => pool.id !== poolId));
  }

  const alreadyInPool = new Set(pools.map((p) => p.skillId));

  return (
    <>
      <PoolConfirmDialog />
      <div className="flex flex-col gap-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            The adaptive engine assesses each skill in order using the rules configured on
            the test.
          </p>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Skill
          </Button>
        </div>

        {pools.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No skills in the pool yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add skills to define what this adaptive test will assess.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Skill
            </Button>
          </div>
        )}

        {pools.length > 0 && (
          <div className="rounded-xl border overflow-hidden">
            <div className="px-6 py-3 border-b bg-muted/30">
              <span className="text-sm font-medium text-muted-foreground">
                Skill Pool ({pools.length})
              </span>
            </div>
            <div className="divide-y divide-border">
              {pools.map((pool, i) => (
                <div key={pool.id} className="group flex items-center gap-3 px-6 py-4">
                  <span className="text-sm text-muted-foreground w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{pool.skillName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pool.subjectName} · {pool.domainName} · Grade {pool.grade}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <span className="bg-muted rounded px-2 py-0.5">
                      Target: {pool.targetItems}
                    </span>
                    <span className="bg-muted rounded px-2 py-0.5">
                      Start: L{pool.startDifficulty}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemovePool(pool.id, pool.skillName)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add skill dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Skill to Pool</DialogTitle>
            <DialogDescription>
              Choose a skill and configure how many questions to serve for it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Skill</Label>
              <SkillPicker
                orgId={orgId}
                value={newPool.skillId}
                onChange={(id) => setNewPool((p) => ({ ...p, skillId: id }))}
                disabledIds={alreadyInPool}
              />
              {newPool.skillId && alreadyInPool.has(newPool.skillId) && (
                <p className="text-xs text-destructive">
                  This skill is already in the pool.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Target items</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={newPool.targetItems}
                  onChange={(e) =>
                    setNewPool((p) => ({ ...p, targetItems: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Start difficulty</Label>
                <Select
                  value={String(newPool.startDifficulty)}
                  onValueChange={(v) =>
                    setNewPool((p) => ({ ...p, startDifficulty: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Level {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPool}
              disabled={saving || !newPool.skillId || alreadyInPool.has(newPool.skillId)}
            >
              {saving ? 'Adding…' : 'Add to pool'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SectionManager — for static tests
// ──────────────────────────────────────────────────────────────────────────────

function SectionManager({ test, orgId }: { test: AssessmentTestVM; orgId: string }) {
  const [sections, setSections] = useState<AssessmentTestSectionVM[]>(
    test.sections ?? [],
  );
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [savingSection, setSavingSection] = useState(false);

  async function handleAddSection() {
    setSavingSection(true);
    try {
      const result = (await getApi().addSection(test.id, {
        title: newSectionTitle || undefined,
        orderPosition: sections.length,
      })) as AssessmentTestSectionVM;
      setSections((s) => [...s, { ...result, items: [] }]);
      setNewSectionTitle('');
      setAddingSection(false);
    } finally {
      setSavingSection(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add sections and questions. Sections are shown in order during the test.
        </p>
        <Button size="sm" variant="outline" onClick={() => setAddingSection(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Section
        </Button>
      </div>

      {sections.length === 0 && !addingSection && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No sections yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add a section to start adding questions.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddingSection(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Section
          </Button>
        </div>
      )}

      {addingSection && (
        <div className="rounded-xl border border-dashed p-4 flex flex-col gap-3">
          <div>
            <Label className="text-xs">Section title (optional)</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Fractions"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddSection} disabled={savingSection}>
              {savingSection ? 'Adding…' : 'Add section'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingSection(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="flex flex-col gap-3">
          {sections.map((section, i) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              index={i}
              orgId={orgId}
              onItemsChange={(items) =>
                setSections((prev) =>
                  prev.map((s) => (s.id === section.id ? { ...s, items } : s)),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({
  section,
  index,
  orgId,
  onItemsChange,
}: {
  section: AssessmentTestSectionVM;
  index: number;
  orgId: string;
  onItemsChange: (items: AssessmentTestSectionVM['items']) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

  return (
    // No overflow-hidden here — allows the search dropdown inside to escape the container
    <div className="rounded-xl border">
      <div
        className="flex items-center gap-3 px-6 py-4 bg-muted/30 border-b rounded-t-xl cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <ChevronIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm flex-1">
          {section.title ?? `Section ${index + 1}`}
        </span>
        <Badge variant="outline" className="text-xs">
          {section.items.length} question{section.items.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      {!collapsed && (
        <div className="p-6">
          <SectionItemsManager
            section={section}
            orgId={orgId}
            onItemsChange={onItemsChange}
          />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SectionItemsManager — questions list + dialog to add multiple
// ──────────────────────────────────────────────────────────────────────────────

type SearchResult = { id: string; title: string; skillName: string; difficulty: number };

function SectionItemsManager({
  section,
  orgId,
  onItemsChange,
}: {
  section: AssessmentTestSectionVM;
  orgId: string;
  onItemsChange: (items: AssessmentTestSectionVM['items']) => void;
}) {
  const items = section.items;
  const { confirm: confirmItem, ConfirmDialog: ItemConfirmDialog } = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const data = await createAssessmentApiClient(createSupabaseBrowserClient()).listItems(
      orgId,
      { search: q },
    );
    setResults(
      data.items.map((it) => ({
        id: it.id,
        title: it.title,
        skillName: it.skillName,
        difficulty: it.difficulty,
      })),
    );
    setSearching(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const api = getApi();
      const newItems: AssessmentTestSectionVM['items'] = [...items];
      for (const itemId of selected) {
        const result = await api.addItemToSection(section.id, { itemId, points: 1 });
        newItems.push(result as AssessmentTestSectionVM['items'][number]);
      }
      onItemsChange(newItems);
      setDialogOpen(false);
      setSearch('');
      setResults([]);
      setSelected(new Set());
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setSearch('');
      setResults([]);
      setSelected(new Set());
    }
  }

  async function handleRemoveItem(itemId: string, itemTitle: string) {
    const ok = await confirmItem({
      title: `Remove "${itemTitle}"?`,
      description: 'This question will be removed from the section.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    await getApi().removeItemFromSection(section.id, itemId);
    onItemsChange(items.filter((it) => it.itemId !== itemId));
  }

  const alreadyInSection = new Set(items.map((it) => it.itemId));

  return (
    <>
      <ItemConfirmDialog />

      <div className="flex flex-col gap-3">
        {/* Existing questions */}
        {items.length > 0 && (
          <div className="rounded-lg border divide-y">
            {items.map((sectionItem, i) => (
              <div
                key={sectionItem.id}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <span className="text-xs text-muted-foreground w-5 shrink-0">
                  {i + 1}.
                </span>
                <span className="flex-1 text-sm truncate">
                  {sectionItem.item?.title ?? sectionItem.itemId}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    handleRemoveItem(
                      sectionItem.itemId,
                      sectionItem.item?.title ?? 'this question',
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add questions button */}
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Questions
        </Button>
      </div>

      {/* Pick questions dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Questions</DialogTitle>
            <DialogDescription>
              Search and select questions to add to this section.
            </DialogDescription>
          </DialogHeader>

          {/* Search input — flex layout avoids icon/padding misalignment */}
          <div className="flex items-center gap-2.5 h-10 rounded-lg border bg-background px-3.5 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search by title or skill…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Results list */}
          <div className="min-h-[160px] max-h-80 overflow-y-auto -mx-6 px-6">
            {search.length < 2 && (
              <div className="flex items-center justify-center h-[160px]">
                <p className="text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </p>
              </div>
            )}
            {search.length >= 2 && searching && (
              <div className="flex items-center justify-center h-[160px]">
                <p className="text-sm text-muted-foreground">Searching…</p>
              </div>
            )}
            {search.length >= 2 && !searching && results.length === 0 && (
              <div className="flex items-center justify-center h-[160px]">
                <p className="text-sm text-muted-foreground">No questions found.</p>
              </div>
            )}
            {!searching && results.length > 0 && (
              <div className="rounded-lg border divide-y overflow-hidden">
                {results.map((item) => {
                  const inSection = alreadyInSection.has(item.id);
                  const isSelected = selected.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={inSection}
                      onClick={() => toggleSelect(item.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div
                        className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                          inSection
                            ? 'bg-muted border-muted-foreground/30'
                            : isSelected
                              ? 'bg-primary border-primary'
                              : 'border-input'
                        }`}
                      >
                        {(isSelected || inSection) && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.skillName}
                        </p>
                      </div>
                      {inSection && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Added
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} question${selected.size !== 1 ? 's' : ''} selected`
                : 'No questions selected'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={selected.size === 0 || saving}
              >
                {saving
                  ? 'Adding…'
                  : `Add ${selected.size > 0 ? selected.size : ''} question${selected.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
