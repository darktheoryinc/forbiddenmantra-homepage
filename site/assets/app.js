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

  // ---------- mobile nav ----------
  var t = document.querySelector('.nav-toggle'), n = document.getElementById('nav');
  if (t && n) t.addEventListener('click', function () { var o = n.classList.toggle('open'); t.setAttribute('aria-expanded', o); if (o && menu) { menu.querySelector('.lang-panel').hidden = true; menu.querySelector('.lang-btn').setAttribute('aria-expanded', 'false'); } });

  // ---------- catalogue filters (book language is edition-level) ----------
  var bar = document.querySelector('[data-filterbar]'), grid = document.querySelector('[data-filterable]');
  if (bar && grid) {
    var cards = [].slice.call(grid.querySelectorAll('.card')), empty = document.querySelector('[data-empty]'), emptyText = document.querySelector('[data-empty-text]'), count = bar.querySelector('[data-count]');
    var f = bar.elements;
    cards.forEach(function (c) { c._ed = JSON.parse(c.dataset.ed || '[]'); var a = c.querySelectorAll('a[href]'); c._links = [].slice.call(a).map(function (x) { return [x, x.getAttribute('href')]; }); });
    var selected = function (name) { return f[name] ? f[name].value : ''; };
    var has = function (arr, v) { return arr.indexOf(v) > -1; };

    applyFilters = function () {
      var q = f.q ? norm(f.q.value).trim() : '', terms = q.split(/\s+/).filter(Boolean);
      var L = selected('lang'), F = selected('format'), shown = 0;
      cards.forEach(function (c) {
        var ok = true;
        if (terms.length) ok = terms.every(function (x) { return c.dataset.search.indexOf(x) > -1 || c.dataset.search.indexOf(x.replace(/-/g, '')) > -1; });
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
          shown++;
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
      if (empty) {
        empty.hidden = shown > 0;
        if (shown === 0 && emptyText) emptyText.textContent = L ? tr('empty_lang', { lang: langName(L) }) : tr('empty_filters');
      }
      if (count) count.textContent = tr(shown === 1 ? 'count_one' : 'count_many', { n: shown });
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
})();
