import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('MessageInput create type button', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(resolve(dirname(filename), 'message-input.tsx'), 'utf8');

  it('renders the create message type button only when enabled', () => {
    expect(source).toContain('showCreateMessageTypeButton ? (');
    expect(source).toContain('aria-label="Create message type"');
  });

  it('does not render create-menu elements outside of the gated branch', () => {
    expect(source).toContain('showCreateMessageTypeButton ? (');
    expect(source).toContain('<DropdownMenu');
  });
});
