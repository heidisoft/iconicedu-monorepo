import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createWhiteboardClass, joinClassAs, draw } from './helpers/whiteboard-class';

test.use({ trace: 'off', video: 'off' });
test('web and native share actual API drawing, permissions and presentation state', async ({
  browser,
}) => {
  const device = process.env.NATIVE_SYNC_DEVICE_ID;
  test.skip(
    !device,
    'Requires an installed native simulator, Metro, and local apps/api on port 8998.',
  );
  test.setTimeout(360000);
  const root = resolve(process.cwd(), '../..');
  const folder = await mkdtemp(resolve(tmpdir(), 'iconic-whiteboard-sync-'));
  const fixture = createWhiteboardClass();
  const entryFile = resolve(folder, 'entry.json');
  await writeFile(entryFile, JSON.stringify(fixture), { mode: 0o600 });
  const proxy = spawn(
    process.execPath,
    ['apps/mobile/scripts/whiteboard-sync-test-proxy.mjs'],
    {
      cwd: root,
      env: { ...process.env, WHITEBOARD_SYNC_ENTRY_FILE: entryFile },
      stdio: 'ignore',
    },
  );
  const maestro = async (flow: string) => {
    const log = await open(resolve(folder, `${flow}.log`), 'w');
    try {
      await new Promise<void>((success, failure) => {
        const child = spawn(
          'maestro',
          [
            '--device',
            device!,
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
            : failure(
                new Error(
                  `Native ${flow} failed; inspect local diagnostics in ${folder}`,
                ),
              ),
        );
      });
    } finally {
      await log.close();
    }
  };
  try {
    await expect
      .poll(async () => {
        try {
          return (await fetch('http://127.0.0.1:8999/__whiteboard-entry?role=student'))
            .ok;
        } catch {
          return false;
        }
      })
      .toBe(true);
    const { page, context } = await joinClassAs(
      browser,
      fixture.teacher,
      'Cross-client class',
      undefined,
      true,
    );
    await expect(page.getByText('Whiteboard is closed')).toBeVisible();
    await maestro('whiteboard-sync-join');
    await page.getByRole('button', { name: 'Open class whiteboard' }).click();
    await page.getByTestId('whiteboard-toolbar').waitFor();
    await draw(page);
    await expect(page.getByTestId('classroom-whiteboard')).toHaveAttribute(
      'data-element-count',
      '1',
    );
    await maestro('whiteboard-sync-draw');
    await expect
      .poll(async () =>
        Number(
          await page
            .getByTestId('classroom-whiteboard')
            .getAttribute('data-element-count'),
        ),
      )
      .toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Board options' }).click();
    await page
      .getByRole('menuitemcheckbox', { name: 'Allow participants to annotate' })
      .click();
    await maestro('whiteboard-sync-readonly');
    await page.getByRole('button', { name: 'End class whiteboard' }).click();
    await maestro('whiteboard-sync-closed');
    await maestro('whiteboard-sync-present');
    await expect(page.getByTestId('classroom-whiteboard')).toBeVisible();
    await expect
      .poll(async () =>
        Number(
          await page
            .getByTestId('classroom-whiteboard')
            .getAttribute('data-element-count'),
        ),
      )
      .toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Board options' }).click();
    await expect(
      page.getByRole('menuitemcheckbox', { name: 'Allow participants to annotate' }),
    ).toBeChecked();
    await context.close();
  } finally {
    proxy.kill();
    fixture.cleanup();
    await rm(entryFile, { force: true });
  }
});
