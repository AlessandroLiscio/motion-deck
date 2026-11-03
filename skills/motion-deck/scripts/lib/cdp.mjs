// Tiny DevTools protocol client over Node's global WebSocket. Every wait has a timeout; a closed socket rejects pending calls.

const DEFAULT_TIMEOUT = 20000;

function withTimeout(promise, ms, what) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms} ms: ${what}`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

// Key table for trusted key events (Input.dispatchKeyEvent): [windowsVirtualKeyCode, code].
const KEYS = {
  ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'], Escape: [27, 'Escape'], ' ': [32, 'Space'],
  Enter: [13, 'Enter'], Backspace: [8, 'Backspace'], PageDown: [34, 'PageDown'], PageUp: [33, 'PageUp'], Home: [36, 'Home'], End: [35, 'End'],
};

// Connects to the browser endpoint. Returns a client with browser-level send/on and page targets (newPage, attach).
export async function openBrowser(wsUrl, { timeout = DEFAULT_TIMEOUT } = {}) {
  const ws = new WebSocket(wsUrl);
  await withTimeout(
    new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('cannot connect to the browser DevTools endpoint')), { once: true });
    }),
    timeout,
    'DevTools connect',
  );

  let nextId = 0;
  let closedReason = null;
  const pending = new Map();
  const listeners = new Map(); // method -> Set<{ fn, session }>

  const failAll = (reason) => {
    closedReason = reason;
    for (const { reject, method } of pending.values()) reject(new Error(`${method}: ${reason}`));
    pending.clear();
  };
  ws.addEventListener('close', () => failAll('DevTools socket closed'));
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined) {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
      else entry.resolve(msg.result);
    } else if (msg.method) {
      for (const l of [...(listeners.get(msg.method) || [])]) if (l.session === undefined || l.session === msg.sessionId) l.fn(msg.params || {}, msg.sessionId);
    }
  });

  // session: a flat session id, or null for the browser itself.
  function send(method, params = {}, { timeout: ms = timeout, session = null } = {}) {
    if (closedReason) return Promise.reject(new Error(`${method}: ${closedReason}`));
    const id = ++nextId;
    const call = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify(session ? { id, method, params, sessionId: session } : { id, method, params }));
    });
    return withTimeout(call, ms, method).catch((err) => {
      pending.delete(id);
      throw err;
    });
  }

  function on(method, fn, session) {
    if (!listeners.has(method)) listeners.set(method, new Set());
    const entry = { fn, session };
    listeners.get(method).add(entry);
    return () => listeners.get(method).delete(entry);
  }

  function makePage(sessionId, targetId) {
    const psend = (method, params = {}, o = {}) => send(method, params, { timeout: o.timeout ?? timeout, session: 'session' in o ? o.session : sessionId });
    const pon = (method, fn) => on(method, fn, sessionId);

    // Resolves with the params of the next matching event. Create the promise before triggering the event, then await it.
    function waitFor(method, { timeout: ms = timeout, filter = () => true } = {}) {
      let off;
      const seen = new Promise((resolve) => {
        off = pon(method, (params) => filter(params) && resolve(params));
      });
      const result = withTimeout(seen, ms, `event ${method}`).finally(() => off());
      result.catch(() => {}); // a caller that fails before awaiting must not leave an unhandled rejection
      return result;
    }

    // Evaluates in the page; throws when the expression throws or the awaited promise rejects.
    async function evaluate(expression, { awaitPromise = false, timeout: ms = timeout } = {}) {
      const res = await psend('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }, { timeout: ms });
      if (res.exceptionDetails) {
        const ex = res.exceptionDetails;
        const text = (ex.exception && (ex.exception.description || ex.exception.value)) || ex.text;
        throw new Error(String(text).split('\n')[0]);
      }
      return res.result.value;
    }

    // A trusted key press (a synthetic KeyboardEvent cannot open a popup).
    async function key(name) {
      const [vk, code] = KEYS[name] || [name.toUpperCase().charCodeAt(0), `Key${name.toUpperCase()}`];
      const text = name.length === 1 ? name : undefined;
      await psend('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: vk, text });
      await psend('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk });
    }

    const closeTarget = () => send('Target.closeTarget', { targetId }).catch(() => {});
    return { send: psend, on: pon, waitFor, evaluate, key, targetId, sessionId, closeTarget, timeout };
  }

  async function attach(targetId) {
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    return makePage(sessionId, targetId);
  }

  async function newPage(url = 'about:blank') {
    const { targetId } = await send('Target.createTarget', { url });
    return attach(targetId);
  }

  const targets = async () => (await send('Target.getTargets')).targetInfos.filter((t) => t.type === 'page');

  function close() {
    failAll('DevTools client closed');
    try {
      ws.close();
    } catch {}
  }
  return { send, on, attach, newPage, targets, close, timeout };
}

// One browser connection with one blank page: the shape the check uses. page.close() closes the whole connection.
export async function openPage(wsUrl, { timeout = DEFAULT_TIMEOUT } = {}) {
  const browser = await openBrowser(wsUrl, { timeout });
  const page = await browser.newPage();
  return { ...page, close: browser.close, browser };
}
