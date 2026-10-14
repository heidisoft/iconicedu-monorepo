// Local-only test bootstrap and transparent proxy; apps/api owns all authorization/state.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const entry = JSON.parse(await readFile(process.env.WHITEBOARD_SYNC_ENTRY_FILE, 'utf8'));
createServer(async (req, res) => {
  if (req.url?.startsWith('/__whiteboard-entry?')) {
    const role = new URL(req.url, 'http://localhost').searchParams.get('role');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        sessionId: entry.session,
        credentials: {
          sessionName: 'Cross-client classroom',
          displayName: `Native ${role}`,
          token: 'synthetic-sdk-only',
          expiresAt: null,
          whiteboard: {
            provider: 'excalidraw',
            token: role === 'teacher' ? entry.teacher : entry.student,
          },
        },
      }),
    );
  }
  if (!req.url?.startsWith('/whiteboards/')) {
    res.writeHead(404);
    return res.end();
  }
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const upstream = await fetch(`http://127.0.0.1:8998${req.url}`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization ?? '',
      },
      ...(req.method === 'POST' ? { body } : {}),
    });
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
    res.end(await upstream.text());
  } catch {
    res.writeHead(502);
    res.end();
  }
}).listen(8999, '127.0.0.1', () => console.log('Local whiteboard proxy ready'));
