/* Ask the Digital Librarian: the homepage's primary search.
   - Understands plain questions ("Do you have books about meditation?") with fixed rules. No AI service, no network calls beyond the site's own static index.
   - Every title, author, cover and link comes from the catalogue index (assets/idx). Nothing is invented. When nothing matches, she says so.
   - Follow-ups work within the conversation: "more", "in Spanish", "only audiobooks", "tell me about the second one".
   - Without JavaScript the form submits to the ordinary search page. */
(function () {
  'use strict';
  var root0 = document.querySelector('[data-ask]');
  if (!root0) return;
  var root = root0.getAttribute('data-root') || './';
  var doc = document;
  var form = root0.querySelector('[data-ask-form]'), input = root0.querySelector('[data-ask-input]'), log = root0.querySelector('[data-ask-log]'), chips = root0.querySelector('[data-ask-chips]'), clear = root0.querySelector('[data-ask-clear]'), live = root0.querySelector('[data-ask-status]');
  var PAGE = 6;

  function h(tag, attrs, kids) {
    var e = doc.createElement(tag); for (var k in (attrs || {})) if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); }); return e;
  }
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); };
  var slugify = function (x) { return norm(x).replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };

  // ---------- catalogue (the same chunk index the search page uses) ----------
  var M = null, recs = [], loading = null, hidden = {};
  function script(src) { return new Promise(function (ok, bad) { var s = doc.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error(src)); }; doc.head.appendChild(s); }); }
  function decode(r) {
    var o = { slug: r[0], title: r[1], sub: r[2], authors: r[3].split(';'), ap: r[4], dep: r[5], trd: r[6], press: !!r[8], dyn: !!r[11], cv: r[13] || null };
    o.langs = {}; o.fmts = {};
    r[9].forEach(function (e) { e[0].forEach(function (x) { o.langs[M.langs[x]] = 1; }); o.fmts[M.fmts[e[1]]] = 1; });
    o.t = norm(o.title); o.st = norm(o.sub); o.a = norm(o.authors.join(' '));
    o.d = norm(o.dep.map(function (x) { return M.deptNames[x]; }).join(' ') + ' ' + o.trd.map(function (x) { return M.tradNames[x]; }).join(' '));
    o.k = norm(r[10] + ' ' + (r[12] ? r[12][0] : ''));
    o.all = o.t + ' ' + o.st + ' ' + o.a + ' ' + o.d + ' ' + o.k;
    return o;
  }
  function ensure() {
    if (loading) return loading;
    loading = (window.FM_MANIFEST ? Promise.resolve(window.FM_MANIFEST) : script(root + 'assets/idx/manifest.js').then(function () { return window.FM_MANIFEST; })).then(function (m) {
      M = m; window.FM_IDX = window.FM_IDX || {}; (m.hidden || []).forEach(function (s) { hidden[s] = 1; });
      return Promise.all(m.chunks.map(function (c) { return (window.FM_IDX[c] ? Promise.resolve() : script(root + 'assets/idx/' + c + '.js')); }));
    }).then(function () {
      M.chunks.forEach(function (c) { window.FM_IDX[c].forEach(function (r) { if (!hidden[r[0]]) recs.push(decode(r)); }); });
    }).catch(function () { loading = null; throw new Error('index'); });
    return loading;
  }

  // ---------- reading a question ----------
  // Topic phrases a visitor may use, mapped to shelves that really exist in the catalogue plus words to look for.
  var TOPICS = [
    ['nag hammadi', { dep: ['gnosticism'], words: ['gnostic', 'nag hammadi'], note: 'The Nag Hammadi library is a collection of Gnostic scriptures, so I searched our Gnosticism shelf. I cannot confirm from the catalogue which books reproduce those exact texts, so please check each book page.' }],
    ['gnostic', { dep: ['gnosticism'], words: ['gnostic'] }],
    ['gnosticism', { dep: ['gnosticism'], words: ['gnostic'] }],
    ['witchcraft', { dep: ['witchcraft', 'wicca', 'spells'], words: ['witch'] }],
    ['witches', { dep: ['witchcraft', 'wicca'], words: ['witch'] }],
    ['witch', { dep: ['witchcraft', 'wicca'], words: ['witch'] }],
    ['wicca', { dep: ['wicca'], words: ['wicca'] }],
    ['pagan', { dep: ['paganism'], words: ['pagan'] }],
    ['spells', { dep: ['spells'], words: ['spell'] }],
    ['meditation', { dep: ['mindfulness'], words: ['meditat'] }],
    ['meditate', { dep: ['mindfulness'], words: ['meditat'] }],
    ['mindfulness', { dep: ['mindfulness'], words: ['mindful'] }],
    ['mantra', { dep: ['sanskrit-mantras'], words: ['mantra'] }],
    ['mantras', { dep: ['sanskrit-mantras'], words: ['mantra'] }],
    ['yoga', { dep: ['yoga'], words: ['yoga'] }],
    ['tantra', { dep: ['tantra'], words: ['tantra'] }],
    ['tarot', { dep: ['tarot'], words: ['tarot'] }],
    ['astrology', { dep: ['astrology'], words: ['astrolog'] }],
    ['dreams', { dep: ['dreams'], words: ['dream'] }],
    ['kundalini', { dep: [], words: ['kundalini'] }],
    ['chakras', { dep: [], words: ['chakra'] }],
    ['chakra', { dep: [], words: ['chakra'] }],
    ['qigong', { dep: ['qigong', 'neigong'], words: ['qigong', 'qi gong', 'neigong', 'nei kung'] }],
    ['qi gong', { dep: ['qigong', 'neigong'], words: ['qigong', 'qi gong', 'neigong'] }],
    ['mo pai', { dep: ['mo-pai'], words: ['mo pai'] }],
    ['buddhism', { dep: ['buddhism'], words: ['buddh'] }],
    ['buddhist', { dep: ['buddhism'], words: ['buddh'] }],
    ['taoism', { dep: ['taoism'], words: ['tao'] }],
    ['daoism', { dep: ['taoism'], words: ['tao', 'dao'] }],
    ['hinduism', { dep: ['hinduism'], words: ['hindu', 'vedic'] }],
    ['kabbalah', { dep: ['judaism-kabbalah'], words: ['kabbal'] }],
    ['sufism', { dep: ['islam-sufism'], words: ['sufi'] }],
    ['alchemy', { dep: ['alchemy'], words: ['alchem'] }],
    ['hermetic', { dep: ['hermeticism'], words: ['hermetic'] }],
    ['mythology', { dep: ['mythology'], words: ['myth'] }],
    ['fantasy', { dep: ['fantasy', 'epic-fantasy', 'urban-fantasy', 'dark-fantasy'], words: ['fantasy'] }],
    ['horror', { dep: ['horror'], words: ['horror'] }],
    ['stress', { dep: ['sleep-stress', 'emotional-wellbeing'], words: ['stress'] }],
    ['anxiety', { dep: ['emotional-wellbeing', 'sleep-stress'], words: ['anxi'] }],
    ['sleep', { dep: ['sleep-stress'], words: ['sleep'] }],
    ['occult', { dep: ['ceremonial-magic', 'hermeticism', 'witchcraft'], words: ['occult'] }],
    ['magic', { dep: ['ceremonial-magic', 'witchcraft', 'spells'], words: ['magic', 'magick'] }],
    ['magick', { dep: ['ceremonial-magic'], words: ['magic', 'magick'] }],
    ['consciousness', { dep: ['consciousness'], words: ['conscious'] }],
    ['stoic', { dep: [], words: ['stoic', 'stoicism'] }],
    ['stoicism', { dep: [], words: ['stoic'] }]
  ].sort(function (a, b) { return b[0].length - a[0].length; });
  var STOP = ('do does did you your yours have has had any anything some something books book titles title about on regarding concerning regard show me list give which what who where when how can could would should please is are was were there ' +
    'tell find look looking want need like recommend recommendations suggest suggestions discuss discusses discussing cover covers covering mention mentions texts text read reading i im ive my we our the a an of in for to and or with that this these those it its be been any also too yes no ok okay thanks thank hi hello hey too more other others another next stock available availability sell sale selling buy buying carry carried offer got price cost').split(' ');
  var FMTS = { audiobook: ['audiobook', 'audiobooks', 'audio book', 'audio books', 'audio'], ebook: ['ebook', 'ebooks', 'e-book', 'e-books', 'kindle'], paperback: ['paperback', 'paperbacks'], hardcover: ['hardcover', 'hardcovers', 'hardback'] };
  var langNames = null;
  function langMap() {
    if (langNames) return langNames; langNames = {};
    var dn = null; try { dn = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (e) {}
    (M.langs || []).forEach(function (c) { var n = dn ? dn.of(c) : c; if (n) langNames[norm(n)] = c; });
    return langNames;
  }

  function parse(raw) {
    var q = ' ' + norm(raw).replace(/[“”"]/g, ' ').replace(/[?!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    var out = { raw: raw, words: [], concepts: [], filters: {}, notes: (/ (stock|available|availability|buy|price|cost|sale|in print) /.test(q) ? ['I can show what our catalogue lists. For availability and price, check the Amazon link on each book page.'] : []), author: null, verb: null, ordinal: null, more: false, reset: false, greet: false, help: false, ours: false };
    if (/ (start over|new search|clear (it|this|all)|forget (that|it)|reset) /.test(q)) out.reset = true;
    if (/^ (hi|hello|hey|greetings|good (morning|afternoon|evening)|namaste|hola|bonjour) $/.test(q)) out.greet = true;
    if (/ (what can you do|how do you work|help me|how does this work|what do you do|help) /.test(q) && !/ (about|on|books?) .{4,}/.test(q.replace(/ what can you do | how do you work | help me | how does this work | what do you do /, ' '))) out.help = true;
    if (/ (more|next|others?|another|show more|keep going|continue|anything else|what else) /.test(q) && !/ (more|next) (about|on) \w+/.test(q) || /^ (more|next|others?) $/.test(q)) out.more = true;
    var ord = q.match(/ (first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|sixth|6th|last) (one|book|title|result)? /) || q.match(/ (?:number|no|#) ?(\d) /);
    if (ord && / (tell|about|more|details|describe|open|link|that|this|which) /.test(q) || (ord && /^ (the )?\w+ (one|book|title|result) $/.test(q))) {
      var map = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4, sixth: 5, '6th': 5, last: -1 };
      out.ordinal = ord[1] in map ? map[ord[1]] : (parseInt(ord[1], 10) - 1);
    }
    // "published by you / your own books / forbidden mantra press"
    if (/ (your (own )?(books|titles|press|publications)|forbidden mantra press|published by you|from you|your own|by you|ours|only (yours|your own)|the press) /.test(q)) { out.ours = true; q = q.replace(/ (your (own )?(books|titles|press|publications)|forbidden mantra press|published by you|from you|your own|by you|only (yours|your own)|the press) /g, ' '); }
    // "by <author>"
    var am = q.match(/ (?:written by|authored by|by|author|from the author) (.+?) $/);
    if (am && am[1] && !/^(you|your|us)$/.test(am[1])) { out.author = am[1].replace(/^(the author|author) /, '').trim(); q = q.slice(0, q.length - am[0].length) + ' '; }
    // formats
    Object.keys(FMTS).forEach(function (f) { FMTS[f].forEach(function (w) { var re = new RegExp(' ' + w.replace(/-/g, '[- ]') + ' '); if (re.test(q)) { out.filters.format = f; q = q.replace(new RegExp(' ' + w.replace(/-/g, '[- ]') + ' ', 'g'), ' '); } }); });
    // language ("in Spanish", "Spanish books")
    var lm = langMap();
    Object.keys(lm).sort(function (a, b) { return b.length - a.length; }).forEach(function (n) { var re = new RegExp(' (?:in |en )?' + n + ' (?:language )?'); if (re.test(q) && !out.filters.lang) { out.filters.lang = lm[n]; out.filters.langName = n; q = q.replace(new RegExp(' (?:in |en )?' + n + ' (?:language )?', 'g'), ' '); } });
    q = ' ' + q.trim() + ' ';
    // topic phrases first, then leftover words
    TOPICS.forEach(function (t) { var re = new RegExp(' ' + t[0] + ' '); if (re.test(q)) { out.concepts.push({ label: t[0], dep: t[1].dep, words: t[1].words, note: t[1].note }); if (t[1].note) out.notes.push(t[1].note); q = q.replace(new RegExp(' ' + t[0] + ' ', 'g'), ' '); } });
    q.trim().split(' ').forEach(function (w) { if (!w || STOP.indexOf(w) > -1 || w.length < 3) return; var st = w.replace(/(ing|es|s|ed)$/, function (m) { return w.length - m.length >= 4 ? '' : m; }); out.words.push(w); out.concepts.push({ label: w, dep: [], words: [st] }); });
    return out;
  }

  // ---------- matching ----------
  function conceptScore(o, c) {
    var s = 0, depIx = c.depIx;
    c.words.forEach(function (w) {
      if (o.t.indexOf(w) > -1) s = Math.max(s, 6); else if (o.a.indexOf(w) > -1) s = Math.max(s, 5); else if (o.st.indexOf(w) > -1) s = Math.max(s, 4);
      else if (o.d.indexOf(w) > -1) s = Math.max(s, 3); else if (o.k.indexOf(w) > -1) s = Math.max(s, 2);
    });
    if (depIx && depIx.length) { for (var i = 0; i < o.dep.length; i++) if (depIx.indexOf(o.dep[i]) > -1) { s = Math.max(s, 7); break; } }
    return s;
  }
  function applyFilters(list, f, ours) {
    return list.filter(function (o) { return (!f.lang || o.langs[f.lang]) && (!f.format || o.fmts[f.format]) && (!ours || o.press); });
  }
  function find(p) {
    p.concepts.forEach(function (c) { c.depIx = (c.dep || []).map(function (d) { return M.depts.indexOf(d); }).filter(function (x) { return x > -1; }); });
    var base = recs, hits = [], partial = false;
    if (p.author) { var an = norm(p.author).split(' ').filter(Boolean); base = base.filter(function (o) { return an.every(function (x) { return o.a.indexOf(x) > -1; }); }); }
    base = applyFilters(base, p.filters, p.ours);
    if (!p.concepts.length) { hits = base.map(function (o) { return { o: o, s: 1 }; }); }
    else {
      base.forEach(function (o) { var tot = 0, all = true; p.concepts.forEach(function (c) { var s = conceptScore(o, c); if (!s) all = false; tot += s; }); if (all) hits.push({ o: o, s: tot }); });
      if (!hits.length && p.concepts.length > 1) {
        // nothing matches every word: offer the books that match the most distinctive ones, clearly labelled
        var need = Math.max(1, p.concepts.length - 1);
        base.forEach(function (o) { var n = 0, tot = 0; p.concepts.forEach(function (c) { var s = conceptScore(o, c); if (s >= 3) { n++; tot += s; } }); if (n >= need) hits.push({ o: o, s: tot }); });
        partial = hits.length > 0;
      }
    }
    hits.sort(function (a, b) { return (b.s - a.s) || ((b.o.press ? 1 : 0) - (a.o.press ? 1 : 0)) || (a.o.title < b.o.title ? -1 : 1); });
    return { books: hits.map(function (x) { return x.o; }), partial: partial };
  }

  // ---------- presenting ----------
  var fmtLabel = function (c) { return M.fmts[c] || c; };
  var langLabel = function (c) { try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(c); } catch (e) { return c; } };
  function bookHref(o) { return o.dyn ? root + 'book/index.html?s=' + encodeURIComponent(o.slug) : root + 'books/' + o.slug + '/index.html'; }
  function authorHref(o, i) { return o.ap.charAt(i) === '1' || (M && M.authorPages === 'all') ? root + 'authors/' + slugify(o.authors[i]) + '/index.html' : root + 'search/index.html?q=' + encodeURIComponent(o.authors[i]); }
  function coverEl(o) {
    if (o.cv) {
      var k = o.cv[0];
      return h('div', { 'class': 'cover cover-photo' }, [h('img', { src: root + 'assets/covers/' + k + '-240.webp', width: o.cv[1], height: o.cv[2], alt: 'Cover of ' + o.title, loading: 'lazy', decoding: 'async' })]);
    }
    return h('div', { 'class': 'cover cover-ph' + (o.press ? ' cover-fmp' : ''), role: 'img', 'aria-label': 'Text placeholder for the cover of ' + o.title + '. The original cover art is not available yet.', style: '--h:38' }, [
      h('span', { 'class': 'ph-orn', 'aria-hidden': 'true' }, ['✦']), h('span', { 'class': 'cover-title ph-t' }, [o.title]), h('span', { 'class': 'ph-cap', 'aria-hidden': 'true' }, ['Cover art coming'])]);
  }
  function resultCard(o) {
    var a = h('p', { 'class': 'ask-by' }); o.authors.forEach(function (n, i) { if (i) a.appendChild(doc.createTextNode(', ')); a.appendChild(h('a', { href: authorHref(o, i) }, [n])); });
    var fm = Object.keys(o.fmts).map(fmtLabel).join(' · '), lg = Object.keys(o.langs).map(langLabel).join(', ');
    return h('li', { 'class': 'ask-card' }, [
      h('a', { 'class': 'ask-cv', href: bookHref(o), tabindex: '-1', 'aria-hidden': 'true' }, [coverEl(o)]),
      h('div', { 'class': 'ask-tx' }, [
        o.press ? h('span', { 'class': 'badge badge-fmp' }, ['Forbidden Mantra Press']) : null,
        h('p', { 'class': 'ask-t' }, [h('a', { href: bookHref(o) }, [o.title])]), a,
        h('p', { 'class': 'ask-meta' }, [fm + (lg ? ' · ' + lg : '')])])]);
  }

  var convo = { last: null, shown: 0, list: [], concepts: [], filters: {}, ours: false, author: null, shownList: [] };
  function addMsg(who, kids) {
    var m = h('div', { 'class': 'ask-msg ask-' + who }, [h('p', { 'class': 'ask-who' }, [who === 'you' ? 'You' : 'Digital Librarian'])].concat(kids));
    log.appendChild(m); log.hidden = false; clear.hidden = false; root0.setAttribute('data-active', '1');
    log.scrollTop = log.scrollHeight; return m;
  }
  function say(text) { return h('p', { 'class': 'ask-text', lang: 'en' }, [text]); }
  function describe(p) {
    var parts = [];
    if (p.concepts.length) parts.push('“' + p.concepts.map(function (c) { return c.label; }).join(' ') + '”');
    if (p.author) parts.push('by ' + p.author);
    if (p.filters.format) parts.push(p.filters.format + ' editions');
    if (p.filters.lang) parts.push('in ' + (p.filters.langName ? p.filters.langName.charAt(0).toUpperCase() + p.filters.langName.slice(1) : p.filters.lang));
    if (p.ours) parts.push('from Forbidden Mantra Press');
    return parts.join(', ');
  }
  function showBooks(books, from, intro, notes) {
    var slice = books.slice(from, from + PAGE), ul = h('ul', { 'class': 'ask-results' }, slice.map(resultCard));
    var kids = [say(intro)]; (notes || []).forEach(function (n) { kids.push(h('p', { 'class': 'ask-note', lang: 'en' }, [n])); }); kids.push(ul);
    convo.shown = from + slice.length; convo.shownList = convo.shownList.concat(slice);
    if (convo.shown < books.length) {
      var b = h('button', { type: 'button', 'class': 'btn btn-ghost ask-more' }, ['Show ' + Math.min(PAGE, books.length - convo.shown) + ' more']);
      b.addEventListener('click', function () { b.remove(); submit('more', { echo: false }); }); kids.push(b);
    }
    return kids;
  }
  function respond(text, opts) {
    var p = parse(text), echo = !(opts && opts.echo === false);
    if (echo) addMsg('you', [h('p', { 'class': 'ask-text' }, [text])]);
    var out = (function () {
      if (p.reset) { convo = { last: null, shown: 0, list: [], concepts: [], filters: {}, ours: false, author: null, shownList: [] }; return [say('Fresh start. What would you like to read about?')]; }
      if (p.greet) return [say('Hello. Ask me about a subject, an author or a title in our catalogue, for example “Do you have books about meditation?”.')];
      if (p.help) return [say('I search the Forbidden Mantra Press catalogue. Ask about a subject (“Show me books about witchcraft”), an author (“books by Emily K Patel”), a language (“in Spanish”) or a format (“audiobooks”). I only show books that are listed here, and I never guess.')];
      if (p.ordinal != null && convo.shownList.length) {
        var i = p.ordinal < 0 ? convo.shownList.length + p.ordinal : p.ordinal, o = convo.shownList[i];
        if (!o) return [say('I only showed ' + convo.shownList.length + ' book' + (convo.shownList.length === 1 ? '' : 's') + ' so far, so there is no number ' + (i + 1) + '.')];
        var d = Object.keys(o.fmts).map(fmtLabel).join(', '), lg = Object.keys(o.langs).map(langLabel).join(', ');
        return [say('“' + o.title + '” by ' + o.authors.join(', ') + '. Listed formats: ' + d + '. Languages with a listed edition: ' + lg + '. The book page has the full edition details and purchase links.'), h('ul', { 'class': 'ask-results' }, [resultCard(o)])];
      }
      if (p.more && convo.last) {
        if (convo.shown >= convo.list.length) return [say('That is everything I have for that question: ' + convo.list.length + (convo.list.length === 1 ? ' book.' : ' books.') + ' Try a broader subject, or “start over”.')];
        return showBooks(convo.list, convo.shown, 'Here are more:', []);
      }
      var hasTopic = p.concepts.length || p.author, hasFilter = p.filters.lang || p.filters.format || p.ours;
      if (!hasTopic && hasFilter && convo.last) { // a follow-up that only narrows the previous question
        p.concepts = convo.concepts; p.author = convo.author; p.filters = Object.assign({}, convo.filters, p.filters); p.ours = p.ours || convo.ours;
      } else if (!hasTopic && !hasFilter) {
        return [say('I did not catch a subject, author or title in that. Try something like “books about meditation”, “books by Gabor Maté” or “Nag Hammadi texts”.')];
      }
      var r = find(p), ds = describe(p);
      convo.last = p; convo.concepts = p.concepts; convo.filters = p.filters; convo.ours = p.ours; convo.author = p.author; convo.list = r.books; convo.shown = 0; convo.shownList = [];
      if (!r.books.length) {
        var tips = hasFilter && p.concepts.length ? ' Try dropping the language or format, or a broader subject.' : ' Try a broader subject, an author name or an ISBN.';
        return [say('I could not find any books in our catalogue matching ' + ds + '. I will not suggest titles we do not list.' + tips)];
      }
      var intro = (r.partial ? 'Nothing matches every word of ' + ds + ', so these are the closest matches: ' : 'I found ' + r.books.length + (r.books.length === 1 ? ' book' : ' books') + ' in our catalogue for ' + ds + '. ') + (r.books.length > PAGE ? 'Here are the first ' + PAGE + ':' : (r.partial ? '' : 'Here it is:'));
      return showBooks(r.books, 0, intro.trim(), p.notes);
    })();
    var m = addMsg('bot', out);
    live.textContent = (m.querySelector('.ask-text') || {}).textContent || '';
    try { doc.dispatchEvent(new CustomEvent('fm:librarian', { detail: { query: text, total: convo.list.length, done: true, slugs: convo.shownList.slice(0, 6).map(function (o) { return o.slug; }), source: 'ask' } })); } catch (e) {}
  }

  var busy = null;
  function submit(text, opts) {
    var t = String(text || '').trim(); if (!t) return;
    root0.setAttribute('data-busy', '1'); live.textContent = 'Searching the catalogue…';
    ensure().then(function () { respond(t, opts); root0.removeAttribute('data-busy'); })
      .catch(function () { addMsg('bot', [say('The catalogue index could not be loaded just now. You can still use the full search page.'), h('p', {}, [h('a', { href: root + 'search/index.html?q=' + encodeURIComponent(t) }, ['Open the search page'])])]); root0.removeAttribute('data-busy'); });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; if (!v.trim()) { input.focus(); return; } input.value = ''; submit(v); input.focus(); });
  if (chips) chips.addEventListener('click', function (e) { var b = e.target.closest('button[data-q]'); if (b) { submit(b.getAttribute('data-q')); input.focus(); } });
  clear.addEventListener('click', function () { log.textContent = ''; log.hidden = true; clear.hidden = true; root0.removeAttribute('data-active'); convo = { last: null, shown: 0, list: [], concepts: [], filters: {}, ours: false, author: null, shownList: [] }; live.textContent = 'Conversation cleared.'; input.focus(); });
  input.addEventListener('focus', function () { ensure().catch(function () {}); }, { once: true });
  root0.setAttribute('data-ready', '1');
  window.FMAsk = { submit: submit, state: function () { return convo; } };
})();
