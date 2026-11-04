// WIX VELO PAGE CODE for the homepage (replaces the old snippet).
// Why: the embedded page sends its height as { type: 'wixHeight' }, but the old snippet only reacted to 'setHeight' and listened on window,
// so the HTML element was never resized. A Wix page receives messages from an HTML element through that element's onMessage() (Wix docs: "When the parent
// site is a Wix site, call onMessage() to receive the message on the parent page"). This version accepts both message names.
// Replace #html3 with your HTML element's ID if it differs (select the element: its ID is shown in the editor).
$w.onReady(function () {
  $w('#html3').onMessage(function (event) {
    var d = event.data;
    if (d && (d.type === 'wixHeight' || d.type === 'setHeight')) {
      var h = Number(d.height);
      if (h > 100 && h < 20000) { $w('#html3').height = h; }
    }
  });
});
