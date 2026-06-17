'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type { AssessmentSkillVM } from '@iconicedu/shared-types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@iconicedu/ui-web';
import { Check, ChevronsUpDown } from 'lucide-react';

interface Props {
  orgId: string;
  value?: string;
  onChange: (skillId: string, skill: AssessmentSkillVM) => void;
}

export function SkillPicker({ orgId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<AssessmentSkillVM[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || skills.length > 0) return;
    setLoading(true);
    const api = createAssessmentApiClient(createSupabaseBrowserClient());
    api.listSkills(orgId).then((data) => {
      setSkills(data);
      setLoading(false);
    });
  }, [open, orgId, skills.length]);

  const selected = skills.find((s) => s.id === value);

  // Group by subject > grade > domain
  const grouped = skills.reduce<Record<string, AssessmentSkillVM[]>>((acc, skill) => {
    const key = `${skill.subjectName} · Grade ${skill.grade} · ${skill.domainName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(skill);
    return acc;
  }, {});

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selected ? (
            <span className="truncate">
              {selected.subjectName} › {selected.domainName} › {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Select a skill…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search skills…" />
          <CommandEmpty>{loading ? 'Loading…' : 'No skills found.'}</CommandEmpty>
          {Object.entries(grouped).map(([group, groupSkills]) => (
            <CommandGroup key={group} heading={group}>
              {groupSkills.map((skill) => (
                <CommandItem
                  key={skill.id}
                  value={`${skill.name} ${skill.domainName} ${skill.subjectName}`}
                  onSelect={() => {
                    onChange(skill.id, skill);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${skill.id === value ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <span className="flex-1">{skill.name}</span>
                  {skill.standard && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {skill.standard}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
