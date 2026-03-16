// license? not necessary
'use client';

import * as React from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@iconicedu/ui-web/ui/dialog';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { Switch } from '@iconicedu/ui-web/ui/switch';
import {
  Video,
  Folder,
  GraduationCap,
  LinkIcon,
  FileText,
  ExternalLink,
  Book,
  Music,
  ImageIcon,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  LearningSpaceLinkVM,
  LearningSpaceLinkStatusVM,
} from '@iconicedu/shared-types';

const ICON_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'video', label: 'Video', icon: Video },
  { key: 'folder', label: 'Folder', icon: Folder },
  { key: 'graduation-cap', label: 'Graduation Cap', icon: GraduationCap },
  { key: 'link', label: 'Link', icon: LinkIcon },
  { key: 'file', label: 'File', icon: FileText },
  { key: 'external', label: 'External', icon: ExternalLink },
  { key: 'book', label: 'Book', icon: Book },
  { key: 'music', label: 'Music', icon: Music },
  { key: 'image', label: 'Image', icon: ImageIcon },
];

interface ResourceLinksEditorProps {
  links: LearningSpaceLinkVM[];
  onLinksChange: (links: LearningSpaceLinkVM[]) => void;
  className?: string;
}

function getIconComponent(iconKey: string | null) {
  return ICON_OPTIONS.find((option) => option.key === iconKey)?.icon ?? LinkIcon;
}

export function ResourceLinksEditor({
  links,
  onLinksChange,
  className,
}: ResourceLinksEditorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [formData, setFormData] = React.useState({
    label: '',
    iconKey: 'link',
    url: '',
    status: 'active' as LearningSpaceLinkStatusVM,
  });

  const resetForm = () => {
    setFormData({
      label: '',
      iconKey: 'link',
      url: '',
      status: 'active',
    });
    setIsSubmitted(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
      setEditingIndex(null);
    }
  };

  const openNewDialog = () => {
    resetForm();
    setEditingIndex(null);
    setIsOpen(true);
  };

  const handleEdit = (link: LearningSpaceLinkVM, index: number) => {
    setEditingIndex(index);
    setIsSubmitted(false);
    setFormData({
      label: link.label ?? '',
      iconKey: link.iconKey ?? 'link',
      url: link.url ?? '',
      status: link.status ?? 'active',
    });
    setIsOpen(true);
  };

  const handleDelete = (index: number) => {
    onLinksChange(links.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    setIsSubmitted(true);
    if (!formData.label.trim() || !formData.url.trim()) {
      return;
    }

    if (editingIndex !== null) {
      onLinksChange(
        links.map((link, idx) =>
          idx === editingIndex ? { ...link, ...formData } : link,
        ),
      );
    } else {
      onLinksChange([...links, { ...formData }]);
    }
    handleOpenChange(false);
  };

  const labelInvalid = isSubmitted && !formData.label.trim();
  const urlInvalid = isSubmitted && !formData.url.trim();
  const canSave = Boolean(formData.label.trim() && formData.url.trim());
  const handleDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (contentRef.current && contentRef.current.contains(event.target as Node)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [isOpen]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Resource Links</h3>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" type="button" onClick={openNewDialog}>
              <Plus className="size-4" />
              Add Link
            </Button>
          </DialogTrigger>
          <DialogContent onKeyDownCapture={handleDialogKeyDown}>
            <div ref={contentRef}>
              <DialogHeader>
                <DialogTitle>
                  {editingIndex !== null ? 'Edit Resource Link' : 'Add Resource Link'}
                </DialogTitle>
                <DialogDescription>
                  {editingIndex !== null
                    ? 'Update the details of your resource link.'
                    : 'Add a new resource link with a label, icon, and URL.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="resource-label">
                    Label <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="resource-label"
                    placeholder="e.g., Join Zoom"
                    value={formData.label}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, label: event.target.value }))
                    }
                    onKeyDown={handleDialogKeyDown}
                    required
                  />
                  {labelInvalid && (
                    <p className="text-xs text-destructive">Label is required.</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="resource-url">
                    URL <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="resource-url"
                    type="url"
                    placeholder="https://..."
                    value={formData.url}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, url: event.target.value }))
                    }
                    onKeyDown={handleDialogKeyDown}
                    required
                  />
                  {urlInvalid && (
                    <p className="text-xs text-destructive">URL is required.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Icon</Label>
                    <Select
                      value={formData.iconKey}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, iconKey: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          return (
                            <SelectItem key={option.key} value={option.key}>
                              <Icon className="size-4" />
                              {option.label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2">
                      <Switch
                        checked={formData.status === 'active'}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            status: checked ? 'active' : 'inactive',
                          }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={!canSave}>
                    {editingIndex !== null ? 'Save changes' : 'Add link'}
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg text-muted-foreground">
          <LinkIcon className="size-8 mb-2 opacity-50" />
          <p className="text-sm">No resource links yet</p>
          <p className="text-xs">Click “Add Link” to get started</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {links.map((link, index) => {
            const Icon = getIconComponent(link.iconKey ?? '');
            return (
              <li
                key={`${link.label ?? 'resource'}-${index}`}
                className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center size-8 rounded-md bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{link.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      link.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {link.status ?? 'active'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    onClick={() => handleEdit(link, index)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    onClick={() => handleDelete(index)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
