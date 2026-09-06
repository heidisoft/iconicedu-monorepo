'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type { AssessmentSubjectVM } from '@iconicedu/shared-types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  Input,
  Label,
} from '@iconicedu/ui-web';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from './confirm-dialog';

const SUBJECT_ICONS = ['📚', '🔢', '🔬', '📖', '🌍', '🎨', '🎵', '💻', '⚽', '🏛️'];
const SUBJECT_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#2dd4a8',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

interface CreateProps {
  orgId: string;
  subject?: never;
}

interface EditProps {
  orgId: string;
  subject: AssessmentSubjectVM;
}

type Props = CreateProps | EditProps;

export function CreateSubjectForm({ orgId, subject }: Props) {
  const router = useRouter();
  const isEdit = !!subject;

  const { confirm, ConfirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subject?.name ?? '');
  const [icon, setIcon] = useState(subject?.icon ?? '📚');
  const [color, setColor] = useState(subject?.color ?? SUBJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function resetAndOpen() {
    setName(subject?.name ?? '');
    setIcon(subject?.icon ?? '📚');
    setColor(subject?.color ?? SUBJECT_COLORS[0]);
    setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const api = createAssessmentApiClient(createSupabaseBrowserClient());
      if (isEdit) {
        await api.updateSubject(subject.id, orgId, { name: name.trim(), icon, color });
      } else {
        await api.createSubject(orgId, { name: name.trim(), icon, color });
        setName('');
        setIcon('📚');
        setColor(SUBJECT_COLORS[0]);
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    const ok = await confirm({
      title: `Delete "${subject.name}"?`,
      description:
        'All domains, skills, and any linked questions will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete subject',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const api = createAssessmentApiClient(createSupabaseBrowserClient());
      await api.deleteSubject(subject.id, orgId);
      setOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ConfirmDialog />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {isEdit ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={resetAndOpen}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Subject
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${subject.name}` : 'New Subject'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update the subject name, icon, and colour.'
                : 'Subjects organise your curriculum into domains and skills. Choose a name, icon, and colour to make it recognisable.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject-name">
                Subject name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subject-name"
                placeholder="e.g. Mathematics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`text-xl p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                      icon === emoji
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-border'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 ${
                      color === c
                        ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-foreground/20'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            {isEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {deleting ? 'Deleting…' : 'Delete subject'}
              </Button>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving || deleting}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || deleting || !name.trim()}>
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create subject'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
