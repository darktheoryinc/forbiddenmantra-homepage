// OPTIONAL. Only needed if you choose the "grow with the page" (auto-height) layout. The recommended layout (fixed height) needs no code.
// Paste into the Wix page's code panel (Velo / Dev Mode on). Replace #html3 with your embed element's ID if it is different.
// The bookstore sends {type:'setHeight', height} (the same message the original homepage sent), so this is the original idea, updated to use the element's own onMessage.
$w.onReady(function () {
  var box = $w('#html3');
  box.onMessage(function (event) {
    var d = event.data;
    if (d && d.type === 'setHeight' && d.height > 100) { box.height = d.height; }
  });
});
