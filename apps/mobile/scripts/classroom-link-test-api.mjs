// Local synthetic HTTP boundary for native OS-link tests. Never use real credentials.
import { createServer } from 'node:http';
const requests = new Map();
const invite = 'i'.repeat(32);
const access = 'a'.repeat(32);
const server = createServer(async (req, res) => {
  const reply = (status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(body));
  };
  if (req.url === '/__health') return reply(200, { ready: true });
  if (req.url === '/__assert') {
    const scenarios = [...requests.values()];
    const passed =
      scenarios.length >= 4 &&
      scenarios.every((s) => !s.violation) &&
      scenarios.some((s) => s.joins >= 4) &&
      scenarios.some((s) => s.polls >= 3) &&
      scenarios.some((s) => s.handoffAttempts >= 2) &&
      scenarios.some((s) => s.expired);
    return reply(passed ? 200 : 409, { passed, scenarios: scenarios.length });
  }
  const match =
    /^\/live-sessions\/(e2e-(?:invite|waiting|handoff|expired)-[\w-]+)\/(public-info|link-info|guest-join|admission-status|quality-events)$/.exec(
      req.url ?? '',
    );
  if (!match) return reply(404, { message: 'Synthetic test route not found' });
  const [, id, action] = match;
  const state = requests.get(id) ?? {
    joins: 0,
    polls: 0,
    handoffAttempts: 0,
    violation: false,
    expired: false,
  };
  requests.set(id, state);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return reply(400, { message: 'Invalid test request' });
  }
  const personal = id.startsWith('e2e-handoff-');
  const info = {
    exists: true,
    isActive: true,
    sessionId: id,
    sessionTitle: 'Network link test',
    isHost: false,
    passcodeRequired: true,
    ...(personal ? { participant: { displayName: 'Handoff teacher' } } : {}),
  };
  if (action === 'public-info') return reply(200, info);
  if (action === 'link-info') {
    if (id.startsWith('e2e-expired-')) {
      state.expired = true;
      return reply(403, { message: 'Invalid or expired meeting link' });
    }
    if (body.handoff) {
      if (!/^[\w-]{32}$/.test(body.redemptionKey)) {
        state.violation = true;
        return reply(400, { message: 'Missing recovery identity' });
      }
      if (state.redemptionKey && state.redemptionKey !== body.redemptionKey) {
        state.violation = true;
        return reply(403, { message: 'Handoff already redeemed' });
      }
      state.redemptionKey = body.redemptionKey;
      state.handoffAttempts++;
      // Consume the handoff, then lose the response. The next OS link must reuse its key.
      if (state.handoffAttempts === 1) return req.socket.destroy();
      return reply(200, { info, linkToken: access });
    }
    if (body.token !== (personal ? access : invite)) {
      state.violation = true;
      return reply(403, { message: 'Invalid test invitation' });
    }
    return reply(200, { info, linkToken: body.token });
  }
  if (action === 'admission-status') {
    if (body.token !== state.admissionToken) {
      state.violation = true;
      return reply(403, { message: 'Unknown admission' });
    }
    state.polls++;
    return reply(200, {
      token: body.token,
      status: state.polls >= 3 ? 'approved' : 'waiting',
    });
  }
  if (action === 'guest-join') {
    if (
      !/^[\w-]{32}$/.test(body.admissionToken) ||
      body.linkToken !== (personal ? access : invite) ||
      body.passcode !== ''
    ) {
      state.violation = true;
      return reply(400, {
        message: 'First join must carry admission and invitation identities',
      });
    }
    if (state.admissionToken && state.admissionToken !== body.admissionToken) {
      state.violation = true;
      return reply(403, { message: 'Admission identity changed on recovery' });
    }
    state.admissionToken = body.admissionToken;
    state.joins++;
    if (id.startsWith('e2e-waiting-') && state.polls < 3)
      return reply(202, { admission: { token: body.admissionToken, status: 'waiting' } });
    return reply(200, {
      sessionName: 'Network link test',
      displayName: body.displayName,
      token: 'synthetic-invalid-sdk-jwt',
      expiresAt: null,
    });
  }
  return reply(204, undefined);
});
server.listen(8999, '127.0.0.1', () =>
  process.stdout.write('Synthetic link API ready on localhost:8999\n'),
);
