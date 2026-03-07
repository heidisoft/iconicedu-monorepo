import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('MessagesShellClient', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(
    resolve(dirname(filename), 'messages-shell-client.tsx'),
    'utf8',
  );

  it('forwards the create message type visibility flag to MessagesShell', () => {
    expect(source).toContain('showCreateMessageTypeButton={showCreateMessageTypeButton}');
  });

  it('builds message write client from action props', () => {
    expect(source).toContain('const messageWriteClient = useMemo');
    expect(source).toContain('sendTextMessage');
    expect(source).toContain('toggleReaction');
    expect(source).toContain('toggleSavedMessage');
    expect(source).toContain('deleteMessage');
    expect(source).toContain('toggleHiddenMessage');
  });
});
