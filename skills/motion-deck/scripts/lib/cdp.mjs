// Tiny DevTools protocol client over Node's global WebSocket. Every wait has a timeout; a closed socket rejects pending calls.

const DEFAULT_TIMEOUT = 20000;

function withTimeout(promise, ms, what) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms} ms: ${what}`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

// Connects to the browser endpoint, creates a blank page target and attaches to it (flat session).
export async function openPage(wsUrl, { timeout = DEFAULT_TIMEOUT } = {}) {
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
  const listeners = new Map();
  let sessionId = null;

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
      for (const fn of [...(listeners.get(msg.method) || [])]) fn(msg.params || {}, msg.sessionId);
    }
  });

  function send(method, params = {}, { timeout: ms = timeout, session = sessionId } = {}) {
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

  function on(method, fn) {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(fn);
    return () => listeners.get(method).delete(fn);
  }

  // Resolves with the params of the next matching event. Create the promise before triggering the event, then await it.
  function waitFor(method, { timeout: ms = timeout, filter = () => true } = {}) {
    let off;
    const seen = new Promise((resolve) => {
      off = on(method, (params) => filter(params) && resolve(params));
    });
    return withTimeout(seen, ms, `event ${method}`).finally(() => off());
  }

  // Evaluates in the page; throws when the expression throws or the awaited promise rejects.
  async function evaluate(expression, { awaitPromise = false, timeout: ms = timeout } = {}) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }, { timeout: ms });
    if (res.exceptionDetails) {
      const ex = res.exceptionDetails;
      const text = (ex.exception && (ex.exception.description || ex.exception.value)) || ex.text;
      throw new Error(String(text).split('\n')[0]);
    }
    return res.result.value;
  }

  function close() {
    failAll('DevTools client closed');
    try {
      ws.close();
    } catch {}
  }

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, { session: null });
  const attached = await send('Target.attachToTarget', { targetId, flatten: true }, { session: null });
  sessionId = attached.sessionId;
  return { send, on, waitFor, evaluate, close, timeout };
}
