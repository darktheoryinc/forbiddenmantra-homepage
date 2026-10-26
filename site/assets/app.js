(function () {
  // mobile nav
  var t = document.querySelector('.nav-toggle'), n = document.getElementById('nav');
  if (t && n) t.addEventListener('click', function () { var o = n.classList.toggle('open'); t.setAttribute('aria-expanded', o); });

  var norm = function (s) { return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); };
  var bar = document.querySelector('[data-filterbar]'), grid = document.querySelector('[data-filterable]');
  if (!bar || !grid) return;
  var cards = [].slice.call(grid.querySelectorAll('.card')), empty = document.querySelector('[data-empty]'), count = bar.querySelector('[data-count]');
  var f = bar.elements;

  function apply() {
    var q = f.q ? norm(f.q.value).trim() : '';
    var qNoHyphen = q.replace(/-/g, '');
    var terms = q.split(/\s+/).filter(Boolean);
    var shown = 0;
    cards.forEach(function (c) {
      var blob = c.dataset.search, ok = true;
      if (terms.length) ok = terms.every(function (x) { return blob.indexOf(x) > -1 || blob.indexOf(x.replace(/-/g, '')) > -1; });
      if (ok && f.subject && f.subject.value) ok = (' ' + c.dataset.subjects + ' ').indexOf(' ' + f.subject.value + ' ') > -1;
      if (ok && f.tradition && f.tradition.value) ok = (' ' + c.dataset.tradition + ' ').indexOf(' ' + f.tradition.value + ' ') > -1;
      if (ok && f.lang.value) ok = (' ' + c.dataset.lang + ' ').indexOf(' ' + f.lang.value + ' ') > -1;
      if (ok && f.format.value) ok = (' ' + c.dataset.format + ' ').indexOf(' ' + f.format.value + ' ') > -1;
      if (ok && f.level.value) ok = c.dataset.level === f.level.value;
      if (ok && f.press && f.press.value) ok = c.dataset.press === f.press.value;
      c.hidden = !ok; if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
    if (count) count.textContent = shown + (shown === 1 ? ' book' : ' books') + ' shown';
    // keep URL shareable for search
    if (f.q && history.replaceState) { var u = new URL(location.href); if (f.q.value) u.searchParams.set('q', f.q.value); else u.searchParams.delete('q'); history.replaceState(null, '', u); }
  }
  bar.addEventListener('input', apply); bar.addEventListener('change', apply);
  bar.addEventListener('reset', function () { setTimeout(apply, 0); });
  var p = new URLSearchParams(location.search);
  if (f.q && p.get('q')) f.q.value = p.get('q');
  ['subject', 'tradition', 'lang', 'format', 'level', 'press'].forEach(function (k) { if (f[k] && p.get(k)) f[k].value = p.get(k); });
  apply();
})();
