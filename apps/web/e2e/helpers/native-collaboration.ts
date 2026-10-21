import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
/** Test capabilities stay in a private local bootstrap file, never command arguments. */
export async function nativeCollaboration(device: string, entry: object) {
  const root = resolve(process.cwd(), '../..');
  const folder = await mkdtemp(resolve(tmpdir(), 'iconic-annotation-sync-'));
  const entryFile = resolve(folder, 'entry.json');
  await writeFile(entryFile, JSON.stringify(entry), { mode: 0o600 });
  const proxy = spawn(
    process.execPath,
    ['apps/mobile/scripts/whiteboard-sync-test-proxy.mjs'],
    {
      cwd: root,
      env: { ...process.env, WHITEBOARD_SYNC_ENTRY_FILE: entryFile },
      stdio: 'ignore',
    },
  );
  return {
    async ready() {
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          if ((await fetch('http://127.0.0.1:8999/__health')).ok) return;
        } catch {
          /* Wait for the local proxy. */
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('Local collaboration proxy did not start');
    },
    async run(flow: string) {
      const log = await open(resolve(folder, `${flow}.log`), 'w');
      try {
        await new Promise<void>((success, failure) => {
          const child = spawn(
            'maestro',
            [
              '--device',
              device,
              'test',
              '-e',
              `RUN_ID=${Date.now()}`,
              '--debug-output',
              resolve(folder, `${flow}-artifacts`),
              `apps/mobile/.maestro/${flow}.yaml`,
            ],
            { cwd: root, stdio: ['ignore', log.fd, log.fd] },
          );
          child.once('error', failure);
          child.once('exit', (code) =>
            code === 0
              ? success()
              : failure(new Error(`Native ${flow} failed; inspect ${folder}`)),
          );
        });
      } finally {
        await log.close();
      }
    },
    async close() {
      proxy.kill();
      await rm(entryFile, { force: true });
    },
  };
}
