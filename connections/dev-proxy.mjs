/* ────────────────────────────────────────────────────────────────────────
   Local dev proxy (Mode 1) — token-injecting broker for previewing REAL data
   on localhost, where the browser has no session cookie.

   You only need this to test an app against live data locally. Synthetic-mode
   preview and production deploy do NOT use it.

   Run:   APP_TOKEN=xxxx CORE=https://<core-host>/api node connections/dev-proxy.mjs
   Then:  serve the app and point its fetches at http://localhost:8787
          (i.e. temporarily make apiBase() return 'http://localhost:8787' in dev).

   The token lives in your shell/.env (gitignored) and is NEVER bundled.
   ──────────────────────────────────────────────────────────────────────── */
import http from 'node:http';

const PORT  = process.env.PORT || 8787;
const CORE  = process.env.CORE || 'https://your-core-host/api';
const TOKEN = process.env.APP_TOKEN || '';
const WORKSPACE_ID = process.env.WORKSPACE_ID || '';

if (!TOKEN) console.warn('[dev-proxy] WARNING: APP_TOKEN is empty — every call will 401.');

http.createServer(async (req, res) => {
  const target = CORE + req.url.replace(/^\/?/, '/');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': 'application/json',
        'X-App-Token': TOKEN,                 // injected here — the deployed app gets this from its cookie instead
        'X-Workspace-Id': WORKSPACE_ID,
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    });
    res.writeHead(upstream.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.writeHead(502); res.end(JSON.stringify({ error: String(e) }));
  }
}).listen(PORT, () => console.log(`[dev-proxy] :${PORT} → ${CORE}  (token ${TOKEN ? 'set' : 'MISSING'})`));
