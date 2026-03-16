import * as React from 'react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@iconicedu/ui-web/ui/input-group';
import { Label } from '@iconicedu/ui-web/ui/label';

type ContactFieldProps = {
  id: string;
  label: string;
  value: string;
  helperText?: string | null;
  error?: string | null;
  placeholder?: string;
  required?: boolean;
  highlight?: boolean;
  addon?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onChange: (value: string) => void;
};

export const ContactField = React.forwardRef<HTMLInputElement, ContactFieldProps>(
  (
    {
      id,
      label,
      value,
      helperText,
      error,
      placeholder,
      required = false,
      highlight = false,
      addon,
      disabled,
      ariaLabel,
      onFocus,
      onBlur,
      onChange,
    },
    ref,
  ) => {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <div className="relative rounded-full">
          {highlight ? (
            <span className="pointer-events-none absolute inset-0 rounded-full border border-primary/50" />
          ) : null}
          <InputGroup>
            <InputGroupInput
              id={id}
              ref={ref}
              value={value}
              placeholder={placeholder}
              aria-label={ariaLabel ?? label}
              disabled={disabled}
              onFocus={onFocus}
              onBlur={onBlur}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onChange(event.target.value)
              }
            />
            {addon ? <InputGroupAddon align="inline-end">{addon}</InputGroupAddon> : null}
          </InputGroup>
        </div>
        {helperText ? (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  },
);

ContactField.displayName = 'ContactField';
