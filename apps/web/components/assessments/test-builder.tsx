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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Plus, Trash2 } from 'lucide-react';
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
        <TabsContent value="skills" className="pt-4">
          <SkillPoolManager test={test} orgId={orgId} />
        </TabsContent>
      ) : (
        <TabsContent value="sections" className="pt-4">
          <SectionManager test={test} orgId={orgId} />
        </TabsContent>
      )}

      <TabsContent value="settings" className="pt-4">
        <TestForm orgId={orgId} orgSlug={orgSlug} test={test} />
      </TabsContent>
    </Tabs>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SkillPoolManager — for adaptive tests
// ──────────────────────────────────────────────────────────────────────────────

function SkillPoolManager({ test, orgId }: { test: AssessmentTestVM; orgId: string }) {
  const [pools, setPools] = useState<AssessmentSkillPoolVM[]>(test.skillPools ?? []);
  const [addingPool, setAddingPool] = useState(false);
  const [newPool, setNewPool] = useState({
    skillId: '',
    targetItems: 5,
    startDifficulty: 3,
  });
  const [saving, setSaving] = useState(false);

  async function handleAddPool() {
    if (!newPool.skillId) return;
    setSaving(true);
    try {
      const result = (await getApi().addSkillPool(
        test.id,
        newPool,
      )) as AssessmentSkillPoolVM;
      setPools((p) => [...p, result]);
      setNewPool({ skillId: '', targetItems: 5, startDifficulty: 3 });
      setAddingPool(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePool(poolId: string) {
    await getApi().removeSkillPool(poolId);
    setPools((p) => p.filter((pool) => pool.id !== poolId));
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The adaptive engine will assess each skill in order, using the rules configured
          on the test.
        </p>
        <Button size="sm" variant="outline" onClick={() => setAddingPool(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Skill
        </Button>
      </div>

      {pools.length === 0 && !addingPool && (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">No skills in the pool yet.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {pools.map((pool, i) => (
          <Card key={pool.id}>
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <span className="text-sm text-muted-foreground w-5 flex-shrink-0">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{pool.skillName}</p>
                <p className="text-xs text-muted-foreground">
                  {pool.subjectName} · {pool.domainName} · Grade {pool.grade}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Target: {pool.targetItems}</span>
                <span>Start: L{pool.startDifficulty}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                onClick={() => handleRemovePool(pool.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {addingPool && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-3 py-4">
            <div>
              <Label className="text-xs mb-1 block">Skill</Label>
              <SkillPicker
                orgId={orgId}
                value={newPool.skillId}
                onChange={(id) => setNewPool((p) => ({ ...p, skillId: id }))}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">Target items</Label>
                <Input
                  type="number"
                  className="mt-1 h-8 text-sm"
                  value={newPool.targetItems}
                  onChange={(e) =>
                    setNewPool((p) => ({ ...p, targetItems: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Start difficulty</Label>
                <Select
                  value={String(newPool.startDifficulty)}
                  onValueChange={(v) =>
                    setNewPool((p) => ({ ...p, startDifficulty: Number(v) }))
                  }
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
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
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddPool}
                disabled={saving || !newPool.skillId}
              >
                {saving ? 'Adding…' : 'Add to pool'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingPool(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
          Add sections and questions. Sections are shown in order.
        </p>
        <Button size="sm" variant="outline" onClick={() => setAddingSection(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Section
        </Button>
      </div>

      {sections.length === 0 && !addingSection && (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
              No sections yet. Add a section to start adding questions.
            </p>
          </CardContent>
        </Card>
      )}

      {addingSection && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-3 py-4">
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
          </CardContent>
        </Card>
      )}

      {sections.length > 0 && (
        <Accordion type="multiple" defaultValue={sections.map((s) => s.id)}>
          {sections.map((section, i) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border rounded-lg mb-2"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {section.title ?? `Section ${i + 1}`}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {section.items.length} question{section.items.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <SectionItemsManager
                  section={section}
                  orgId={orgId}
                  onItemsChange={(items) =>
                    setSections((prev) =>
                      prev.map((s) => (s.id === section.id ? { ...s, items } : s)),
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

// Section items (search + add items to a section)
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
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<
    { id: string; title: string; skillName: string; difficulty: number }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

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

  async function handleAddItem(itemId: string) {
    setAddingId(itemId);
    const result = await getApi().addItemToSection(section.id, { itemId, points: 1 });
    onItemsChange([...items, result as AssessmentTestSectionVM['items'][number]]);
    setResults([]);
    setSearch('');
    setAddingId(null);
  }

  async function handleRemoveItem(itemId: string) {
    await getApi().removeItemFromSection(section.id, itemId);
    onItemsChange(items.filter((it) => it.itemId !== itemId));
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((sectionItem, i) => (
        <div
          key={sectionItem.id}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/20"
        >
          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
          <span className="flex-1 text-sm">
            {sectionItem.item?.title ?? sectionItem.itemId}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={() => handleRemoveItem(sectionItem.itemId)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="mt-2 relative">
        <Input
          className="h-8 text-sm"
          placeholder="Search questions to add…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {results.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                onClick={() => handleAddItem(item.id)}
                disabled={
                  addingId === item.id || items.some((it) => it.itemId === item.id)
                }
              >
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.skillName}</span>
                {items.some((it) => it.itemId === item.id) && (
                  <Badge variant="secondary" className="text-xs">
                    Added
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
