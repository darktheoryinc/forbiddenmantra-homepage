/* Wix embed helper: loaded only in the Wix package build (FM_WIX=1). It does nothing unless the page is inside an iframe.
   Sends the page height to the parent in the same message format as the original homepage embed ({type:'setHeight', height}),
   so the existing Velo snippet keeps working if an auto-height iframe is used. With a fixed 100vh iframe it is harmless. */
(function () {
  'use strict';
  if (window.self === window.top) return;
  document.documentElement.classList.add('in-wix-frame');
  var last = 0;
  function send() {
    var h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    if (Math.abs(h - last) < 3) return; last = h;
    try { window.parent.postMessage({ type: 'setHeight', height: h }, '*'); } catch (e) {}
  }
  window.addEventListener('load', send); window.addEventListener('resize', send);
  if (window.ResizeObserver) { try { new ResizeObserver(send).observe(document.documentElement); } catch (e) {} }
})();
