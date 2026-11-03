/* Voice input for the catalogue search boxes. Listen, transcribe, search. The site never speaks.
   - Uses the browser's own SpeechRecognition / webkitSpeechRecognition; no library, no paid API, no server call from this site.
   - Starts only when the visitor presses the microphone button. Nothing is recorded or stored by this site; the text goes into the existing
     search box and the existing search runs. (Some browsers send the audio to their provider's speech service; see the privacy page.)
   - Recognition language: data-lang on the script tag (config/site.json voice.lang, default en-US), or window.FM_VOICE_LANG, or the optional
     map window.FM_VOICE_LANG_BY_UI = { fr: 'fr-FR' } keyed by the interface language. English only for now. */
(function () {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return; // unsupported browser (for example Firefox): no button, typed search is untouched

  var I = window.FM_I18N || { dict: { en: {} } };
  var ui = 'en';
  try { ui = new URLSearchParams(location.search).get('ui') || localStorage.getItem('fm-ui') || 'en'; } catch (e) {}
  if (!I.dict[ui]) ui = 'en';
  function tr(k) { return (I.dict[ui] && I.dict[ui][k]) || (I.dict.en && I.dict.en[k]) || k; }

  var self = document.currentScript || document.querySelector('script[src$="voice.js"]');
  function recLang() {
    var m = window.FM_VOICE_LANG_BY_UI; if (m && m[ui]) return m[ui];
    return window.FM_VOICE_LANG || (self && self.getAttribute('data-lang')) || 'en-US';
  }
  var framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }

  // "Books about Lord Shiva" -> "Shiva" (see HONORIFIC below); "books by Helena Blavatsky" -> "Helena Blavatsky". The catalogue search needs every word to match,
  // so spoken lead-ins are trimmed. Only a leading filler phrase and end punctuation are removed; the rest is left exactly as heard.
  var LEAD = /^\s*(?:(?:please\s+)?(?:show me|find me|find|search for|look for|i(?:'m| am) looking for|do you have|have you got|are there any|give me)\s+)?(?:(?:any\s+|some\s+|all\s+)?(?:books?|titles?|works?|texts?)\s+(?:about|on|by|from|regarding|concerning|written by|of)\s+)/i;
  // Catalogue titles say "Shiva", not "Lord Shiva", and every word must match, so a spoken honorific is dropped, but only directly before a deity name.
  var HONORIFIC = /^(?:lord|sri|shri|sree|bhagwan|bhagavan)\s+(?=(?:shiva|siva|krishna|vishnu|ganesha|ganesh|ganapati|rama|hanuman|buddha|brahma|murugan|kartikeya|narasimha|venkateswara|jagannath)\b)/i;
  function clean(t) {
    var s = String(t || '').replace(/\s+/g, ' ').trim();
    var c = s.replace(LEAD, '').trim();
    if (c) s = c;
    s = s.replace(HONORIFIC, '');
    return s.replace(/[.?!,;:]+$/, '').trim();
  }

  var live = document.createElement('p');
  live.className = 'sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);

  var MIC = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>';

  var active = null; // { rec, btn, input, tip, got, err, timer }
  var hideTimer = null;

  function say(tip, text, keep) {
    live.textContent = text;
    if (!tip) return;
    tip.textContent = text; tip.hidden = !text;
    clearTimeout(hideTimer);
    if (text && !keep) hideTimer = setTimeout(function () { tip.hidden = true; }, 6000);
  }
  function reset(a) {
    if (!a) return;
    a.btn.classList.remove('is-listening');
    a.btn.setAttribute('aria-pressed', 'false');
    a.btn.setAttribute('aria-label', tr('voice_start')); a.btn.title = tr('voice_start');
    if (active === a) active = null;
  }
  function cancel() {
    if (!active) return;
    var a = active; a.cancelled = true;
    try { a.rec.abort(); } catch (e) {}
    reset(a); say(a.tip, '');
  }

  function run(input, btn, tip) {
    var form = input.form, a = { rec: new SR(), btn: btn, input: input, tip: tip, got: false, err: false, cancelled: false };
    var rec = a.rec;
    rec.lang = recLang(); rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onstart = function () {
      btn.classList.add('is-listening'); btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', tr('voice_stop')); btn.title = tr('voice_stop');
      say(tip, tr('voice_listening'), true);
    };
    rec.onresult = function (ev) {
      var text = '', fin = false;
      for (var i = ev.resultIndex; i < ev.results.length; i++) { text += ev.results[i][0].transcript; if (ev.results[i].isFinal) fin = true; }
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (!fin) { input.value = text; return; } // show interim words as they arrive; the search runs on the final result
      a.got = true;
      input.value = clean(text);
      say(tip, '');
      live.textContent = tr('voice_heard').replace('{q}', input.value);
      if (form && form.classList.contains('nav-search')) { // header box: normal form submit to the search page
        if (form.requestSubmit) form.requestSubmit(); else form.submit();
      } else { // filter bar: the existing input handler runs the existing search, filters and paging
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error; if (e === 'aborted' || a.cancelled) return;
      a.err = true;
      var msg = e === 'not-allowed' || e === 'service-not-allowed' ? (framed ? tr('voice_blocked_framed') : tr('voice_denied'))
        : e === 'no-speech' ? tr('voice_nospeech')
        : e === 'audio-capture' ? tr('voice_nomic')
        : e === 'network' ? tr('voice_network')
        : tr('voice_error');
      say(tip, msg);
    };
    rec.onend = function () {
      var wasCancelled = a.cancelled;
      reset(a);
      if (!wasCancelled && !a.got && !a.err) say(tip, tr('voice_nospeech'));
    };
    active = a;
    try { rec.start(); } catch (e) { a.err = true; reset(a); say(tip, tr('voice_error')); }
  }

  function attach(input) {
    if (input.dataset.voice) return;
    input.dataset.voice = '1';
    var hadFocus = document.activeElement === input, caret = hadFocus ? input.selectionStart : null;
    var wrap = document.createElement('span'); wrap.className = 'voice-wrap';
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    if (hadFocus) { input.focus(); try { input.setSelectionRange(caret, caret); } catch (e) {} } // moving a node drops focus; keep the cursor where the page put it
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'voice-btn';
    btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', tr('voice_start')); btn.title = tr('voice_start');
    btn.innerHTML = MIC;
    var tip = document.createElement('span'); tip.className = 'voice-tip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true'); // spoken status is in the shared live region
    wrap.appendChild(btn); wrap.appendChild(tip);
    btn.addEventListener('click', function () {
      if (active && active.btn === btn) { cancel(); return; }
      if (active) cancel();
      say(tip, '');
      run(input, btn, tip);
    });
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && active) cancel(); });
  window.addEventListener('pagehide', cancel);
  document.addEventListener('visibilitychange', function () { if (document.hidden) cancel(); });

  function init() { document.querySelectorAll('.nav-search input[name=q], .filters .f-q input[name=q]').forEach(attach); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
