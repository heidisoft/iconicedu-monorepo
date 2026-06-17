'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
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
import { Plus } from 'lucide-react';

const SUBJECT_ICONS = ['📚', '🔢', '🔬', '📖', '🌍', '🎨', '🎵', '💻', '⚽', '🏛️'];
const SUBJECT_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

export function CreateSubjectForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📚');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const api = createAssessmentApiClient(supabase);
      await api.createSubject(orgId, { name: name.trim(), icon, color });
      setOpen(false);
      setName('');
      setIcon('📚');
      setColor(SUBJECT_COLORS[0]);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Subject
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Subject</DialogTitle>
          <DialogDescription>
            Subjects organise your curriculum into domains and skills. Choose a name,
            icon, and colour to make it recognisable.
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
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
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
            {/* Preview */}
            <div
              className="mt-1 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium self-start"
              style={{ borderLeftWidth: 4, borderLeftColor: color }}
            >
              <span>{icon}</span>
              <span>{name || 'Subject name'}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create subject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
