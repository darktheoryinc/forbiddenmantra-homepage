import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
export const state = { fails: 0, passes: 0 };
export const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? state.passes++ : state.fails++; };
export function checkLinks(SITE) {
  const pages = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') && pages.push(path.join(d, e.name)); })(SITE);
  let internal = 0; const broken = []; const buy = new Map();
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf8');
    const buyLinks = new Set([...html.matchAll(/<ul class="buy"[^>]*>([\s\S]*?)<\/ul>/g)].flatMap((b) => [...b[1].matchAll(/href="([^"]+)"/g)].map((x) => x[1].replace(/&amp;/g, '&'))));
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:)?\/\//.test(u)) { const uu = u.replace(/&amp;/g, '&'); if (buyLinks.has(uu)) { const s = buy.get(uu) ?? new Set(); s.add(path.relative(SITE, p)); buy.set(uu, s); } continue; }
      if (u.startsWith('mailto:') || u.startsWith('data:') || u.startsWith('?')) continue;
      const [file, hash] = u.split('#'); internal++;
      const target = file ? path.resolve(path.dirname(p), file.split('?')[0]) : p;
      if (!fs.existsSync(target)) { broken.push(`${path.relative(SITE, p)} -> ${u}`); continue; }
      if (hash && target.endsWith('.html') && !/[?&]s=/.test(file + (u.includes('?') ? u.slice(u.indexOf('?')) : '')) && !fs.readFileSync(target, 'utf8').includes(`id="${hash}"`)) broken.push(`${path.relative(SITE, p)} -> ${u} (missing anchor)`);
    }
  }
  return { pages: pages.length, internal, broken, buy };
}
export async function launch() {
  let chromium; try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch { console.log('SKIP browser tests (playwright not installed)'); return null; }
  return chromium.launch();
}
export const urlOf = (SITE) => (p) => pathToFileURL(path.join(SITE, p)).href;
export const VIEWPORTS = [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]];
