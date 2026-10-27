// Shared harvest plumbing: rate limiting, retry/backoff, disk cache, checkpoints, ISBN helpers.
// Zero dependencies. `fetchImpl` is injectable so tests can run against a local mock server.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isbn13Valid(s) {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += +s[i] * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === +s[12];
}
export function isbn10to13(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return null;
  const core = '978' + s.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += +core[i] * (i % 2 ? 3 : 1);
  return core + ((10 - (sum % 10)) % 10);
}
export const toIsbn13 = (raw) => {
  const s = String(raw ?? '').replace(/[^0-9Xx]/g, '').toUpperCase();
  if (s.length === 13) return isbn13Valid(s) ? s : null;
  if (s.length === 10) { const t = isbn10to13(s); return t && isbn13Valid(t) ? t : null; }
  return null;
};

// Rate-limited, cached, retrying JSON client. Honours Retry-After; opens a circuit after repeated failures.
export function createClient({ rps = 1, cacheDir = null, userAgent = 'ForbiddenMantraPress-catalogue/1.0', fetchImpl = globalThis.fetch, maxRetries = 4, breakAfter = 5, headers = {} } = {}) {
  let last = 0, consecutiveFailures = 0;
  const stats = { requests: 0, cacheHits: 0, retries: 0, failures: 0 };
  const cachePath = (url) => cacheDir && path.join(cacheDir, crypto.createHash('sha1').update(url).digest('hex') + '.json');
  async function getJson(url) {
    const cp = cachePath(url);
    if (cp && fs.existsSync(cp)) { stats.cacheHits++; return JSON.parse(fs.readFileSync(cp, 'utf8')); }
    if (consecutiveFailures >= breakAfter) throw new Error(`circuit open after ${breakAfter} consecutive failures; stop and check the source (quota? block?)`);
    for (let attempt = 0; ; attempt++) {
      const wait = Math.max(0, last + 1000 / rps - Date.now());
      if (wait) await sleep(wait);
      last = Date.now();
      stats.requests++;
      let res;
      try { res = await fetchImpl(url, { headers: { 'user-agent': userAgent, accept: 'application/json', ...headers } }); }
      catch (err) { res = { ok: false, status: 0, headers: new Map(), networkError: err }; }
      if (res.ok) {
        consecutiveFailures = 0;
        const data = await res.json();
        if (cp) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cp, JSON.stringify(data)); }
        return data;
      }
      const retryable = res.status === 0 || res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) { stats.failures++; consecutiveFailures++; throw new Error(`HTTP ${res.status} for ${url}`); }
      stats.retries++;
      const ra = Number(res.headers?.get?.('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(30000, 500 * 2 ** attempt));
    }
  }
  return { getJson, stats };
}

// Checkpoint: a JSON file of completed unit keys, written atomically after every unit so an interrupted run resumes.
export function checkpoint(file) {
  let state = { done: {}, updated: null };
  if (fs.existsSync(file)) state = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    has: (k) => k in state.done,
    mark(k, info = true) {
      state.done[k] = info; state.updated = new Date().toISOString();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify(state)); fs.renameSync(file + '.tmp', file);
    },
    count: () => Object.keys(state.done).length,
  };
}

export function appendJsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}
export function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
