// Linotte Service Worker
// Bump CACHE_VERSION any time you change any file in PRECACHE_URLS below,
// or any time you deploy new game code/assets. Old caches are cleaned up
// automatically on activate.
const CACHE_VERSION = "linotte-v2";
const PRECACHE = `${CACHE_VERSION}-precache`;
const RUNTIME = `${CACHE_VERSION}-runtime`;

// Every local file the app needs to run fully offline (app shell +
// every board, dice, piece, background and sound asset it can use).
const PRECACHE_URLS = [
  "./",
  "animations.css",
  "assets.js",
  "confetti.js",
  "index.html",
  "linotte.css",
  "linotte.js",
  "resources/favicon/apple-touch-icon.png",
  "resources/favicon/favicon-96x96.png",
  "resources/favicon/favicon.ico",
  "resources/favicon/favicon.svg",
  "resources/favicon/site.webmanifest",
  "resources/favicon/web-app-manifest-192x192.png",
  "resources/favicon/web-app-manifest-512x512.png",
  "resources/favicon/icon-maskable-192x192.png",
  "resources/favicon/icon-maskable-512x512.png",
  "resources/images/arl.svg",
  "resources/images/arr.svg",
  "resources/images/backgrounds/confetti-doodles-prev.png",
  "resources/images/backgrounds/confetti-doodles.svg",
  "resources/images/backgrounds/diamond-sunset-prev.png",
  "resources/images/backgrounds/diamond-sunset.svg",
  "resources/images/backgrounds/liquid-cheese-prev.png",
  "resources/images/backgrounds/liquid-cheese.svg",
  "resources/images/backgrounds/parabolic-ellipse-prev.png",
  "resources/images/backgrounds/parabolic-ellipse.svg",
  "resources/images/backgrounds/pattern-randomized-prev.png",
  "resources/images/backgrounds/pattern-randomized.svg",
  "resources/images/backgrounds/repeating-triangles-prev.png",
  "resources/images/backgrounds/repeating-triangles.svg",
  "resources/images/backgrounds/subtle-prism-prev.png",
  "resources/images/backgrounds/subtle-prism.svg",
  "resources/images/backgrounds/subtle-prism2.svg",
  "resources/images/backgrounds/sun-tornado-prev.png",
  "resources/images/backgrounds/sun-tornado.svg",
  "resources/images/backgrounds/tortoise-shell-prev.png",
  "resources/images/backgrounds/tortoise-shell.svg",
  "resources/images/backgrounds/varying-stripes-prev.png",
  "resources/images/backgrounds/varying-stripes.svg",
  "resources/images/board_n.svg",
  "resources/images/board_p.svg",
  "resources/images/board_t.svg",
  "resources/images/dice/c101.svg",
  "resources/images/dice/ch001.png",
  "resources/images/dice/chinese_sprite.png",
  "resources/images/dice/classic_sprite.svg",
  "resources/images/dice/flat_sprite.svg",
  "resources/images/dice/g107.svg",
  "resources/images/dice/pe001.png",
  "resources/images/dice/persian_sprite.png",
  "resources/images/dice/red1.png",
  "resources/images/dice/red_sprite.png",
  "resources/images/dice/tr101.png",
  "resources/images/dice/traditional_sprite.png",
  "resources/images/g1.svg",
  "resources/images/g10455.svg",
  "resources/images/g10456.svg",
  "resources/images/g10457.svg",
  "resources/images/g10481.svg",
  "resources/images/g10482.svg",
  "resources/images/g10483.svg",
  "resources/images/g10484.svg",
  "resources/images/g10485.svg",
  "resources/images/g10486.svg",
  "resources/images/g10491.svg",
  "resources/images/g10492.svg",
  "resources/images/g10493.svg",
  "resources/images/g10495.svg",
  "resources/images/g10496.svg",
  "resources/images/g10497.svg",
  "resources/images/g10498.svg",
  "resources/images/g11851.svg",
  "resources/images/g11852.svg",
  "resources/images/g11853.svg",
  "resources/images/g2.svg",
  "resources/images/g3.svg",
  "resources/images/g4.svg",
  "resources/images/g5.svg",
  "resources/images/g6.svg",
  "resources/images/g7.svg",
  "resources/images/g8.svg",
  "resources/images/imgWinCarre.png",
  "resources/images/p018_fdc5a3ff.svg",
  "resources/images/p104-coin.svg",
  "resources/images/p104-pawn.svg",
  "resources/images/p105-coin.svg",
  "resources/images/p105-pawn.svg",
  "resources/images/path11856-3-0.svg",
  "resources/images/pieces/p001_ed1c24ff.svg",
  "resources/images/pieces/p002_40b93cff.svg",
  "resources/images/pieces/p003_50ade5ff.svg",
  "resources/images/pieces/p004_e9dc01ff.svg",
  "resources/images/pieces/p005_c240fcff.svg",
  "resources/images/pieces/p006_f14be6ff.svg",
  "resources/images/pieces/p007_e3e3e3ff.svg",
  "resources/images/pieces/p008_ff7106ff.svg",
  "resources/images/pieces/p009_737373ff.svg",
  "resources/images/pieces/p010_ff0606ff.svg",
  "resources/images/pieces/p011_b4aaaaff.svg",
  "resources/images/pieces/p012_e1b27cff.svg",
  "resources/images/pieces/p013_e06a51ff.svg",
  "resources/images/pieces/p014_f7e764ff.svg",
  "resources/images/pieces/p015_5c5cddff.svg",
  "resources/images/pieces/p016_be1500ff.svg",
  "resources/images/pieces/p017_fdc97aff.svg",
  "resources/images/pieces/p018_eb7035ff.svg",
  "resources/images/pieces/p019_bbcd46ff.svg",
  "resources/images/pieces/p020_e9a233ff.svg",
  "resources/images/pieces/p021_f3442eff.svg",
  "resources/images/pieces/p022_a4c037ff.svg",
  "resources/images/pieces/p023_dc5443ff.svg",
  "resources/images/pieces/p024_336483ff.svg",
  "resources/images/pieces/p025_ad8a72ff.svg",
  "resources/images/pieces/p026_d75650ff.svg",
  "resources/images/pieces/p027_babac3ff.svg",
  "resources/images/pieces/p028_c5d4eaff.svg",
  "resources/images/pieces/p029_fd6c92ff.svg",
  "resources/images/pieces/p030_e49c5dff.svg",
  "resources/images/pieces/p031_00a0d7ff.svg",
  "resources/images/pieces/p032_eead46ff.svg",
  "resources/images/pieces/p033_8b59d3ff.svg",
  "resources/images/pieces/p034_8f542bff.svg",
  "resources/images/pieces/p035_40b93cff.svg",
  "resources/images/pieces/p036_ff8f23ff.svg",
  "resources/images/pieces/p037_fcfcfaff.svg",
  "resources/images/pieces/p038_5d6c7cff.svg",
  "resources/images/pieces/p039_f14be6ff.svg",
  "resources/images/pieces/p040_f9e6d2ff.svg",
  "resources/images/pieces/p041_faebaaff.svg",
  "resources/images/pieces/p042_83623bff.svg",
  "resources/images/pieces/p043_aa8967ff.svg",
  "resources/images/pieces/p044_b87cc7ff.svg",
  "resources/images/pieces/p045_f1e9d6ff.svg",
  "resources/images/sound-off.svg",
  "resources/images/sound-on.svg",
  "resources/images/spinner.svg",
  "resources/images/t001.svg",
  "resources/images/t002.svg",
  "resources/images/t003.svg",
  "resources/images/t004.svg",
  "resources/images/tie.svg",
  "resources/images/volume.svg",
  "resources/images/volume0.svg",
  "resources/sounds/combination.mp3",
  "resources/sounds/roll.mp3",
  "resources/sounds/ticTac.mp3",
  "resources/sounds/timeOver.wav",
];

// --- INSTALL: download and cache the entire app shell so the game works
// fully offline the moment install finishes. ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // We fetch individually (instead of cache.addAll) and log any
      // misses, so one missing/renamed file doesn't fail the whole install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const req = new Request(url, { cache: "reload" });
            const res = await fetch(req);
            if (res && res.ok) {
              await cache.put(url, res);
            } else {
              console.warn("[sw] skipped (bad response):", url);
            }
          } catch (err) {
            console.warn("[sw] failed to precache:", url, err);
          }
        })
      );
      // Activate this new service worker immediately instead of waiting
      // for all open tabs to close.
      await self.skipWaiting();
    })()
  );
});

// --- ACTIVATE: clean up any caches left over from older versions. ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== PRECACHE && key !== RUNTIME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// --- FETCH strategy ---
// - HTML navigations: network-first (get the latest game when online),
//   fall back to the cached shell when offline.
// - Everything else (same-origin assets + CDN fonts/confetti lib):
//   cache-first, and refresh the cache in the background (stale-while-
//   revalidate) so future loads stay current without blocking.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isNavigation =
    req.mode === "navigate" ||
    (req.destination === "document" &&
      (req.headers.get("accept") || "").includes("text/html"));

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(PRECACHE);
          cache.put("index.html", fresh.clone());
          return fresh;
        } catch (err) {
          const cache = await caches.open(PRECACHE);
          const cached = await cache.match("index.html");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const precached = await caches.match(req);
      if (precached) {
        const cache = await caches.open(RUNTIME);
        fetch(req)
          .then((res) => res && res.ok && cache.put(req, res))
          .catch(() => {});
        return precached;
      }

      const cache = await caches.open(RUNTIME);
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        const runtimeCached = await cache.match(req);
        if (runtimeCached) return runtimeCached;
        throw err;
      }
    })()
  );
});
