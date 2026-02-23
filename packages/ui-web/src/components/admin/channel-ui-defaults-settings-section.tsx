'use client';

import * as React from 'react';

import type { ChannelUiDefaultsVM, ThemeKey } from '@iconicedu/shared-types';
import { PROFILE_THEME_OPTIONS } from '@iconicedu/ui-web/components/sidebar/user-settings/constants';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@iconicedu/ui-web/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { Checkbox } from '@iconicedu/ui-web/ui/checkbox';
import { Label } from '@iconicedu/ui-web/ui/label';

type ChannelUiDefaultsSettingsSectionProps = {
  uiDefaults?: Partial<ChannelUiDefaultsVM> | null;
  onUiDefaultsChange: (updates: Partial<ChannelUiDefaultsVM>) => void;
  themeSelectId?: string;
  legend?: string;
  description?: string;
  children?: React.ReactNode;
};

export function ChannelUiDefaultsSettingsSection({
  uiDefaults,
  onUiDefaultsChange,
  themeSelectId = 'channel-ui-theme-key',
  legend = 'Settings',
  description = 'Sets the accent color used in this channel UI.',
  children,
}: ChannelUiDefaultsSettingsSectionProps) {
  const themeKey = (uiDefaults?.themeKey ?? 'teal') as ThemeKey;
  const defaultRightPanelOpen = uiDefaults?.defaultRightPanelOpen ?? true;
  const defaultRightPanelKey: 'channel_info' | 'saved' =
    uiDefaults?.defaultRightPanelKey === 'saved' ? 'saved' : 'channel_info';
  const infoPanel = uiDefaults?.infoPanel ?? {};

  const updateInfoPanel = (
    patch: NonNullable<ChannelUiDefaultsVM['infoPanel']>,
  ) => {
    onUiDefaultsChange({
      infoPanel: {
        ...(infoPanel ?? {}),
        ...patch,
      },
    });
  };

  return (
    <FieldSet>
      <FieldLegend>{legend}</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={themeSelectId}>Color theme</FieldLabel>
          <Select
            value={themeKey}
            onValueChange={(value) =>
              onUiDefaultsChange({ themeKey: value as ThemeKey })
            }
          >
            <SelectTrigger id={themeSelectId}>
              <SelectValue placeholder="Select color" />
            </SelectTrigger>
            <SelectContent>
              {PROFILE_THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className={`flex items-center gap-2 theme-${option.value}`}>
                    <span className="theme-swatch h-3.5 w-3.5 rounded-full" />
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{description}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${themeSelectId}-default-open`}>
            Open panel by default
          </FieldLabel>
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`${themeSelectId}-default-open`}
              checked={defaultRightPanelOpen}
              onCheckedChange={(checked) =>
                onUiDefaultsChange({ defaultRightPanelOpen: checked === true })
              }
            />
            Enable auto-open
          </Label>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${themeSelectId}-default-key`}>
            Default panel tab
          </FieldLabel>
          <Select
            value={defaultRightPanelKey}
                onValueChange={(value) =>
                  onUiDefaultsChange({
                defaultRightPanelKey: value as 'channel_info' | 'saved',
              })
            }
          >
            <SelectTrigger id={`${themeSelectId}-default-key`}>
              <SelectValue placeholder="Select tab" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="channel_info">Channel info</SelectItem>
              <SelectItem value="saved">Saved</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Info panel sections</FieldLabel>
          <div className="grid gap-2 pt-1 md:grid-cols-2">
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={infoPanel.showHeader ?? true}
                onCheckedChange={(checked) =>
                  updateInfoPanel({ showHeader: checked === true })
                }
              />
              Header
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={infoPanel.showDetails ?? true}
                onCheckedChange={(checked) =>
                  updateInfoPanel({ showDetails: checked === true })
                }
              />
              Details
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={infoPanel.showMedia ?? true}
                onCheckedChange={(checked) =>
                  updateInfoPanel({ showMedia: checked === true })
                }
              />
              Media
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={infoPanel.showMembers ?? true}
                onCheckedChange={(checked) =>
                  updateInfoPanel({ showMembers: checked === true })
                }
              />
              Members
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={infoPanel.showQuickActions ?? true}
                onCheckedChange={(checked) =>
                  updateInfoPanel({ showQuickActions: checked === true })
                }
              />
              Quick actions
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={infoPanel.showHiddenQuickActions ?? false}
                onCheckedChange={(checked) =>
                  updateInfoPanel({ showHiddenQuickActions: checked === true })
                }
              />
              Hidden quick actions
            </Label>
          </div>
        </Field>
        {children}
      </FieldGroup>
    </FieldSet>
  );
}
