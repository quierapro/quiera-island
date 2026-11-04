// What a plugin sees of Quiera: the `quiera` object, timers and console.
// It runs before the plugin's code, with `host` the few native functions
// (each checked on the Rust side) and `language` the interface's ("fr" or
// "en"), and returns the function Rust calls to deliver events. The plugin
// cannot reach `host` itself.
(function (host, language) {
  "use strict";

  const actions = new Map();
  const lifecycle = { open: [], close: [] };
  const timers = new Map();
  const fetches = new Map();
  let nextId = 1;

  const text = (value) => {
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  // Every message to Quiera is one of the protocol's (see protocol.rs).
  const send = (message) => host.send(JSON.stringify(message));
  const report = (error) => send({ type: "log", level: "error", text: error && error.stack ? String(error.stack) : text(error) });

  // A handler that throws is reported; it does not stop the plugin.
  const call = (fn, ...args) => {
    try {
      const result = fn(...args);
      if (result && typeof result.then === "function") result.then(undefined, report);
    } catch (error) {
      report(error);
    }
  };

  const console = {};
  for (const level of ["log", "info", "warn", "error"]) {
    console[level] = (...args) => send({ type: "log", level, text: args.map(text).join(" ").slice(0, 2000) });
  }
  console.debug = console.log;

  function setTimer(fn, ms, repeat) {
    if (typeof fn !== "function") throw new TypeError("setTimeout needs a function");
    const id = nextId++;
    const delay = Math.max(repeat ? 1000 : 0, Number(ms) || 0);
    timers.set(id, { fn, delay, repeat });
    host.timer(id, delay);
    return id;
  }

  const quiera = Object.freeze({
    /** Quiera's language: "fr" or "en". */
    language,
    /** Shows `tree` in the plugin's tab (null empties it). */
    render(tree) {
      send({ type: "render", tree: tree === undefined ? null : tree });
    },
    /** The closed island, while it has something live to show. */
    activity: Object.freeze({
      set(activity) {
        send({ type: "activity", activity: activity === undefined ? null : activity });
      },
      clear() {
        send({ type: "activity", activity: null });
      },
    }),
    /** A moment on the island: { icon, title, text }. At most one every 10 s. */
    peek(peek) {
      send({ type: "peek", peek: peek === undefined ? null : peek });
    },
    /** Called when a button or toggle with this `action` is used. */
    on(action, handler) {
      if (typeof handler !== "function") throw new TypeError("on() needs a function");
      actions.set(String(action), handler);
    },
    /** The plugin's tab was opened, or left. */
    onOpen(handler) {
      lifecycle.open.push(handler);
    },
    onClose(handler) {
      lifecycle.close.push(handler);
    },
    /** A little memory of its own, kept between sessions (256 KB). */
    storage: Object.freeze({
      get(key) {
        const raw = host.storageGet(String(key));
        return raw === null || raw === undefined ? undefined : JSON.parse(raw);
      },
      set(key, value) {
        host.storageSet(String(key), value === undefined ? null : JSON.stringify(value));
      },
      remove(key) {
        host.storageSet(String(key), null);
      },
    }),
    /** HTTPS, to the hosts of the manifest's permissions only. */
    fetch(url, options = {}) {
      const id = nextId++;
      const headers = Object.entries(options.headers || {}).map(([k, v]) => [String(k), String(v)]);
      const request = { url: String(url), method: options.method, headers, body: options.body === undefined ? undefined : String(options.body) };
      return new Promise((resolve, reject) => {
        fetches.set(id, { resolve, reject });
        host.fetch(id, JSON.stringify(request));
      });
    },
  });

  Object.defineProperties(globalThis, {
    quiera: { value: quiera, enumerable: true },
    console: { value: Object.freeze(console), enumerable: true, writable: true, configurable: true },
    setTimeout: { value: (fn, ms) => setTimer(fn, ms, false), writable: true, configurable: true },
    setInterval: { value: (fn, ms) => setTimer(fn, ms, true), writable: true, configurable: true },
    clearTimeout: { value: (id) => void timers.delete(id), writable: true, configurable: true },
    clearInterval: { value: (id) => void timers.delete(id), writable: true, configurable: true },
  });

  // Messages from Quiera: the protocol's (open, close, action), and this
  // runtime's own (timer, fetch).
  return function dispatch(json) {
    const data = JSON.parse(json);
    const kind = data.type;
    switch (kind) {
      case "action": {
        const handler = actions.get(data.action);
        if (handler) call(handler, data.value);
        break;
      }
      case "open":
      case "close":
        for (const handler of lifecycle[kind]) call(handler);
        break;
      case "timer": {
        const timer = timers.get(data.id);
        if (!timer) break;
        if (timer.repeat) host.timer(data.id, timer.delay);
        else timers.delete(data.id);
        call(timer.fn);
        break;
      }
      case "fetch": {
        const pending = fetches.get(data.id);
        if (!pending) break;
        fetches.delete(data.id);
        if (data.error !== undefined) pending.reject(new Error(data.error));
        else {
          const { status, body } = data.response;
          pending.resolve(
            Object.freeze({
              status,
              ok: status >= 200 && status < 300,
              text: () => Promise.resolve(body),
              json: () => Promise.resolve(JSON.parse(body)),
            }),
          );
        }
        break;
      }
    }
  };
});
