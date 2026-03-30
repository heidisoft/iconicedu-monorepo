import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('MessagesShell', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(resolve(dirname(filename), 'messages-shell.tsx'), 'utf8');

  it('forwards create message button visibility to state provider', () => {
    expect(source).toContain(
      'showCreateMessageTypeButton={props.showCreateMessageTypeButton}',
    );
  });

  it('passes container props through to MessagesContainer', () => {
    expect(source).toContain('<MessagesContainer {...props} />');
  });

  it('wraps the header row in the shared top surface', () => {
    expect(source).toContain(
      '<MessagesTopSurface channel={props.channel} data-testid="messages-top-surface-header">',
    );
  });
});
