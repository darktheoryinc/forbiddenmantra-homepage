/* Forbidden Mantra Press header features (additive; nothing here touches the original content).
   1) Atma library search: sends the visitor's query to the Library's real search page: <libraryBaseUrl>/search/index.html?q=<query> (verified against the Library's own search form).
   2) IOSutra Pay As You Go: becomes a link only when FM_CONFIG.iosutraPaygUrl is a verified https address.
   3) Height messages: posts BOTH message names so any parent listener (the original snippet's 'setHeight' or the page's 'wixHeight') can resize the embed. */
(function () {
  var cfg = window.FM_CONFIG || {};
  // https only; plain http is accepted for localhost so the feature can be tested without a public address
  function https(u) { try { var x = new URL(u); return (x.protocol === 'https:' || (x.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(x.hostname))) ? x : null; } catch (e) { return null; } }

  // ---- search ----
  var form = document.querySelector('[data-fm-search]'), note = document.querySelector('[data-fm-search-note]'), input = document.getElementById('fm-q');
  var base = https(cfg.libraryBaseUrl);
  if (form) {
    if (base) form.setAttribute('action', base.origin + '/search/index.html');
    form.addEventListener('submit', function (e) {
      var q = (input.value || '').replace(/\s+/g, ' ').trim();
      if (!q) { e.preventDefault(); note.textContent = 'Type a title, author or subject to search the library.'; note.hidden = false; input.focus(); return; }
      if (!base) { e.preventDefault(); note.textContent = 'The book library search opens soon. Thank you for your patience.'; note.hidden = false; return; }
      input.value = q; note.hidden = true; // the form (GET, new tab) now opens <library>/search/index.html?q=<query>
    });
  }

  // ---- IOSutra Pay As You Go ----
  var pay = https(cfg.iosutraPaygUrl);
  document.querySelectorAll('[data-fm-payg],[data-fm-payg-cta]').forEach(function (a) {
    var soon = a.querySelector('[data-fm-soon]');
    if (pay) { a.setAttribute('href', pay.href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); a.removeAttribute('aria-disabled'); if (soon) soon.hidden = true; }
    else a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  // ---- height messages for the Wix HTML element ----
  function height() { return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight); }
  function send() { var h = height(); try { window.parent.postMessage({ type: 'wixHeight', height: h }, '*'); window.parent.postMessage({ type: 'setHeight', height: h }, '*'); } catch (e) {} }
  window.addEventListener('load', function () { send(); [300, 800, 1500, 3000].forEach(function (t) { setTimeout(send, t); }); });
  window.addEventListener('resize', send);
  if (window.ResizeObserver) new ResizeObserver(send).observe(document.body);
})();
