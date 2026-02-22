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

type ChannelUiDefaultsSettingsSectionProps = {
  uiDefaults?: Pick<ChannelUiDefaultsVM, 'themeKey'> | null;
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
        {children}
      </FieldGroup>
    </FieldSet>
  );
}
