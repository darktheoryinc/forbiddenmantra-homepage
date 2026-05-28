// PASTE THIS INTO YOUR WIX PAGE CODE (bottom panel "Page Code" tab)
// This listens for the height message from the HTML iFrame and resizes it automatically

$w.onReady(function () {
  // Listen for height messages from the HTML iframe
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'setHeight') {
      var newHeight = event.data.height;
      if (newHeight && newHeight > 100) {
        // Replace 'html3' below with your actual iFrame element ID if different
        // You can find it by clicking the iFrame — it shows as "iFrame #html3" in the blue label
        $w('#html3').height = newHeight;
      }
    }
  });
});
