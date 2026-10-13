import type { WhiteboardDocumentVM } from '@iconicedu/shared-types';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Local synthetic data only. No production DB URL or existing user records are read. */
function sql(statement: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_iconicedu-monorepo',
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { input: statement, encoding: 'utf8' },
  ).trim();
}
export function createWhiteboardClass() {
  const org = randomUUID(),
    account = randomUUID(),
    profile = randomUUID(),
    channel = randomUUID(),
    session = randomUUID(),
    board = randomUUID(),
    page = randomUUID();
  const teacher = randomBytes(32).toString('base64url'),
    student = randomBytes(32).toString('base64url');
  const hash = (token: string) => createHash('sha256').update(token).digest('hex');
  sql(`begin;
    insert into public.orgs(id,name,slug) values ('${org}','Whiteboard E2E','whiteboard-e2e-${org}');
    insert into public.accounts(id,org_id) values ('${account}','${org}');
    insert into public.profiles(id,org_id,account_id,kind,display_name,avatar_source,timezone) values ('${profile}','${org}','${account}','educator','Test teacher','seed','UTC');
    insert into public.channels(id,org_id,kind,topic,visibility,purpose) values ('${channel}','${org}','channel','Test class','private','learning-space');
    insert into public.channel_live_sessions(id,org_id,channel_id,provider,session_scope_key,status,started_by_profile_id,join_path) values ('${session}','${org}','${channel}','zoom','${session}','live','${profile}','/live/${session}');
    insert into public.classroom_whiteboards(id,org_id,channel_id,scope_key,document) values ('${board}','${org}','${channel}','class-occurrence:${session}','{"schemaVersion":1,"studentEditing":true,"pages":[{"id":"${page}","title":"Page 1","elements":[]}]}');
    insert into public.classroom_whiteboard_access(token_hash,board_id,live_session_id,role,display_name,expires_at) values
      ('${hash(teacher)}','${board}','${session}','teacher','Test teacher',now()+interval '1 hour'),
      ('${hash(student)}','${board}','${session}','student','Test student',now()+interval '1 hour');
    commit;`);
  return {
    board,
    page,
    teacher,
    student,
    seedDocument: (document: WhiteboardDocumentVM) =>
      sql(
        `update public.classroom_whiteboards set document='${JSON.stringify(document).replace(/'/g, "''")}'::jsonb where id='${board}';`,
      ),
    cleanup: () => sql(`delete from public.orgs where id='${org}';`),
  };
}
export async function joinClassAs(
  browser: Browser,
  token: string,
  title = 'Tutoring class',
  viewport?: { width: number; height: number },
  presentation = false,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    ({ token, title, presentation }) =>
      sessionStorage.setItem(
        'whiteboard-test-entry',
        JSON.stringify({ token, title, presentation }),
      ),
    { token, title, presentation },
  );
  const page = await context.newPage();
  await page.goto('/visual-test/whiteboard');
  await page.getByRole('button', { name: 'Join class whiteboard' }).click();
  if (!presentation) {
    await page.getByTestId('whiteboard-toolbar').waitFor();
    await expect(page.getByRole('button', { name: 'Pen', exact: true })).toBeEnabled();
  }
  return { context, page };
}
export async function draw(page: Page) {
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  const box = await page.getByTestId('whiteboard-canvas').boundingBox();
  if (!box) throw new Error('Canvas missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 50, {
    steps: 8,
  });
  await page.mouse.up();
}
