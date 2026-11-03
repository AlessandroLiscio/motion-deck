// Finds Chrome or Edge, starts it headless with a throwaway profile and returns its DevTools endpoint.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PROFILE_PREFIX = 'md-check-profile-';

function candidates(env) {
  const win = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean);
  return {
    chrome: [
      env.CHROME_PATH,
      ...win.map((root) => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ],
    edge: [
      env.EDGE_PATH,
      ...win.map((root) => join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable',
    ],
  };
}

// which: 'auto' (Chrome first, then Edge), 'chrome' or 'edge'. Returns { name, path } or null.
export function findBrowser(which = 'auto', env = process.env) {
  const table = candidates(env);
  const names = which === 'auto' ? ['chrome', 'edge'] : [which];
  for (const name of names) {
    const path = (table[name] || []).find((p) => p && existsSync(p));
    if (path) return { name, path };
  }
  return null;
}

async function removeDir(dir) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === 39) throw err;
      await new Promise((r) => setTimeout(r, 250)); // EBUSY while the browser releases its files
    }
  }
}

// Returns { name, path, wsUrl, profile, close }. close() kills the whole process tree and deletes the profile.
export async function launchBrowser({ which = 'auto', startTimeout = 20000, env = process.env } = {}) {
  const found = findBrowser(which, env);
  if (!found) throw new Error(`no ${which === 'auto' ? 'Chrome or Edge' : which} found (set CHROME_PATH or EDGE_PATH)`);
  const profile = mkdtempSync(join(tmpdir(), PROFILE_PREFIX));
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', '--mute-audio', 'about:blank',
  ];
  const win = process.platform === 'win32';
  const child = spawn(found.path, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, detached: !win });

  // Killing is slow and sometimes needs a second try on Windows: kill the tree, then wait until every known browser process is gone.
  const pids = new Set([child.pid]);
  const alive = (pid) => {
    try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
  };
  const kill = () => {
    for (const pid of pids) {
      if (!alive(pid)) continue;
      if (win) spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
      else {
        try { process.kill(pid === child.pid ? -pid : pid, 'SIGKILL'); } catch {}
      }
    }
  };

  let closing = null;
  // grace: ms to let the browser exit on its own (after Browser.close) before the kill starts.
  const close = ({ grace = 0 } = {}) => {
    closing ??= (async () => {
      for (const end = Date.now() + grace; Date.now() < end && [...pids].some(alive);) await new Promise((r) => setTimeout(r, 100));
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        kill();
        for (let i = 0; i < 10 && [...pids].some(alive); i++) await new Promise((r) => setTimeout(r, 200));
        if (![...pids].some(alive)) break;
      }
      await removeDir(profile);
    })();
    return closing;
  };

  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let text = '';
      const timer = setTimeout(() => reject(new Error(`${found.name} did not print its DevTools endpoint within ${startTimeout} ms`)), startTimeout);
      child.stderr.on('data', (chunk) => {
        text += chunk;
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(text);
        if (m) { clearTimeout(timer); resolve(m[1]); }
        if (text.length > 20000) text = text.slice(-5000);
      });
      child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`${found.name} exited with code ${code} before it was ready`)); });
      child.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
    return { ...found, wsUrl, profile, close, trackPids: (list) => list.forEach((pid) => pids.add(pid)) };
  } catch (err) {
    await close().catch(() => {});
    throw err;
  }
}
