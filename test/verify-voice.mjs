#!/usr/bin/env node
// Voice search: listen, transcribe, search; never speak. Uses a fake SpeechRecognition so no microphone, network or speech service is involved.
//   node test/verify-voice.mjs      (uses the default site/ build)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const read = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');
const src = fs.readFileSync(path.join(ROOT, 'scripts/assets/voice.js'), 'utf8');

// ---- static checks: no speech output, no network, no storage, no server involvement ----
ok(!/speechSynthesis|SpeechSynthesisUtterance|\.speak\(/.test(src), 'voice.js never speaks (no speechSynthesis / SpeechSynthesisUtterance)');
ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|MediaRecorder|getUserMedia|localStorage\.setItem|indexedDB|new Audio|AudioContext/.test(src), 'voice.js makes no network call, records no audio and stores nothing');
ok(/SpeechRecognition\s*\|\|\s*window\.webkitSpeechRecognition/.test(src) && /if \(!SR\) return/.test(src), 'uses the browser-native SpeechRecognition / webkitSpeechRecognition and does nothing where it is missing');
ok(/rec\.start\(\)/.test(src) && (src.match(/rec\.start\(\)/g) || []).length === 1 && !/DOMContentLoaded[^;]*start\(/.test(src), 'recognition starts in exactly one place: the button click handler');
for (const f of ['scripts/assets/librarian.js', 'scripts/assets/ask.js']) ok(!/SpeechRecognition|voice\.js/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), `${f}: the Digital Librarian is unchanged by voice search`);
const books = read('books/index.html'), home = read('index.html'), priv = read('about/privacy/index.html');
ok(/<script src="\.\.\/assets\/voice\.js" defer data-lang="en-US"><\/script>/.test(books), 'catalogue pages load voice.js with the configurable recognition language (en-US)');
ok(!/voice\.js/.test(home) && home.includes('data-ask-form'), 'the homepage Digital Librarian Ask box is untouched (no voice script on that page)');
ok(/Voice search \(optional\)/.test(priv) && /may be processed by the browser provider/.test(priv) && /does not record, receive or store your audio/.test(priv) && /never speaks back/.test(priv), 'privacy page discloses that the browser provider may process the audio, and that this site stores nothing');
ok(fs.existsSync(path.join(SITE, 'assets/voice.js')), 'voice.js is part of the built site');

// ---- browser behaviour with a fake recogniser ----
const FAKE = `(() => {
  window.__v = { starts: 0, aborts: 0, spoken: 0, lang: null, rec: null };
  class R { constructor() { window.__v.rec = this; } start() { window.__v.starts++; window.__v.lang = this.lang; setTimeout(() => this.onstart && this.onstart(), 0); }
    abort() { window.__v.aborts++; setTimeout(() => this.onend && this.onend(), 0); } stop() { this.abort(); } }
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
  window.__say = (t, fin) => { const r = window.__v.rec; const res = [{ transcript: t }]; res.isFinal = !!fin; r.onresult({ resultIndex: 0, results: [res] }); if (fin) setTimeout(() => r.onend && r.onend(), 0); };
  window.__err = (e) => { const r = window.__v.rec; r.onerror({ error: e }); r.onend && r.onend(); };
  window.__end = () => { const r = window.__v.rec; r.onend && r.onend(); };
  const synth = { speak() { window.__v.spoken++; }, cancel() {}, getVoices() { return []; } };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
})();`;

const browser = await launch();
if (browser) for (const [name, vp] of VIEWPORTS) {
  const url = urlOf(SITE);
  const NOSR = `Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }); Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });`;
  const mk = async (fake) => { const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); await ctx.addInitScript(fake ? FAKE : NOSR); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
    await pg.route(/fonts\.(googleapis|gstatic)/, (x) => x.abort()); await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort()); pg.errs = errs; return pg; };
  const settle = async (pg) => { await pg.waitForTimeout(200); await pg.waitForFunction(() => { const c = document.querySelector('[data-count]'); return c && c.textContent && !/Loading|so far/i.test(c.textContent); }, null, { timeout: 15000 }).catch(() => {}); };
  const titles = (pg) => pg.$$eval('.grid:not([hidden]) > .card:not([hidden]) .card-title', (e) => e.map((x) => x.textContent.trim()));
  const tip = (pg, i = 0) => pg.locator('.voice-tip').nth(i).textContent();

  // unsupported browser: no button, typed search intact
  let pg = await mk(false);
  await pg.goto(url('books/index.html')); await settle(pg);
  ok((await pg.locator('.voice-btn').count()) === 0, `[${name}] unsupported browser: no microphone button is shown`);
  await pg.fill('.filters input[name=q]', 'kundalini'); await settle(pg);
  ok((await titles(pg)).length > 0, `[${name}] unsupported browser: typed search still works`);
  await pg.context().close();

  // supported browser
  pg = await mk(true);
  await pg.goto(url('books/index.html')); await settle(pg);
  const nBtn = await pg.locator('.voice-btn').count();
  ok(nBtn === 2, `[${name}] a microphone sits inside the header search and the filter-bar search (${nBtn})`);
  ok((await pg.evaluate(() => window.__v.starts)) === 0, `[${name}] nothing listens until the visitor presses the microphone`);
  const aria = await pg.locator('.voice-btn').first().getAttribute('aria-label');
  ok(/voice/i.test(aria) && (await pg.locator('.voice-btn').first().getAttribute('aria-pressed')) === 'false', `[${name}] the button has a screen-reader label ("${aria}") and aria-pressed=false`);
  ok((await pg.evaluate(() => document.querySelectorAll('.voice-wrap input[name=q]').length)) === 2 && (await pg.locator('.filters input[name=q]').count()) === 1, `[${name}] the existing search fields are kept (same inputs, now wrapped)`);

  // filter-bar mic: listen -> transcribe -> existing search runs
  const fbtn = pg.locator('.filters .voice-btn');
  await fbtn.click(); await pg.waitForTimeout(80);
  ok((await pg.evaluate(() => window.__v.starts)) === 1 && (await fbtn.getAttribute('aria-pressed')) === 'true' && /is-listening/.test(await fbtn.getAttribute('class')), `[${name}] pressing the microphone starts listening and shows the listening state`);
  ok(/Listening/.test(await tip(pg, 1)) && /Esc/.test(await tip(pg, 1)) && /Listening/.test(await pg.locator('p.sr[role=status]').last().textContent()), `[${name}] a visible indicator and a screen-reader announcement say it is listening and how to cancel`);
  ok((await pg.evaluate(() => window.__v.lang)) === 'en-US', `[${name}] recognition language comes from the configurable setting (en-US)`);
  await pg.evaluate(() => window.__say('kundalini', false));
  ok((await pg.inputValue('.filters input[name=q]')) === 'kundalini', `[${name}] interim words appear in the search field as they are heard`);
  await pg.evaluate(() => window.__say('Kundalini awakening', true)); await pg.waitForTimeout(400); await settle(pg);
  const t1 = await titles(pg);
  ok((await pg.inputValue('.filters input[name=q]')) === 'Kundalini awakening' && t1.length > 0 && t1.some((t) => /kundalini/i.test(t)), `[${name}] "Kundalini awakening" appears in the field and the normal results show matching books (${t1.length} shown, e.g. "${t1[0]}")`);
  ok((await fbtn.getAttribute('aria-pressed')) === 'false' && (await pg.evaluate(() => window.__v.spoken)) === 0, `[${name}] listening ends after the result and the site spoke nothing`);
  ok(/q=Kundalini/i.test(await pg.evaluate(() => location.search)), `[${name}] the existing URL state (q=) is updated by the normal search`);

  // spoken lead-ins
  for (const [said, want, re] of [['Books about Lord Shiva', 'Shiva', /shiva/i], ['Books by Helena Blavatsky', 'Helena Blavatsky', /secret|isis|theosoph|voice|key|blavatsky|./i], ['Tibetan Buddhist meditation', 'Tibetan Buddhist meditation', /./], ['The Key of Solomon', 'The Key of Solomon', /solomon/i]]) {
    await fbtn.click(); await pg.waitForTimeout(60); await pg.evaluate((s) => window.__say(s, true), said); await pg.waitForTimeout(400); await settle(pg);
    const v = await pg.inputValue('.filters input[name=q]'); const tt = await titles(pg);
    ok(v === want && tt.length > 0 && tt.some((t) => re.test(t)), `[${name}] "${said}" -> field "${v}", ${tt.length} result(s) shown`);
  }

  // cancel: button and Escape
  await fbtn.click(); await pg.waitForTimeout(60);
  const a0 = await pg.evaluate(() => window.__v.aborts);
  await fbtn.click(); await pg.waitForTimeout(100);
  ok((await pg.evaluate(() => window.__v.aborts)) === a0 + 1 && (await fbtn.getAttribute('aria-pressed')) === 'false', `[${name}] pressing the microphone again cancels listening`);
  await fbtn.click(); await pg.waitForTimeout(60); await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  ok((await fbtn.getAttribute('aria-pressed')) === 'false' && (await pg.evaluate(() => window.__v.aborts)) === a0 + 2, `[${name}] Escape cancels listening`);

  // errors are reported plainly and never break typing
  for (const [code, re] of [['not-allowed', /blocked|Allow/i], ['no-speech', /didn't hear/i], ['audio-capture', /No microphone/i], ['network', /internet connection/i], ['language-not-supported', /did not work/i]]) {
    await fbtn.click(); await pg.waitForTimeout(60); await pg.evaluate((c) => window.__err(c), code); await pg.waitForTimeout(60);
    ok(re.test(await tip(pg, 1)) && (await fbtn.getAttribute('aria-pressed')) === 'false', `[${name}] "${code}" shows a clear message and resets the button`);
  }
  await fbtn.click(); await pg.waitForTimeout(60); await pg.evaluate(() => window.__end()); await pg.waitForTimeout(60);
  ok(/didn't hear/i.test(await tip(pg, 1)), `[${name}] silence (recognition ends with no speech) says nothing was heard`);
  await pg.fill('.filters input[name=q]', 'tarot'); await settle(pg);
  ok((await titles(pg)).length > 0, `[${name}] typed search still works after voice use`);

  // keyboard: the button is a real button in tab order and Enter starts listening
  const startsBefore = await pg.evaluate(() => window.__v.starts);
  await pg.locator('.filters .voice-btn').focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(80);
  ok((await pg.evaluate(() => window.__v.starts)) === startsBefore + 1 && (await pg.locator('.filters .voice-btn').evaluate((b) => b.tagName === 'BUTTON' && b.tabIndex >= 0)), `[${name}] keyboard: the microphone is a focusable button and Enter starts listening`);
  await pg.keyboard.press('Escape');

  // header search: spoken query submits the normal search page
  await pg.goto(url('books/index.html')); await settle(pg);
  const nbtn = pg.locator('.nav-search .voice-btn');
  if (await nbtn.isVisible()) {
    await nbtn.click(); await pg.waitForTimeout(60); await pg.evaluate(() => window.__say('The Key of Solomon', true));
    await pg.waitForURL(/search\/index\.html\?q=/, { timeout: 8000 }).catch(() => {}); await settle(pg);
    const tt = await titles(pg);
    ok(/search\/index\.html\?q=The(\+|%20)Key(\+|%20)of(\+|%20)Solomon/i.test(pg.url()) && tt.some((t) => /key of solomon/i.test(t)), `[${name}] header search: the spoken query opens the normal search page with matching books ("${tt[0]}")`);
  } else ok(false, `[${name}] header search microphone is visible`);

  // layout + errors
  await pg.goto(url('books/index.html')); await settle(pg);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `[${name}] no horizontal page scroll with the microphone present`);
  const box = await pg.locator('.filters .voice-btn').boundingBox(); const ib = await pg.locator('.filters input[name=q]').boundingBox();
  ok(box && ib && box.x >= ib.x && box.x + box.width <= ib.x + ib.width + 1 && box.width >= 32, `[${name}] the microphone sits inside the search field and is a usable tap target (${Math.round(box?.width)}px)`);
  ok(pg.errs.length === 0, `[${name}] no JavaScript errors`);
  await pg.context().close();

  // Digital Librarian homepage has no microphone
  pg = await mk(true); await pg.goto(url('index.html')); await pg.waitForTimeout(500);
  ok((await pg.locator('.voice-btn').count()) === 0 && (await pg.evaluate(() => window.__v.starts)) === 0, `[${name}] the homepage Digital Librarian Ask box has no microphone and starts nothing`);
  await pg.context().close();
}
if (browser) await browser.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} voice-search checks passed`);
process.exit(state.fails ? 1 : 0);
