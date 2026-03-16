'use client';

import { ChevronDown, LayoutGrid, Monitor, Share2 } from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';

export type LiveSessionViewType = 'gallery' | 'speaker' | 'shared-content';

interface ViewSwitcherProps {
  currentView: LiveSessionViewType;
  onViewChange: (view: LiveSessionViewType) => void;
}

const viewOptions = [
  {
    id: 'gallery' as const,
    label: 'Gallery View',
    icon: LayoutGrid,
    description: 'See all participants',
  },
  {
    id: 'speaker' as const,
    label: 'Speaker View',
    icon: Monitor,
    description: 'Focus on active speaker',
  },
  {
    id: 'shared-content' as const,
    label: 'Shared Content',
    icon: Share2,
    description: 'Focus on shared screen',
  },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const currentViewOption =
    viewOptions.find((option) => option.id === currentView) ?? viewOptions[0];
  const CurrentIcon = currentViewOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CurrentIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{currentViewOption.label}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {viewOptions.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onViewChange(option.id)}
              className={currentView === option.id ? 'bg-primary/10 text-primary' : ''}
            >
              <Icon className="mr-3 h-4 w-4" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
              {currentView === option.id ? (
                <span className="ml-auto text-primary">✓</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
