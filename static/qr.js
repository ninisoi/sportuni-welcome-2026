
/* SPORTUNI WELCOME 2026
   Automatically refresh the QR access image.
*/

(() => {
  "use strict";

  const qr = document.getElementById("qr");

  if (!qr) return;

  let loading = false;

  function refreshQR() {
    if (loading) return;

    loading = true;

    const image = new Image();

    image.onload = () => {
      qr.src = image.src;
      loading = false;
    };

    image.onerror = () => {
      loading = false;
    };

    image.src =
      "/api/qr.svg?t=" + Date.now();
  }

  refreshQR();

  // Keep QR access current after session rotation.
  setInterval(refreshQR, 4000);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        refreshQR();
      }
    }
  );
})();
