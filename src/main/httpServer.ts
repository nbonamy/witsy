import http from 'node:http';
import { URL } from 'node:url';

let server: http.Server | null = null;

/**
 * Minimal local HTTP trigger server (localhost-only, no auth).
 *
 * Endpoints:
 * - GET  /health
 *     Response: { ok: true }
 *
 * - GET  /trigger?cmd=<string>&text=<string>
 *   or
 * - POST /trigger           (Content-Type: application/json)
 *     Body: { "cmd": "<string>", "text": "<string>" }
 *
 * Supported cmd values:
 *   prompt | chat | scratchpad | command | readaloud | transcribe | realtime | studio | forge
 *
 * Text handling:
 *   - If provided, 'text' is forwarded to the handler so the main process can use putCachedText(text)
 *     and open the appropriate window (e.g., Prompt Anywhere with promptId, Command Picker with textId).
 *
 * Notes:
 *   - Keep this server minimal by design (no external deps, no auth, 127.0.0.1 binding).
 *   - For long or multi-line texts, prefer POST/JSON.
 *   - Logging: each request is logged with cmd and text length.
 */
export const start = (
  port: number,
  handler: (cmd: string, params?: { text?: string }) => Promise<boolean> | boolean
): boolean => {
  if (server) {
    return true;
  }
  try {
    server = http.createServer((req, res) => {
      const host = req.headers.host || `127.0.0.1:${port}`;
      const url = new URL(req.url || '/', `http://${host}`);
      res.setHeader('Content-Type', 'application/json');

      const respond = (status: number, obj: any) => {
        res.statusCode = status;
        res.end(JSON.stringify(obj));
      };

      // Health endpoint
      if (req.method === 'GET' && url.pathname === '/health') {
        return respond(200, { ok: true });
      }

      if (url.pathname === '/trigger' && (req.method === 'GET' || req.method === 'POST')) {

        const finalize = async (cmd: string, params: { text?: string }) => {
          let ok = false;
          if (cmd) {
            try {
              ok = await Promise.resolve(handler(cmd, params));
            } catch {
              ok = false;
            }
          }
          return respond(ok ? 200 : 400, { success: ok, cmd });
        };

        if (req.method === 'GET') {
          const cmd = url.searchParams.get('cmd') || '';
          const text = url.searchParams.get('text') || undefined;
          console.info(`[http-trigger] GET /trigger cmd=${cmd} textLen=${(text || '').length}`);
          return finalize(cmd, { text });
        }

        // POST JSON payload
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 1e6) {
            req.socket.destroy();
          }
        });
        req.on('end', () => {
          try {
            const json = body ? JSON.parse(body) : {};
            const cmd = (json?.cmd ?? '').toString();
            const text = typeof json?.text === 'string' ? json.text : undefined;
            console.info(`[http-trigger] POST /trigger cmd=${cmd} textLen=${text ? text.length : 0}`);
            finalize(cmd, { text });
          } catch {
            respond(400, { success: false, error: 'INVALID_JSON' });
          }
        });
        return;
      }

      // Not found
      respond(404, { success: false, error: 'NOT_FOUND' });
    }).listen(port, '127.0.0.1');

    server.on('error', (err: any) => {
      console.warn('HTTP server error:', err?.message || err);
    });

    console.info(`HTTP trigger server listening on http://127.0.0.1:${port}`);
    return true;
  } catch (e) {
    console.warn('Failed to start HTTP server:', e);
    server = null;
    return false;
  }
};

export const stop = (): void => {
  if (server) {
    try {
      const s = server;
      server = null;
      s.close();
      console.info('HTTP trigger server stopped');
    } catch {
      /* empty */
    }
  }
};
