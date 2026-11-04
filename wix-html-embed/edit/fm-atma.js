/* ============================================================================================
   LIBRARY LAUNCH SWITCH: when the library goes live, edit ONLY the next line.
   Use the public address with https and no trailing slash, e.g. "https://library.forbiddenmantra.com"
   While it is empty, the Atma Library Browser shows "Library Opens Soon", is disabled, and links nowhere.
   ============================================================================================ */
var FM_LIBRARY_URL = "";
/* ============================================================================================ */
(function () {
  var form = document.getElementById('fmLibForm'), input = document.getElementById('fmLibQ'), soon = document.getElementById('fmLibSoon');
  if (!form || !input) return;
  var base = null;
  try { var u = new URL(FM_LIBRARY_URL); if (u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) base = u; } catch (e) {}
  if (base) {
    form.setAttribute('action', base.origin + '/search/index.html');
    input.disabled = false; form.querySelector('button').disabled = false; input.removeAttribute('aria-describedby');
    if (soon) soon.hidden = true;
  } else {
    form.addEventListener('submit', function (e) { e.preventDefault(); });
  }
})();
