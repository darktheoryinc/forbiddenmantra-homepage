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
    applyFilters();
  }
  function setUI(c) { if (!I.dict[c]) return; ui = c; try { localStorage.setItem('fm-ui', c); } catch (e) {} applyUI(); }

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
  applyUI();
  // the search page puts the cursor in the search box
  if (bar && /\/search\/(index\.html)?$/.test(location.pathname) && bar.elements.q && !bar.elements.q.value) bar.elements.q.focus();
})();
