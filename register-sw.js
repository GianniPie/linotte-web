// Registers sw.js from the page. This must run in the browser tab, not
// inside the service worker itself (that was the previous bug: sw.js
// tried to register itself, which silently fails since a worker has no
// `navigator.serviceWorker`).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => {
        console.log("[sw] registered", reg.scope);

        // If a new version of sw.js is found while the app is open,
        // activate it right away and reload once so the player gets the
        // update without needing to fully close the tab.
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              console.log("[sw] updated, reloading");
              window.location.reload();
            }
          });
        });
      })
      .catch((err) => console.error("[sw] registration failed", err));
  });
}
