import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { parseAllDocuments } from 'yaml';

for (const platform of ['Darwin', 'Linux']) {
  test(`launch installed client on ${platform} without rebuilding or clearing cache`, () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mobile-launch-'));
    try {
      mkdirSync(path.join(root, 'scripts'));
      mkdirSync(path.join(root, 'ios'));
      mkdirSync(path.join(root, 'bin'));
      writeFileSync(
        path.join(root, 'scripts/dev-mobile.sh'),
        readFileSync(new URL('./dev-mobile.sh', import.meta.url)),
      );
      writeFileSync(path.join(root, 'bin/uname'), `#!/bin/sh\necho ${platform}\n`, {
        mode: 0o755,
      });
      writeFileSync(
        path.join(root, 'bin/pnpm'),
        '#!/bin/sh\nprintf "%s\\n" "$@" > "$LAUNCH_ARGS"\n',
        {
          mode: 0o755,
        },
      );
      for (const input of ['n\n', '']) {
        const result = spawnSync(
          '/bin/bash',
          ['scripts/dev-mobile.sh', '--port', '8090'],
          {
            cwd: root,
            input,
            encoding: 'utf8',
            env: {
              ...process.env,
              PATH: `${root}/bin:${process.env.PATH}`,
              LAUNCH_ARGS: path.join(root, 'args'),
            },
          },
        );
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(
          readFileSync(path.join(root, 'args'), 'utf8').trim().split('\n'),
          [
            'exec',
            'expo',
            'start',
            '--dev-client',
            ...(platform === 'Darwin' ? ['--ios'] : []),
            '--port',
            '8090',
          ],
        );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const override of [undefined, '8091']) {
  test(`classroom bootstrap resolves the Metro URL with ${override ?? 'default'} port`, () => {
    const [header, flow] = parseAllDocuments(
      readFileSync(new URL('../.maestro/bootstrap.yaml', import.meta.url), 'utf8'),
    ).map((document) => document.toJS());
    const environment = { ...header.env, ...(override ? { METRO_PORT: override } : {}) };
    const template = flow.find((step) => step.openLink).openLink;
    const resolved = template.replace(/\$\{([^}]+)\}/g, (_, expression) =>
      String(runInNewContext(expression, environment)),
    );
    const launcher = new URL(resolved);
    const metro = new URL(launcher.searchParams.get('url'));
    assert.equal(metro.hostname, '127.0.0.1');
    assert.equal(metro.port, override ?? '8085');
    assert.equal(metro.searchParams.get('disableOnboarding'), '1');
  });
}
