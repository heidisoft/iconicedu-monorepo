import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupTestMailbox,
  parseLocalStatus,
  requireLocalUrl,
  requireTestEmail,
} from './auth-e2e.mjs';

test('auth E2E refuses hosted services, non-HTTP URLs, and localhost lookalikes', () => {
  for (const url of [
    'https://example.supabase.co',
    'http://localhost.example.com',
    'http://127.0.0.1.example.com',
    'file:///tmp/mail',
    'https://localhost',
  ]) {
    assert.throws(() => requireLocalUrl(url));
  }
  assert.equal(requireLocalUrl('http://127.0.0.1:54321').port, '54321');
});
test('auth E2E validates every service before any mutation', () => {
  const local = {
    API_URL: 'http://127.0.0.1:54321',
    INBUCKET_URL: 'http://localhost:54324',
    DB_URL: 'postgres://postgres:test@127.0.0.1:54322/postgres',
    ANON_KEY: 'local-placeholder',
    SERVICE_ROLE_KEY: 'local-placeholder',
  };
  assert.equal(parseLocalStatus(local), local);
  assert.throws(() =>
    parseLocalStatus({ ...local, INBUCKET_URL: 'https://mail.example.com' }),
  );
  assert.throws(() =>
    parseLocalStatus({ ...local, DB_URL: 'postgres://hosted.example.com/postgres' }),
  );
});
test('cleanup refuses non-fixture accounts', () => {
  requireTestEmail('maestro-auth-123-abcd@example.test');
  assert.throws(() => requireTestEmail('somebody@example.test'));
  assert.throws(() => requireTestEmail('maestro-auth-123@example.com'));
});

test('mail polling selects a new message and rejects stale codes', () => {
  const source = readFileSync(
    new URL('../.maestro/auth/read-otp.js', import.meta.url),
    'utf8',
  );
  const output = { lastMailId: 'old-message' };
  const context = {
    MAIL_URL: 'http://127.0.0.1:54324',
    TEST_EMAIL: 'maestro-auth-123-abcd@example.test',
    output,
    json: JSON.parse,
    http: {
      get: (url) => ({
        status: 200,
        body: JSON.stringify(
          url.endsWith('/new-message')
            ? { body: { text: 'Your verification code is 123456.' } }
            : [
                { id: 'old-message', date: '2026-01-01T00:00:00Z' },
                { id: 'new-message', date: '2026-01-01T00:00:01Z' },
              ],
        ),
      }),
    },
  };
  runInNewContext(source, context);
  assert.equal(output.otp, '123456');
  assert.notEqual(output.invalidOtp, output.otp);
  assert.equal(output.lastMailId, 'new-message');
  context.http.get = () => ({
    status: 200,
    body: JSON.stringify([{ id: 'new-message', date: '2026-01-01' }]),
  });
  assert.throws(() => runInNewContext(source, context), /Waiting for the new local/);
  assert.throws(
    () => runInNewContext(source, { ...context, MAIL_URL: 'https://mail.example.com' }),
    /loopback/,
  );
});

test('runtime guard refuses missing or hosted app runtimes before auth input', () => {
  const source = readFileSync(
    new URL('../.maestro/auth/verify-runtime.js', import.meta.url),
    'utf8',
  );
  const context = {
    RUNTIME_URL: 'http://127.0.0.1:8082',
    json: JSON.parse,
    http: { get: () => ({ body: '[]' }) },
  };
  assert.throws(() => runInNewContext(source, context), /refusing auth input/);
  context.http.get = () => ({
    status: 200,
    body: JSON.stringify([{ title: 'com.heidisoft.iconicedu (test simulator)' }]),
  });
  runInNewContext(source, context);
  assert.throws(
    () => runInNewContext(source, { ...context, RUNTIME_URL: 'https://example.com' }),
    /loopback runtime/,
  );
});

test('mail polling supports the local Supabase Mailpit inbox', () => {
  const source = readFileSync(
    new URL('../.maestro/auth/read-otp.js', import.meta.url),
    'utf8',
  );
  const output = {};
  runInNewContext(source, {
    MAIL_URL: 'http://127.0.0.1:54324',
    TEST_EMAIL: 'maestro-auth-123-abcd@example.test',
    output,
    json: JSON.parse,
    http: {
      get: (url) =>
        url.includes('/mailbox/')
          ? { status: 404, body: 'File not found' }
          : {
              status: 200,
              body: JSON.stringify(
                url.includes('/message/')
                  ? { Text: 'Code 123456' }
                  : { messages: [{ ID: 'fresh-message', Created: '2026-01-01' }] },
              ),
            },
    },
  });
  assert.equal(output.otp, '123456');
  assert.equal(output.lastMailId, 'fresh-message');
});

test('Mailpit cleanup deletes only exact fixture recipients and never sends empty IDs', async () => {
  const email = 'maestro-auth-123-abcd@example.test';
  const deleted = [];
  let messages = [
    { ID: 'fixture', To: [{ Address: email }] },
    { ID: 'keep', To: [{ Address: 'somebody@example.test' }] },
  ];
  const request = async (url, options) => {
    if (url.includes('/mailbox/')) return { ok: false, status: 405 };
    if (url.includes('/search?')) return { ok: true, json: async () => ({ messages }) };
    deleted.push(JSON.parse(options.body));
    return { ok: true };
  };
  await cleanupTestMailbox('http://127.0.0.1:54324', email, request);
  assert.deepEqual(deleted, [{ IDs: ['fixture'] }]);
  messages = [];
  await cleanupTestMailbox('http://127.0.0.1:54324', email, request);
  assert.equal(deleted.length, 1);
  await assert.rejects(cleanupTestMailbox('https://mail.example.com', email, request));
  await assert.rejects(
    cleanupTestMailbox('http://127.0.0.1:54324', 'somebody@example.test', request),
  );
});
