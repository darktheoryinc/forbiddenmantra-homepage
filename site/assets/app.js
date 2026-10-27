(function () {
  var doc = document.documentElement;
  var I = window.FM_I18N || { dict: { en: {} }, langs: {}, ui: ['en'] };
  var ui = 'en';
  try { ui = new URLSearchParams(location.search).get('ui') || localStorage.getItem('fm-ui') || 'en'; } catch (e) {}
  if (!I.dict[ui]) ui = 'en';

  function tr(k, v) {
    var s = (I.dict[ui] && I.dict[ui][k]) || (I.dict.en && I.dict.en[k]) || k;
    return v ? s.replace(/\{(\w+)\}/g, function (_, x) { return v[x]; }) : s;
  }
  function langName(c) { var l = I.langs[c]; return l ? (ui === 'en' ? l.name : l.endonym) : c; }
  var norm = function (s) { return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); };

  // ---------- website (interface) language ----------
  var chrome = document.querySelectorAll('.site-header, .site-footer, .filters, .crumbs');
  var applyFilters = function () {};
  function applyUI() {
    var rtl = I.langs[ui] && I.langs[ui].dir === 'rtl';
    doc.lang = ui;
    chrome.forEach(function (el) { if (rtl) el.setAttribute('dir', 'rtl'); else el.removeAttribute('dir'); });
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (el.hasAttribute('data-empty-text')) return;
      el.textContent = tr(el.getAttribute('data-i18n'));
      if (ui === 'en') { el.removeAttribute('lang'); if (!el.closest('.chrome-keep')) el.removeAttribute('dir'); }
      else { el.setAttribute('lang', ui); el.setAttribute('dir', rtl ? 'rtl' : 'ltr'); }
    });
    ['placeholder', 'label', 'aria-label'].forEach(function (a) {
      document.querySelectorAll('[data-i18n-' + a + ']').forEach(function (el) { el.setAttribute(a, tr(el.getAttribute('data-i18n-' + a))); });
    });
    document.querySelectorAll('[data-count-ed]').forEach(function (el) { var n = +el.getAttribute('data-count-ed'); el.textContent = tr(n === 1 ? 'lang_ed_one' : 'lang_ed_many', { n: n }); });
    document.querySelectorAll('[data-ui]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ui') === ui); });
    var cur = document.querySelector('[data-ui-code]'); if (cur) cur.textContent = ui.toUpperCase();
    langStatus(); langBand();
    applyFilters();
  }
  function setUI(c) { if (!I.dict[c]) return; ui = c; try { localStorage.setItem('fm-ui', c); } catch (e) {} applyUI(); }


  // ---------- what the chosen language means for books (verified editions only) ----------
  function langStatus() {
    var el = document.querySelector('[data-lp-status]'); if (!el) return;
    el.textContent = '';
    var a = document.querySelector('.lp-books:not(.dim) a[lang="' + ui + '"]');
    if (a) {
      var n = a.parentNode.querySelector('[data-count-ed]');
      el.appendChild(document.createTextNode(tr('lang_status_have', { lang: langName(ui), n: n ? n.getAttribute('data-count-ed') : '' }) + ' · '));
      var l = document.createElement('a'); l.href = a.getAttribute('href'); l.textContent = tr('lang_home_all', { lang: langName(ui), n: '' }).replace(/\s*\(\s*\)/, ''); el.appendChild(l);
    } else el.textContent = tr('lang_status_none', { lang: langName(ui) });
  }
  // Homepage only: a band of featured books that HAVE a verified edition in the chosen language. Data comes from the build (catalogue editions), never guessed.
  function langBand() {
    var box = document.querySelector('[data-langbooks]'); if (!box) return;
    var wrap = box.querySelector('.wrap'), D = window.FM_LANGBOOKS || {}, L = D[ui];
    wrap.textContent = '';
    if (ui === 'en') { box.hidden = true; return; }
    box.hidden = false;
    var name = langName(ui);
    var head = h('div', { 'class': 'split' }, [h('h2', {}, [tr('lang_home_h', { lang: name })])]);
    if (!L) { wrap.appendChild(head); wrap.appendChild(h('p', { 'class': 'lede-sm' }, [tr('lang_home_none', { lang: name })])); wrap.appendChild(h('p', {}, [h('a', { href: './languages/index.html' }, [tr('lang_all_link')])])); return; }
    head.appendChild(h('a', { href: './' + L.href }, [tr('lang_home_all', { lang: name, n: L.works })]));
    wrap.appendChild(head); wrap.appendChild(h('p', { 'class': 'lede-sm' }, [tr('lang_home_note', { lang: name })]));
    var grid = h('div', { 'class': 'grid' }, L.books.map(function (b) {
      return h('article', { 'class': 'card' }, [
        h('a', { 'class': 'card-cover', href: './' + b.h, tabindex: '-1', 'aria-hidden': 'true' }, [coverEl(b.t, b.a.split(', ')[0], !!b.p)]),
        h('div', { 'class': 'card-body' }, [b.p ? h('span', { 'class': 'badge badge-fmp' }, ['Forbidden Mantra Press']) : null,
          h('h3', { 'class': 'card-title' }, [h('a', { href: './' + b.h, lang: ui }, [b.t])]), h('p', { 'class': 'card-author' }, [b.a]), h('p', { 'class': 'card-meta' }, [name])])]);
    }));
    wrap.appendChild(grid);
  }
  // ---------- language menu ----------
  var menu = document.querySelector('[data-langmenu]');
  if (menu) {
    var btn = menu.querySelector('.lang-btn'), panel = menu.querySelector('.lang-panel');
    var close = function (focus) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); };
    var open = function () { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
    btn.addEventListener('click', function () { panel.hidden ? open() : close(); });
    document.addEventListener('click', function (e) { if (!panel.hidden && !menu.contains(e.target)) close(); });
    menu.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); close(true); } });
    panel.addEventListener('focusout', function (e) { if (!panel.hidden && e.relatedTarget && !menu.contains(e.relatedTarget)) close(); });
    menu.querySelectorAll('[data-ui]').forEach(function (b) { b.addEventListener('click', function () { setUI(b.getAttribute('data-ui')); close(true); }); });
  }

  // ---------- outbound click events ----------
  // Always dispatches a DOM event; forwards to an analytics provider only if one is loaded (none is configured by default).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-track]'); if (!a) return;
    var d = {}; for (var k in a.dataset) d[k] = a.dataset[k]; d.href = a.href; d.page = location.pathname;
    document.dispatchEvent(new CustomEvent('fm:outbound', { detail: d }));
    if (navigator.doNotTrack === '1') return;
    try {
      if (window.plausible) window.plausible('Outbound', { props: d });
      else if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'outbound/' + d.track + '/' + (d.isbn || d.slug || d.promo || ''), title: a.textContent.trim().slice(0, 80), event: true });
    } catch (err) {}
  });

  // ---------- mobile nav ----------
  var t = document.querySelector('.nav-toggle'), n = document.getElementById('nav');
  if (t && n) t.addEventListener('click', function () { var o = n.classList.toggle('open'); t.setAttribute('aria-expanded', o); if (o && menu) { menu.querySelector('.lang-panel').hidden = true; menu.querySelector('.lang-btn').setAttribute('aria-expanded', 'false'); } });

  // ---------- typo-tolerant matching ----------
  // Optimal-string-alignment distance (insert, delete, substitute, adjacent swap).
  function osa(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [], i, j, c;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  var maxEdits = function (t) { return /\d/.test(t) || t.length < 4 ? 0 : t.length < 7 ? 1 : 2; };

  // ---------- catalogue filters (book language is edition-level) ----------
  var bar = document.querySelector('[data-filterbar]'), grid = document.querySelector('[data-filterable]');
  if (bar && grid) {
    var cards = [].slice.call(grid.querySelectorAll('.card')), empty = document.querySelector('[data-empty]'), emptyText = document.querySelector('[data-empty-text]'), count = bar.querySelector('[data-count]');
    var f = bar.elements;
    cards.forEach(function (c, i) { c._i = i; c._w = c.dataset.search.split(/[^a-z0-9]+/).filter(Boolean); c._ed = JSON.parse(c.dataset.ed || '[]'); var a = c.querySelectorAll('a[href]'); c._links = [].slice.call(a).map(function (x) { return [x, x.getAttribute('href')]; }); });
    var selected = function (name) { return f[name] ? f[name].value : ''; };
    var has = function (arr, v) { return arr.indexOf(v) > -1; };
    var vocab = null;
    var exact = function (c, x) { return c.dataset.search.indexOf(x) > -1 || c.dataset.search.indexOf(x.replace(/-/g, '')) > -1; };
    var close = function (c, x) { var m = maxEdits(x); if (!m) return false; return c._w.some(function (w) { return osa(x, w.slice(0, x.length + 1), m) <= m || osa(x, w, m) <= m; }); };
    var suggest = function (terms) {
      if (!vocab) { vocab = {}; cards.forEach(function (c) { c._w.forEach(function (w) { if (w.length > 2) vocab[w] = 1; }); }); vocab = Object.keys(vocab); }
      var changed = false, out = terms.map(function (t) {
        var m = maxEdits(t); if (!m) return t;
        var best = t, bd = m + 1;
        vocab.forEach(function (w) { var d = osa(t, w, m); if (d < bd || (d === bd && d <= m && w[0] === t[0] && best[0] !== t[0])) { bd = d; best = w; } });
        if (bd <= m && best !== t) changed = true; return bd <= m ? best : t;
      });
      return changed ? out.join(' ') : '';
    };

    applyFilters = function () {
      var q = f.q ? norm(f.q.value).trim() : '', terms = q.split(/\s+/).filter(Boolean);
      var L = selected('lang'), F = selected('format'), shown = 0, fuzzy = false, usedFuzzy = false;
      // exact first; close matches only when nothing matches exactly
      if (terms.length && !cards.some(function (c) { return terms.every(function (x) { return exact(c, x); }); })) fuzzy = true;
      cards.forEach(function (c) {
        var ok = true; c._s = 0;
        if (terms.length) {
          ok = terms.every(function (x) { return exact(c, x) || (fuzzy && close(c, x)); });
          if (ok) { c._s = fuzzy ? 1 : terms.every(function (x) { return c.dataset.title.indexOf(x) > -1; }) ? 3 : 2; }
        }
        if (ok && selected('subject')) ok = has(c.dataset.subjects.split(' '), selected('subject'));
        if (ok && selected('tradition')) ok = has(c.dataset.tradition.split(' '), selected('tradition'));
        if (ok && selected('level')) ok = c.dataset.level === selected('level');
        if (ok && selected('press')) ok = c.dataset.press === selected('press');
        var ctx = c.dataset.ctx || '';
        var eff = L || ctx;
        // a card matches only if ONE edition satisfies language AND format together
        var me = c._ed.filter(function (e) { return (!eff || has(e.l, eff)) && (!F || e.f === F); });
        if (ok && (eff || F)) ok = me.length > 0;
        c.hidden = !ok;
        if (ok) {
          shown++; if (fuzzy) usedFuzzy = true;
          var eds = (eff || F) ? me : c._ed;
          var fm = [], lg = [];
          eds.forEach(function (e) { if (!has(fm, e.f)) fm.push(e.f); e.l.forEach(function (x) { if (!has(lg, x)) lg.push(x); }); });
          if (eff) lg = [eff];
          var meta = c.querySelector('.card-meta');
          if (meta) meta.textContent = fm.map(function (x) { return tr('fmt_' + x); }).join(' · ') + ' · ' + lg.map(langName).join(', ') + ' · ' + tr('lvl_' + c.dataset.level).split(' / ')[0];
          var tl = c.querySelector('.card-title a'), alt = eff ? (eds.filter(function (e) { return e.t; })[0] || {}).t : '';
          if (tl) { tl.textContent = alt || c.dataset.wtitle; if (alt) tl.setAttribute('lang', eff); else tl.removeAttribute('lang'); }
          c._links.forEach(function (p) { if (p[0].href.indexOf('/books/') > -1) p[0].setAttribute('href', eff ? p[1].split('#')[0] + '#lang-' + eff : p[1].split('#')[0]); });
        }
      });
      // rank: exact title matches, then other exact matches, then close matches; original order when not searching
      cards.slice().sort(function (a, b) { return terms.length ? (b._s - a._s) || (a._i - b._i) : a._i - b._i; }).forEach(function (c) { grid.appendChild(c); });
      if (empty) {
        empty.hidden = shown > 0;
        var sg = shown === 0 && terms.length ? suggest(terms) : '';
        if (shown === 0 && emptyText) emptyText.textContent = L ? tr('empty_lang', { lang: langName(L) }) : tr('empty_filters');
        var box = empty.querySelector('[data-suggest]');
        if (box) {
          box.textContent = '';
          if (sg) { var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn-link'; bt.textContent = sg; bt.addEventListener('click', function () { f.q.value = sg; sync(); }); var pre = tr('did_you_mean', { q: '\u0000' }).split('\u0000'); box.appendChild(document.createTextNode(' ' + pre[0])); box.appendChild(bt); box.appendChild(document.createTextNode(pre[1] || '')); }
        }
      }
      if (count) count.textContent = tr(shown === 1 ? 'count_one' : 'count_many', { n: shown }) + (usedFuzzy && shown ? ' · ' + tr('close_matches', { q: f.q.value.trim() }) : '');
    };
    var sync = function () {
      applyFilters();
      if (history.replaceState) { var u = new URL(location.href); ['q', 'subject', 'tradition', 'lang', 'format', 'level', 'press'].forEach(function (k) { if (f[k] && f[k].value) u.searchParams.set(k, f[k].value); else u.searchParams.delete(k); }); history.replaceState(null, '', u); }
    };
    bar.addEventListener('input', sync); bar.addEventListener('change', sync);
    bar.addEventListener('reset', function () { setTimeout(sync, 0); });
    var p = new URLSearchParams(location.search);
    if (f.q && p.get('q')) f.q.value = p.get('q');
    ['subject', 'tradition', 'lang', 'format', 'level', 'press'].forEach(function (k) { if (f[k] && p.get(k)) f[k].value = p.get(k); });
  }
  // ---------- shared helpers for the chunk index (paged listings, search page, dynamic book view) ----------
  function loadScript(src) { return new Promise(function (ok, bad) { var el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = function () { bad(new Error('load ' + src)); }; document.head.appendChild(el); }); }
  function h(tag, attrs, kids) { var e = document.createElement(tag); for (var k in (attrs || {})) if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]); (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
  function slugify(x) { return x.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function hue(x) { var v = 0; for (var i = 0; i < x.length; i++) v = (v * 31 + x.charCodeAt(i)) >>> 0; return v % 360; }
  function coverEl(title, author, press, big) {
    return h('div', { 'class': 'cover' + (big ? ' cover-lg' : '') + (press ? ' cover-fmp' : ''), style: '--h:' + (press ? 38 : hue(title)), role: 'img', 'aria-label': 'Placeholder cover for ' + title + '. Official cover art is shown only where a permitted source is connected.' }, [h('span', { 'class': 'cover-title' }, [title]), h('span', { 'class': 'cover-author' }, [author])]);
  }
  var MANIFEST = null;
  function loadManifest(root) { return MANIFEST ? Promise.resolve(MANIFEST) : loadScript(root + 'assets/idx/manifest.js').then(function () { window.FM_IDX = window.FM_IDX || {}; return (MANIFEST = window.FM_MANIFEST); }); }
  function loadChunk(root, c) { return window.FM_IDX && window.FM_IDX[c] ? Promise.resolve() : loadScript(root + 'assets/idx/' + c + '.js'); }
  function authorLink(M, root, o, i) {
    var n = o.authors[i], page = M.authorPages === 'all' || o.ap.charAt(i) === '1';
    return h('a', { href: page ? root + 'authors/' + slugify(n) + '/index.html' : root + 'search/index.html?q=' + encodeURIComponent(n) }, [n]);
  }

  // ---------- chunk index mode: paged listings and the search page ----------
  // The page carries one static page of cards (for crawlers and no-JS). When a filter or query is used, the chunk files for this listing are
  // loaded once and every filter runs over the records; only the first N results are drawn, with "Show more".
  var ig = document.querySelector('[data-index-grid]');
  if (bar && ig) (function () {
    var root = ig.dataset.root || './', shards = (ig.dataset.shards || '').split(' ').filter(Boolean), scope = JSON.parse(ig.dataset.scope || '{"k":"all"}');
    var per = +ig.dataset.per || 48, hl = ig.dataset.hl || 'h2', ctx = ig.dataset.ctx || '';
    var res = document.querySelector('[data-results]'), moreWrap = document.querySelector('[data-more-wrap]'), moreBtn = document.querySelector('[data-more]');
    var pager = document.querySelector('[data-pager]'), prompt = document.querySelector('[data-search-prompt]'), empty = document.querySelector('[data-empty]'), emptyText = document.querySelector('[data-empty-text]');
    var count = bar.querySelector('[data-count]'), f = bar.elements, M = null, recs = null, loading = null, matches = [], shown = 0, vocab = null, seq = 0, usedFuzzy = false, failed = false, timer = null;
    var val = function (n) { return f[n] ? f[n].value : ''; };

    function decode(r, c, i) {
      return { slug: r[0], title: r[1], sub: r[2], authors: r[3].split(';'), ap: r[4], dep: r[5], trd: r[6], lvl: M.levels[r[7]], press: r[8] ? 'fmp' : 'outside',
        ed: r[9].map(function (e) { return { l: e[0].map(function (x) { return M.langs[x]; }), f: M.fmts[e[1]], t: e[2] }; }), qx: r[10], dyn: r[11], ser: r[12], chunk: c, i: i };
    }
    function inScope(o) {
      switch (scope.k) {
        case 'dept': return o.dep.indexOf(M.depts.indexOf(scope.v)) > -1;
        case 'depts': return scope.v.some(function (id) { return o.dep.indexOf(M.depts.indexOf(id)) > -1; });
        case 'hub': var ds = M.hubs[scope.v] || []; return o.dep.some(function (d) { return ds.indexOf(d) > -1; });
        case 'trad': return o.trd.indexOf(M.trads.indexOf(scope.v)) > -1;
        case 'lang': return o.ed.some(function (e) { return e.l.indexOf(scope.v) > -1; });
        case 'author': return o.authors.indexOf(scope.v) > -1;
        case 'series': return !!o.ser && o.ser[0] === scope.v;
        default: return true;
      }
    }
    // Chunks load in parallel and each one is searchable as soon as it arrives; fuzzy matching and "did you mean" wait for the full set.
    var byChunk = [], nLoaded = 0, onProg = null;
    function loadedList() { return [].concat.apply([], byChunk.filter(Boolean)); }
    function ensure() {
      if (recs) return Promise.resolve();
      if (loading && !failed) return loading;
      failed = false;
      loading = loadManifest(root).then(function (m) {
        M = m;
        // three at a time: the first chunks arrive quickly instead of all of them sharing the connection and finishing together
        var next = 0, worker = function () {
          if (next >= shards.length) return Promise.resolve();
          var si = next++, c = shards[si];
          return loadChunk(root, c).then(function () {
            var arr = []; (window.FM_IDX[c] || []).forEach(function (r, k) { var o = decode(r, c, si * 100000 + k); if (inScope(o)) arr.push(o); });
            byChunk[si] = arr; nLoaded++; if (onProg) onProg();
          }).then(worker);
        };
        return Promise.all([worker(), worker(), worker()]);
      }).then(function () { recs = loadedList(); }).catch(function (e) { failed = true; throw e; });
      return loading;
    }
    function hay(o) {
      if (o.s) return o.s;
      var langs = []; o.ed.forEach(function (e) { e.l.forEach(function (c) { if (langs.indexOf(c) < 0) langs.push(c); }); });
      o.s = norm([o.title, o.sub, o.authors.join(' '), o.dep.map(function (x) { return M.deptNames[x]; }).join(' '), o.trd.map(function (x) { return M.tradNames[x]; }).join(' '),
        langs.map(function (c) { var l = I.langs[c] || {}; return (l.name || '') + ' ' + (l.endonym || '') + (c.length > 2 ? ' ' + c : ''); }).join(' '), o.press === 'fmp' ? 'forbidden mantra press' : '', o.qx].join(' '));
      o.t = norm(o.title); o.w = o.s.split(/[^a-z0-9]+/).filter(Boolean);
      return o.s;
    }
    var exact = function (o, x) { var t = hay(o); return t.indexOf(x) > -1 || t.indexOf(x.replace(/-/g, '')) > -1; };
    function closeWords(x) { // vocabulary words within the allowed edit distance of x (built once)
      var m = maxEdits(x), out = {}; if (!m) return out;
      if (!vocab) { var seen = {}; recs.forEach(function (o) { hay(o); o.w.forEach(function (w) { if (w.length > 2) seen[w] = 1; }); }); vocab = Object.keys(seen); }
      vocab.forEach(function (w) { // typos rarely change both of the first two letters, and length must be within the edit budget
        if (Math.abs(w.length - x.length) > m || (w[0] !== x[0] && w[1] !== x[1] && w[0] !== x[1])) return;
        if (osa(x, w.slice(0, x.length + 1), m) <= m || osa(x, w, m) <= m) out[w] = 1;
      });
      return out;
    }
    function suggestFor(terms) {
      var changed = false, out = terms.map(function (t) {
        var m = maxEdits(t); if (!m) return t; closeWords(t); var best = t, bd = m + 1;
        vocab.forEach(function (w) { var d = osa(t, w, m); if (d < bd || (d === bd && d <= m && w[0] === t[0] && best[0] !== t[0])) { bd = d; best = w; } });
        if (bd <= m && best !== t) changed = true; return bd <= m ? best : t;
      });
      return changed ? out.join(' ') : '';
    }
    function run(list, final) {
      var terms = (f.q ? norm(f.q.value).trim() : '').split(/\s+/).filter(Boolean), L = val('lang'), F = val('format'), Sj = val('subject'), T = val('tradition'), V = val('level'), P = val('press');
      var di = Sj ? M.depts.indexOf(Sj) : -1, ti = T ? M.trads.indexOf(T) : -1, eff = L || ctx;
      var base = list.filter(function (o) {
        if (Sj && o.dep.indexOf(di) < 0) return false;
        if (T && o.trd.indexOf(ti) < 0) return false;
        if (V && o.lvl !== V) return false;
        if (P && o.press !== P) return false;
        if (eff || F) return o.ed.some(function (e) { return (!eff || e.l.indexOf(eff) > -1) && (!F || e.f === F); });
        return true;
      });
      var fuzzy = false;
      if (terms.length) {
        fuzzy = !!final && !base.some(function (o) { return terms.every(function (x) { return exact(o, x); }); });
        var sets = fuzzy ? terms.map(closeWords) : null;
        base = base.filter(function (o) {
          var ok = terms.every(function (x, k) { return exact(o, x) || (fuzzy && o.w.some(function (w) { return sets[k][w]; })); });
          if (ok) o.sc = fuzzy ? 1 : terms.every(function (x) { return o.t.indexOf(x) > -1; }) ? 3 : 2;
          return ok;
        });
        base.sort(function (a, b) { return (b.sc - a.sc) || (a.i - b.i); });
      }
      matches = base; usedFuzzy = fuzzy && base.length > 0; return terms;
    }
    function cardEl(o) {
      var L = val('lang'), F = val('format'), eff = L || ctx;
      var eds = o.ed.filter(function (e) { return (!eff || e.l.indexOf(eff) > -1) && (!F || e.f === F); }); if (!eds.length) eds = o.ed;
      var fm = [], lg = []; eds.forEach(function (e) { if (fm.indexOf(e.f) < 0) fm.push(e.f); e.l.forEach(function (x) { if (lg.indexOf(x) < 0) lg.push(x); }); });
      if (eff) lg = [eff];
      var alt = eff ? (eds.filter(function (e) { return e.t; })[0] || {}).t : '', title = alt || o.title;
      var link = (o.dyn ? root + 'book/index.html?s=' + encodeURIComponent(o.slug) : root + 'books/' + o.slug + '/index.html') + (eff ? '#lang-' + eff : '');
      var au = []; o.authors.forEach(function (n, i) { if (i) au.push(', '); au.push(authorLink(M, root, o, i)); });
      return h('article', { 'class': 'card' }, [
        h('a', { 'class': 'card-cover', href: link, tabindex: '-1', 'aria-hidden': 'true' }, [coverEl(title, o.authors[0], o.press === 'fmp')]),
        h('div', { 'class': 'card-body' }, [
          o.press === 'fmp' ? h('span', { 'class': 'badge badge-fmp' }, ['Forbidden Mantra Press']) : null,
          h(hl, { 'class': 'card-title' }, [h('a', { href: link, lang: alt ? eff : null }, [title])]),
          o.sub && !eff ? h('p', { 'class': 'card-sub' }, [o.sub]) : null,
          h('p', { 'class': 'card-author' }, au),
          h('p', { 'class': 'card-meta' }, [fm.map(function (x) { return tr('fmt_' + x); }).join(' · ') + ' · ' + lg.map(langName).join(', ') + ' · ' + tr('lvl_' + o.lvl).split(' / ')[0]])
        ])
      ]);
    }
    function draw(reset) {
      if (reset) { res.textContent = ''; shown = 0; }
      var end = Math.min(matches.length, shown + per), frag = document.createDocumentFragment();
      for (var k = shown; k < end; k++) frag.appendChild(cardEl(matches[k]));
      res.appendChild(frag); shown = end; moreWrap.hidden = shown >= matches.length;
    }
    function setCount() {
      if (!count) return;
      var n = matches.length;
      count.textContent = (n > shown ? tr('count_range', { a: shown, n: n }) : tr(n === 1 ? 'count_one' : 'count_many', { n: n })) + (usedFuzzy ? ' · ' + tr('close_matches', { q: f.q.value.trim() }) : '');
    }
    var active = function () { return ['q', 'subject', 'tradition', 'lang', 'format', 'level', 'press'].some(function (k) { return val(k); }); };
    function present(terms, final) {
      ig.hidden = true; if (pager) pager.hidden = true; if (prompt) prompt.hidden = true; res.hidden = false; draw(true);
      var n = matches.length, L = val('lang');
      if (!final) { if (count) count.textContent = tr('count_loading', { n: n, k: nLoaded, t: shards.length }); if (empty) empty.hidden = true; return; }
      setCount();
      if (empty) {
        empty.hidden = n > 0;
        if (n === 0 && emptyText) emptyText.textContent = L ? tr('empty_lang', { lang: langName(L) }) : tr('empty_filters');
        var box = empty.querySelector('[data-suggest]'); if (box) {
          box.textContent = ''; var sg = n === 0 && terms.length ? suggestFor(terms) : '';
          if (sg) { var bt = h('button', { type: 'button', 'class': 'btn-link' }, [sg]); bt.addEventListener('click', function () { f.q.value = sg; sync(); }); var pre = tr('did_you_mean', { q: '\u0000' }).split('\u0000'); box.appendChild(document.createTextNode(' ' + pre[0])); box.appendChild(bt); box.appendChild(document.createTextNode(pre[1] || '')); }
        }
      }
    }
    function update() {
      var my = ++seq;
      if (!active()) { res.hidden = true; moreWrap.hidden = true; ig.hidden = false; if (pager) pager.hidden = false; if (prompt) prompt.hidden = false; if (empty) empty.hidden = true; if (count && +ig.dataset.total && ig.children.length) count.textContent = tr('count_range', { a: ig.children.length, n: +ig.dataset.total }); else if (count) count.textContent = ''; return; }
      if (recs) { present(run(recs, true), true); return; }
      if (count) count.textContent = tr('loading_index');
      onProg = function () { if (my !== seq || recs) return; present(run(loadedList(), false), false); };
      ensure().then(function () { if (my === seq) present(run(recs, true), true); }).catch(function () { if (my === seq && count) count.textContent = tr('index_error'); });
    }
    function sync() {
      update();
      if (history.replaceState) { var u = new URL(location.href); ['q', 'subject', 'tradition', 'lang', 'format', 'level', 'press'].forEach(function (k) { if (f[k] && f[k].value) u.searchParams.set(k, f[k].value); else u.searchParams.delete(k); }); history.replaceState(null, '', u); }
    }
    applyFilters = update;
    bar.addEventListener('input', function (e) { if (e.target && e.target.name === 'q') { clearTimeout(timer); timer = setTimeout(sync, 120); } else sync(); });
    bar.addEventListener('change', sync); bar.addEventListener('reset', function () { setTimeout(sync, 0); });
    if (moreBtn) moreBtn.addEventListener('click', function () { draw(false); setCount(); });
    var p = new URLSearchParams(location.search);
    if (f.q && p.get('q')) f.q.value = p.get('q');
    ['subject', 'tradition', 'lang', 'format', 'level', 'press'].forEach(function (k) { if (f[k] && p.get(k)) f[k].value = p.get(k); });
    update();
  })();

  // ---------- dynamic book view (books beyond the static-page cap) ----------
  var dyn = document.querySelector('[data-dyn-book]');
  if (dyn) (function () {
    var root = dyn.dataset.root || './', q = new URLSearchParams(location.search), slug = q.get('s'), wrap = dyn.querySelector('.wrap'), st = dyn.querySelector('[data-dyn-status]');
    var fail = function (m) { if (st) st.textContent = m; };
    if (!slug) { fail('No book was specified.'); return; }
    var fnv = function (x) { var hh = 0x811c9dc5; for (var i = 0; i < x.length; i++) { hh ^= x.charCodeAt(i); hh = Math.imul(hh, 0x01000193) >>> 0; } return hh; };
    loadManifest(root).then(function (M) {
      var k = (fnv(slug) % M.dynShards).toString(16); if (k.length < 2) k = '0' + k;
      return loadScript(root + 'assets/idx/dyn-' + k + '.js').then(function () {
        var r = window.FM_DYN && window.FM_DYN[k] && window.FM_DYN[k][slug];
        if (!r) { fail('This book was not found in the catalogue index.'); return; }
        render(M, r);
      });
    }).catch(function () { fail('The catalogue index could not be loaded.'); });
    function render(M, r) {
      var o = { slug: r[0], title: r[1], sub: r[2], authors: r[3].split(';'), ap: r[4], dep: r[5], trd: r[6], lvl: M.levels[r[7]], press: r[8] ? 'fmp' : 'outside', ser: r[12] }, P = r[13];
      document.title = o.title + ' · Forbidden Mantra Press';
      var au = []; o.authors.forEach(function (n, i) { if (i) au.push(', '); au.push(authorLink(M, root, o, i)); });
      var edEls = P.eds.map(function (e) {
        var rs = e.b, anyBuy = rs.some(function (b) { return !b[5]; });
        var dl = [['Translator', e.tr], ['Publisher', e.pub], ['Year', e.y || ''], ['ISBN-13', e.i13], ['ISBN-10', e.i10], ['ASIN', e.a]].filter(function (x) { return x[1]; }).reduce(function (a, x) { a.push(h('dt', {}, [x[0]]), h('dd', {}, [String(x[1])])); return a; }, []);
        return h('section', { 'class': 'edition', 'aria-label': tr('fmt_' + e.f) + ' edition, ' + langName(e.l) + (e.i13 ? ', ISBN ' + e.i13 : ''), lang: e.l }, [
          h('h3', {}, [tr('fmt_' + e.f) + ' · ' + langName(e.l)]),
          e.t ? h('p', { 'class': 'ed-title' }, [e.t]) : null, h('dl', { lang: 'en', dir: 'ltr' }, dl), e.n ? h('p', { 'class': 'note-sm', lang: 'en' }, [e.n]) : null,
          h('ul', { 'class': 'buy', lang: 'en', dir: 'ltr' }, (anyBuy ? [] : [h('li', { 'class': 'status' }, ['No retailer link verified yet.'])]).concat(rs.map(function (b) {
            return h('li', {}, [h('a', { 'class': b[2] ? 'btn' : 'btn btn-ghost', href: b[1], target: '_blank', rel: (b[2] ? 'sponsored ' : '') + 'noopener noreferrer', 'data-track': b[2] ? 'buy' : b[5] ? 'library' : 'link', 'data-work': o.slug, 'data-isbn': e.i13, 'data-market': b[3], 'data-linktype': b[6] || '', 'data-cat': (M.depts && M.depts[o.dep[0]]) || '', 'data-own': o.press === 'fmp' ? 'fmp' : 'third-party' }, [b[5] ? tr('btn_library') : b[0], h('span', { 'class': 'sr' }, [' (opens in a new tab)'])]), h('span', { 'class': 'status' }, [b[4]])]);
          }))),
          h('p', { 'class': 'aff-note-p note-sm', lang: 'en', hidden: rs.some(function (b) { return b[2]; }) ? null : 'hidden' }, [(M.disclosure || '').split('. ')[0] + '. ', h('a', { href: root + 'about/affiliate-disclosure/index.html' }, ['Affiliate disclosure'])])
        ]);
      });
      wrap.textContent = '';
      wrap.appendChild(h('div', { 'class': 'book' }, [
        h('div', { 'class': 'book-cover' }, [coverEl(o.title, o.authors[0], o.press === 'fmp', true)]),
        h('div', { 'class': 'book-main' }, [
          h('h1', {}, [o.title]), o.sub ? h('p', { 'class': 'subtitle' }, [o.sub]) : null, h('p', { 'class': 'byline' }, ['by '].concat(au)),
          o.ser ? h('p', { 'class': 'series' }, [(o.ser[1] ? 'Book ' + o.ser[1] + ' of ' : 'Part of ') + o.ser[0]]) : null,
          h('p', { 'class': 'meta-row' }, [h('span', {}, [tr('lvl_' + o.lvl)])].concat(o.trd.map(function (i) { return h('a', { 'class': 'tag', href: root + 'traditions/' + M.trads[i] + '/index.html' }, [M.tradNames[i]]); }))),
          h('p', { 'class': 'desc' }, [P.d]), P.tm ? h('p', { 'class': 'note note-tm', lang: 'en' }, [P.tm]) : null,
          h('h2', {}, [tr('h_subjects')]), h('ul', { 'class': 'chips' }, o.dep.map(function (i) { return h('li', {}, [h('a', { href: root + 'topics/' + M.depts[i] + '/index.html' }, [M.deptNames[i]])]); }))
        ])
      ]));
      var more = h('div', {}, [h('h2', {}, [tr('h_editions')]), h('p', { 'class': 'note-sm' }, ['Each edition has its own identifier and retailer destination.']), h('div', { 'class': 'editions' }, edEls),
        h('p', { 'class': 'note-sm' }, ['Prices, availability, ratings and cover images are not shown: they appear only through a permitted, maintained source, and none is connected to this preview yet.']),
        h('details', { 'class': 'sources' }, [h('summary', {}, [tr('h_sources')]), h('ul', {}, P.src.concat([].concat.apply([], P.eds.map(function (e) { return e.s; }))).map(function (x) { return h('li', {}, [/^https?:/.test(x[1]) ? h('a', { href: x[1], rel: 'noopener noreferrer' }, [x[0]]) : x[0], ', supports ' + (x[3] || 'edition details') + '; accessed ' + x[2] + '.']); }))]),
        h('p', { 'class': 'disclosure sm', lang: 'en' }, [M.disclosure])]);
      wrap.parentNode.appendChild(h('div', { 'class': 'wrap' }, [more]));
    }
  })();

  applyUI();
  // the search page puts the cursor in the search box
  if (bar && /\/search\/(index\.html)?$/.test(location.pathname) && bar.elements.q && !bar.elements.q.value) bar.elements.q.focus();
})();
