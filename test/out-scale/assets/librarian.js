/* Digital librarian: a small animated guide beside the bookstore search.
   - Searches the SAME chunk index as the search page (assets/idx), so every title and author she shows is real.
   - Phase 1 only: no microphone, no AI, no network calls beyond the site's own static files.
   - Extension points (see docs/LIBRARIAN.md): FMLibrarian.submitQuery(text, {source}), FMLibrarian.setAnswerProvider(fn), event 'fm:librarian'. */
(function () {
  'use strict';
  var host = document.getElementById('fm-librarian');
  if (!host) return;
  var cfg = {}; try { cfg = JSON.parse(host.getAttribute('data-config') || '{}'); } catch (e) {}
  var root = host.getAttribute('data-root') || './';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'fm-librarian';
  var store = { get: function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } }, set: function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} } };
  var doc = document;
  function h(tag, attrs, kids) {
    var e = doc.createElement(tag); for (var k in (attrs || {})) if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); }); return e;
  }
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); };
  var slugify = function (x) { return norm(x).replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };

  // ---------- markup ----------
  var art = cfg.art && cfg.art.src ? cfg.art : null;
  var lotus = '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7E3A6"/><stop offset="1" stop-color="#D8B46B"/></linearGradient><radialGradient id="lg2"><stop offset="0" stop-color="#9FE3DA" stop-opacity=".9"/><stop offset="1" stop-color="#79B9B1" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="62" r="52" fill="url(#lg2)"/><g fill="url(#lg1)" stroke="#183F3B" stroke-width="1.5" stroke-linejoin="round"><path d="M60 24C70 40 70 58 60 78 50 58 50 40 60 24Z"/><path d="M60 78C48 70 34 56 32 38 46 42 58 56 60 78Z"/><path d="M60 78C72 70 86 56 88 38 74 42 62 56 60 78Z"/><path d="M60 80C44 78 28 68 20 54 36 54 52 64 60 80Z" opacity=".9"/><path d="M60 80C76 78 92 68 100 54 84 54 68 64 60 80Z" opacity=".9"/></g></svg>';
  var avatar = h('div', { 'class': 'lib-avatar', 'aria-hidden': 'true' }, [
    h('div', { 'class': 'lib-aura' }),
    h('div', { 'class': 'lib-figure' }, art
      ? [h('img', { 'class': 'lib-img', src: art.src, width: art.width, height: art.height, alt: '', decoding: 'async', loading: 'lazy' }),
         h('div', { 'class': 'lib-headlayer', style: art.head ? 'clip-path:inset(0 0 ' + (100 - art.head.clipBottom) + '% 0);transform-origin:50% ' + art.head.pivotY + '%' : '' },
           [h('img', { src: art.src, width: art.width, height: art.height, alt: '', decoding: 'async', loading: 'lazy' })].concat((art.eyes || []).map(function (e) { return h('span', { 'class': 'lib-lid', style: 'left:' + e.x + '%;top:' + e.y + '%;width:' + e.w + '%;height:' + e.h + '%' }); }))),
         art.emblem ? h('span', { 'class': 'lib-emblem', style: 'left:' + art.emblem.x + '%;top:' + art.emblem.y + '%' }) : null]
      : [h('span', { 'class': 'lib-placeholder' })]),
    h('span', { 'class': 'lib-spark', style: art && art.hand ? 'left:' + art.hand.x + '%;top:' + art.hand.y + '%' : '' })
  ]);
  if (!art) avatar.querySelector('.lib-placeholder').innerHTML = lotus;
  else avatar.querySelector('.lib-figure').appendChild(avatar.querySelector('.lib-spark'));

  var status = h('p', { 'class': 'lib-status', role: 'status', 'aria-live': 'polite' }, ['']);
  var list = h('ul', { 'class': 'lib-list' });
  var authors = h('p', { 'class': 'lib-authors' });
  var more = h('a', { 'class': 'lib-more', href: root + 'search/index.html', hidden: 'hidden' }, ['See every result']);
  var display = h('div', { 'class': 'lib-display', id: 'lib-display' }, [h('div', { 'class': 'lib-scan', 'aria-hidden': 'true' }), status, list, authors, more]);
  var minBtn = h('button', { type: 'button', 'class': 'lib-btn', 'aria-controls': 'lib-body', 'aria-expanded': 'true' }, ['Minimize']);
  minBtn.setAttribute('aria-label', 'Minimize the digital librarian');
  var head = h('div', { 'class': 'lib-head' }, [h('span', { 'class': 'lib-title', lang: 'en' }, ['Digital librarian']), minBtn]);
  var body = h('div', { 'class': 'lib-body', id: 'lib-body' }, [avatar, display]);
  var panel = h('section', { 'class': 'lib-panel', role: 'complementary', 'aria-label': 'Digital librarian', lang: 'en' }, [head, body]);
  var chip = h('button', { type: 'button', 'class': 'lib-chip', 'aria-label': 'Open the digital librarian', 'aria-expanded': 'false', 'aria-controls': 'lib-body' }, [h('span', { 'class': 'lib-chip-i' }), h('span', { 'class': 'lib-chip-t' }, ['Librarian'])]);
  chip.firstChild.innerHTML = lotus.replace(/lg1/g, 'lc1').replace(/lg2/g, 'lc2');
  host.appendChild(panel); host.appendChild(chip); host.hidden = false;
  host.className = 'lib';

  // ---------- visibility: open / minimized / off (remembered per browser) ----------
  var mode = store.get() || ((cfg.startMinimizedBelowPx && window.innerWidth < cfg.startMinimizedBelowPx) ? 'min' : 'open');
  function setMode(m, focus) {
    mode = m; if (m !== 'off' || true) store.set(m);
    host.setAttribute('data-mode', m);
    panel.hidden = m !== 'open'; chip.hidden = m !== 'min';
    minBtn.setAttribute('aria-expanded', String(m === 'open')); chip.setAttribute('aria-expanded', String(m === 'open'));
    host.hidden = m === 'off';
    if (m === 'open') setState('idle'); 
    if (focus) (m === 'open' ? minBtn : m === 'min' ? chip : null) && (m === 'open' ? minBtn : chip).focus();
    var t = doc.querySelectorAll('[data-librarian-toggle]'); for (var i = 0; i < t.length; i++) t[i].textContent = m === 'off' ? 'Show digital librarian' : 'Hide digital librarian';
  }
  minBtn.addEventListener('click', function () { setMode('min', true); });
  chip.addEventListener('click', function () { setMode('open', true); });
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMode('min', true); } });
  doc.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-librarian-toggle]'); if (t) { e.preventDefault(); setMode(mode === 'off' ? 'open' : 'off'); } });

  // ---------- animation states (CSS does the motion; reduced motion removes it and keeps the states) ----------
  var state = 'idle', idleTimer = null;
  function setState(s) {
    state = s; host.setAttribute('data-state', s); clearTimeout(idleTimer);
    if (s === 'present' || s === 'greet') idleTimer = setTimeout(function () { setState('idle'); }, s === 'greet' ? 3200 : 9000);
  }
  var blink = null;
  function scheduleBlink() {
    if (reduce) return; clearTimeout(blink);
    blink = setTimeout(function () { avatar.classList.add('blink'); setTimeout(function () { avatar.classList.remove('blink'); scheduleBlink(); }, 160); }, 2400 + Math.random() * 3200);
  }
  scheduleBlink();
  doc.addEventListener('visibilitychange', function () { if (doc.hidden) clearTimeout(blink); else scheduleBlink(); });

  // ---------- catalogue access: the page's own chunk index ----------
  var M = null, recs = [], loaded = 0, total = 0, loading = null;
  function script(src) { return new Promise(function (ok, bad) { var s = doc.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error(src)); }; doc.head.appendChild(s); }); }
  function decode(r) {
    var o = { slug: r[0], title: r[1], sub: r[2], authors: r[3].split(';'), ap: r[4], dep: r[5], press: !!r[8], dyn: !!r[11] };
    o.t = norm(o.title);
    o.s = norm([o.title, o.sub, o.authors.join(' '), o.dep.map(function (x) { return M.deptNames[x]; }).join(' '), o.press ? 'forbidden mantra press' : '', r[10]].join(' '));
    return o;
  }
  function ensure() {
    if (loading) return loading;
    loading = (window.FM_MANIFEST ? Promise.resolve(window.FM_MANIFEST) : script(root + 'assets/idx/manifest.js').then(function () { return window.FM_MANIFEST; })).then(function (m) {
      M = m; total = m.chunks.length; window.FM_IDX = window.FM_IDX || {};
      var next = 0, worker = function () {
        if (next >= m.chunks.length) return Promise.resolve();
        var c = m.chunks[next++];
        return (window.FM_IDX[c] ? Promise.resolve() : script(root + 'assets/idx/' + c + '.js')).then(function () {
          window.FM_IDX[c].forEach(function (r) { recs.push(decode(r)); }); loaded++; if (pending) run(pending, false);
        }).then(worker);
      };
      return Promise.all([worker(), worker(), worker()]);
    }).catch(function () { loading = null; say('The catalogue index could not be loaded.'); });
    return loading;
  }
  function osa(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1; var d = [], i, j, c;
    for (i = 0; i <= a.length; i++) d[i] = [i]; for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) { c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); }
    return d[a.length][b.length];
  }
  function search(q) {
    var terms = norm(q).trim().split(/\s+/).filter(Boolean), out = [];
    if (!terms.length) return { books: [], n: 0, fuzzy: false };
    function pass(fuzzy) {
      recs.forEach(function (o) {
        var ok = terms.every(function (x) {
          if (o.s.indexOf(x) > -1) return true;
          if (!fuzzy || /\d/.test(x) || x.length < 4) return false; var m = x.length < 7 ? 1 : 2;
          return o.s.split(/[^a-z0-9]+/).some(function (w) { return osa(x, w, m) <= m; });
        });
        if (ok) { o.sc = fuzzy ? 1 : terms.every(function (x) { return o.t.indexOf(x) > -1; }) ? 3 : 2; out.push(o); }
      });
    }
    pass(false); var fuzzy = false; if (!out.length && loaded === total) { pass(true); fuzzy = out.length > 0; }
    out.sort(function (a, b) { return (b.sc - a.sc) || ((b.press ? 1 : 0) - (a.press ? 1 : 0)); });
    return { books: out, n: out.length, fuzzy: fuzzy, terms: terms };
  }

  // ---------- presenting results ----------
  function say(t) { status.textContent = t; }
  var pending = null, extProvider = null, seq = 0;
  function bookHref(o) { return o.dyn ? root + 'book/index.html?s=' + encodeURIComponent(o.slug) : root + 'books/' + o.slug + '/index.html'; }
  function authorHref(o, i) { return o.ap.charAt(i) === '1' || (M && M.authorPages === 'all') ? root + 'authors/' + slugify(o.authors[i]) + '/index.html' : root + 'search/index.html?q=' + encodeURIComponent(o.authors[i]); }
  function render(q, res, final) {
    list.textContent = ''; authors.textContent = '';
    res.books.slice(0, 4).forEach(function (o) {
      list.appendChild(h('li', {}, [h('a', { href: bookHref(o) }, [o.title]), h('span', { 'class': 'lib-by' }, [' ' + o.authors.join(', ')]), o.press ? h('span', { 'class': 'lib-fmp' }, ['Our book']) : null]));
    });
    var seen = {}, names = [], ql = norm(q);
    res.books.slice(0, 12).forEach(function (o) { o.authors.forEach(function (a, i) { if (!seen[a]) { seen[a] = 1; names.push({ a: a, o: o, i: i, hit: norm(a).indexOf(ql) > -1 }); } }); });
    names.sort(function (x, y) { return (y.hit ? 1 : 0) - (x.hit ? 1 : 0); });
    if (names.length) {
      authors.appendChild(doc.createTextNode('Authors: '));
      names.slice(0, 3).forEach(function (n, k) { if (k) authors.appendChild(doc.createTextNode(', ')); authors.appendChild(h('a', { href: authorHref(n.o, n.i) }, [n.a])); });
    }
    more.hidden = !res.n; more.href = root + 'search/index.html?q=' + encodeURIComponent(q);
    more.textContent = 'See all ' + res.n + (res.n === 1 ? ' result' : ' results');
    if (final) say(res.n ? (res.fuzzy ? 'Close matches for “' + q + '”: ' : 'Here is what I found for “' + q + '”: ') + res.n + (res.n === 1 ? ' book.' : ' books.') : 'I could not find “' + q + '” yet. Try an author, subject or ISBN.');
    else say('Searching… ' + res.n + ' so far (' + loaded + ' of ' + total + ' index files).');
  }
  function run(q, final) {
    var my = ++seq, res = search(q), done = loaded === total && total > 0;
    render(q, res, done);
    if (done) { pending = null; setState('present'); }
    if (extProvider && done) { Promise.resolve(extProvider(q, res.books.slice(0, 8))).then(function (a) { if (my === seq && a && a.text) say(a.text); }).catch(function () {}); }
    announce(q, res, done);
  }
  function announce(q, res, done) { try { doc.dispatchEvent(new CustomEvent('fm:librarian', { detail: { query: q, total: res.n, done: done, slugs: res.books.slice(0, 4).map(function (o) { return o.slug; }) } })); } catch (e) {} }
  var debounce = null;
  function submitQuery(text, opts) {
    var q = String(text || '').trim(); clearTimeout(debounce);
    if (!q) { pending = null; list.textContent = ''; authors.textContent = ''; more.hidden = true; say('Ask me for a title, author, subject or ISBN.'); setState('idle'); return; }
    if (mode !== 'open') { return; }
    setState('think'); say('Searching the catalogue…'); pending = q;
    ensure().then(function () { if (pending === q) run(q, true); });
  }
  function onInput(e) {
    var t = e.target; if (!t || t.tagName !== 'INPUT' || t.name !== 'q' || t.closest('.lib')) return;
    if (mode === 'open' && t.value.trim()) setState('think');
    clearTimeout(debounce); debounce = setTimeout(function () { submitQuery(t.value, { source: 'text' }); }, 350);
  }
  doc.addEventListener('input', onInput);
  doc.addEventListener('focusin', function (e) { if (e.target && e.target.name === 'q' && mode === 'open') { setState('listen'); ensure(); } });
  doc.addEventListener('focusout', function (e) { if (e.target && e.target.name === 'q' && state === 'listen') setState('idle'); });

  // a search page opened with ?q= : search at once
  var urlQ = (new URLSearchParams(location.search)).get('q');
  if (urlQ && mode === 'open') submitQuery(urlQ, { source: 'url' });
  else { say('Hello. Ask me for a title, author, subject or ISBN.'); if (mode === 'open') { setState('greet'); } }
  setMode(mode);
  if (!urlQ && mode === 'open') setState('greet');

  // ---------- public extension points ----------
  window.FMLibrarian = {
    version: 1,
    submitQuery: submitQuery,
    /* Phase 3: fn(query, topBooks) -> { text } | Promise. Never called unless a provider is registered; the site registers none. */
    setAnswerProvider: function (fn) { extProvider = typeof fn === 'function' ? fn : null; },
    /* Phase 2: voice search. A future module reads cfg.voice.enabled, requests the microphone only on a user click, and calls submitQuery(text, {source:'voice'}). */
    voice: { enabled: !!(cfg.voice && cfg.voice.enabled) },
    setMode: setMode, getState: function () { return state; }
  };
})();
