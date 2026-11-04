// build.mjs --watch (contract section 7): rebuild on save and reload the open page through a small local http server with server-sent events.
// Node built-ins only. The server listens on 127.0.0.1 and serves the built deck with a few lines of reload script injected at serve time; the file on disk stays clean.
import { realpathSync, watch as fsWatch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const EVENTS = '/__md_events';

// Runs in the served page (dev only): reloads on 'reload', shows build errors in a banner.
const CLIENT = `<script>(function () {
  var bar = document.createElement('div');
  bar.setAttribute('style', 'position:fixed;left:0;right:0;top:0;z-index:99999;padding:8px 14px;background:#b00020;color:#fff;font:14px/1.4 ui-monospace,Consolas,monospace;display:none;white-space:pre-wrap');
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(bar); });
  var es = new EventSource('${EVENTS}');
  es.addEventListener('reload', function () { location.reload(); });
  es.addEventListener('problem', function (e) { bar.textContent = 'build failed: ' + e.data; bar.style.display = 'block'; });
  es.addEventListener('ok', function () { bar.style.display = 'none'; });
})();</script>`;

export const inject = (html) => (html.includes('</body>') ? html.replace('</body>', () => CLIENT + '</body>') : html + CLIENT);

// opts: { src, out, build(): Promise<{ out, slides, ... }>, check?(): Promise<string>, log, port = 0, debounce = 250 }
// Returns { url, port, close(), rebuilds() }. build() rejects with the reason (a BuildError message) when the source is broken; the last good page stays served.
export async function startWatch({ src, out, build, check = null, log = () => {}, port = 0, debounce = 250 }) {
  const srcPath = path.resolve(src);
  const outPath = path.resolve(out);
  const root = realpathSync.native(path.dirname(srcPath)); // libuv asserts on a Windows 8.3 short path
  let html = '';
  let rebuilds = 0;
  let running = false;
  let again = false;
  let timer = null;
  const clients = new Set();
  const send = (event, data = '') => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${String(data).split('\n')[0]}\n\n`);
  };

  const rebuild = async () => {
    if (running) { again = true; return; }
    running = true;
    const t0 = Date.now();
    try {
      do {
        again = false;
        try {
          const r = await build();
          html = await readFile(r.out, 'utf8');
          rebuilds++;
          log(`ok rebuild ${r.slides} slides in ${Date.now() - t0} ms`);
          send('ok');
          send('reload');
          if (check) check().then((line) => log(line), (err) => log(`fail check: ${err.message}`));
        } catch (err) {
          log(`fail rebuild: ${err.code ? err.code + ' ' : ''}${err.message}`);
          send('problem', `${err.code ? err.code + ' ' : ''}${err.message}`);
        }
      } while (again);
    } finally {
      running = false;
    }
  };

  await rebuild();
  if (!html) throw new Error('the first build failed; fix the source and start again');

  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === EVENTS) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write('retry: 500\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(inject(html));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  const onChange = (_event, name) => {
    const file = name ? path.resolve(root, String(name)) : '';
    if (file === realOut || /(^|[\\/])(tmp|\.git|node_modules)([\\/]|$)/.test(String(name || ''))) return; // our own output and tool folders
    clearTimeout(timer);
    timer = setTimeout(rebuild, debounce);
  };
  const realOut = path.join(root, path.basename(outPath)); // compared with the long path of the folder
  const watcher = fsWatch(root, { recursive: true }, onChange);

  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    port: address.port,
    rebuilds: () => rebuilds,
    async close() {
      clearTimeout(timer);
      watcher.close();
      for (const res of clients) res.end();
      clients.clear();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
