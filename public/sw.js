// Linotte service worker -- makes the game playable fully offline once it's
// been opened online at least once. Previously this file only registered
// itself and had no install/fetch logic at all, so nothing was ever
// actually cached.
//
// Two layers:
// 1. PRECACHE_URLS is fetched and stored up front on install -- the app
//    shell plus every piece/background/dice/sound asset, so a fresh
//    offline load already has everything the game can randomly pick from
//    (pieces, backgrounds and dice are all chosen from pools at runtime --
//    see shared/assets.js -- not just whichever ones happened to render on
//    a given visit).
// 2. The fetch handler below also opportunistically caches anything else
//    requested as it's requested (cache-first, falling back to network and
//    saving the result) -- this is what covers the Google Fonts CSS +
//    woff2 files (the "text" -- the app's one custom font, Changa One, is
//    loaded from fonts.googleapis.com/fonts.gstatic.com, not bundled), and
//    anything precaching missed.

// Bump when sw.js's own strategy changes. App files (see isAppShell) no
// longer depend on this to update -- they are fetched network-first -- but a
// new name evicts the stale copies older installs are holding.
const CACHE_VERSION = "linotte-v2";

const PRECACHE_URLS = [
    "/",
    "/index.html",
    "/linotte.css",
    "/animations.css",
    "/linotte.js",
    "/manifest.json",

    "/shared/assets.js",
    "/shared/botAI.js",
    "/shared/fairyTrail.js",
    "/shared/gameController.js",
    "/shared/gameEngine.js",
    "/shared/utils.js",

    "/resources/confetti.js",

    "/resources/favicon/apple-touch-icon.png",
    "/resources/favicon/favicon-96x96.png",
    "/resources/favicon/favicon.ico",
    "/resources/favicon/favicon.svg",
    "/resources/favicon/web-app-manifest-192x192.png",
    "/resources/favicon/web-app-manifest-512x512.png",

    "/resources/images/arl.svg",
    "/resources/images/arr.svg",
    "/resources/images/board_n.svg",
    "/resources/images/board_p.svg",
    "/resources/images/board_t.svg",
    "/resources/images/g1.svg",
    "/resources/images/g10455.svg",
    "/resources/images/g10456.svg",
    "/resources/images/g10457.svg",
    "/resources/images/g10481.svg",
    "/resources/images/g10482.svg",
    "/resources/images/g10483.svg",
    "/resources/images/g10484.svg",
    "/resources/images/g10485.svg",
    "/resources/images/g10486.svg",
    "/resources/images/g10491.svg",
    "/resources/images/g10492.svg",
    "/resources/images/g10493.svg",
    "/resources/images/g10495.svg",
    "/resources/images/g10496.svg",
    "/resources/images/g10497.svg",
    "/resources/images/g10498.svg",
    "/resources/images/g2.svg",
    "/resources/images/g3.svg",
    "/resources/images/g4.svg",
    "/resources/images/g5.svg",
    "/resources/images/g6.svg",
    "/resources/images/g7.svg",
    "/resources/images/g8.svg",
    "/resources/images/p018_fdc5a3ff.svg",
    "/resources/images/p104-coin.svg",
    "/resources/images/p104-pawn.svg",
    "/resources/images/p105-coin.svg",
    "/resources/images/p105-pawn.svg",
    "/resources/images/path11856-3-0.svg",
    "/resources/images/sound-off.svg",
    "/resources/images/sound-on.svg",
    "/resources/images/spinner.svg",
    "/resources/images/t001.svg",
    "/resources/images/t002.svg",
    "/resources/images/t003.svg",
    "/resources/images/t004.svg",
    "/resources/images/tie.svg",

    "/resources/images/backgrounds/confetti-doodles-prev.png",
    "/resources/images/backgrounds/confetti-doodles.svg",
    "/resources/images/backgrounds/diamond-sunset-prev.png",
    "/resources/images/backgrounds/diamond-sunset.svg",
    "/resources/images/backgrounds/liquid-cheese-prev.png",
    "/resources/images/backgrounds/liquid-cheese.svg",
    "/resources/images/backgrounds/parabolic-ellipse-prev.png",
    "/resources/images/backgrounds/parabolic-ellipse.svg",
    "/resources/images/backgrounds/pattern-randomized-prev.png",
    "/resources/images/backgrounds/pattern-randomized.svg",
    "/resources/images/backgrounds/repeating-triangles-prev.png",
    "/resources/images/backgrounds/repeating-triangles.svg",
    "/resources/images/backgrounds/subtle-prism-prev.png",
    "/resources/images/backgrounds/subtle-prism.svg",
    "/resources/images/backgrounds/subtle-prism2.svg",
    "/resources/images/backgrounds/sun-tornado-prev.png",
    "/resources/images/backgrounds/sun-tornado.svg",
    "/resources/images/backgrounds/tortoise-shell-prev.png",
    "/resources/images/backgrounds/tortoise-shell.svg",
    "/resources/images/backgrounds/varying-stripes-prev.png",
    "/resources/images/backgrounds/varying-stripes.svg",

    "/resources/images/dice/c101.svg",
    "/resources/images/dice/ch001.png",
    "/resources/images/dice/chinese_sprite.png",
    "/resources/images/dice/classic_sprite.svg",
    "/resources/images/dice/flat_sprite.svg",
    "/resources/images/dice/g107.svg",
    "/resources/images/dice/pe001.png",
    "/resources/images/dice/persian_sprite.png",
    "/resources/images/dice/red1.png",
    "/resources/images/dice/red_sprite.png",
    "/resources/images/dice/tr101.png",
    "/resources/images/dice/traditional_sprite.png",

    "/resources/images/pieces/p001_ed1c24ff.svg",
    "/resources/images/pieces/p002_40b93cff.svg",
    "/resources/images/pieces/p003_50ade5ff.svg",
    "/resources/images/pieces/p004_e9dc01ff.svg",
    "/resources/images/pieces/p005_c240fcff.svg",
    "/resources/images/pieces/p006_f14be6ff.svg",
    "/resources/images/pieces/p007_e3e3e3ff.svg",
    "/resources/images/pieces/p008_ff7106ff.svg",
    "/resources/images/pieces/p009_737373ff.svg",
    "/resources/images/pieces/p010_ff0606ff.svg",
    "/resources/images/pieces/p011_b4aaaaff.svg",
    "/resources/images/pieces/p012_e1b27cff.svg",
    "/resources/images/pieces/p013_e06a51ff.svg",
    "/resources/images/pieces/p014_f7e764ff.svg",
    "/resources/images/pieces/p015_5c5cddff.svg",
    "/resources/images/pieces/p016_be1500ff.svg",
    "/resources/images/pieces/p017_fdc97aff.svg",
    "/resources/images/pieces/p018_eb7035ff.svg",
    "/resources/images/pieces/p019_bbcd46ff.svg",
    "/resources/images/pieces/p020_e9a233ff.svg",
    "/resources/images/pieces/p021_f3442eff.svg",
    "/resources/images/pieces/p022_a4c037ff.svg",
    "/resources/images/pieces/p023_dc5443ff.svg",
    "/resources/images/pieces/p024_336483ff.svg",
    "/resources/images/pieces/p025_ad8a72ff.svg",
    "/resources/images/pieces/p026_d75650ff.svg",
    "/resources/images/pieces/p027_babac3ff.svg",
    "/resources/images/pieces/p028_c5d4eaff.svg",
    "/resources/images/pieces/p029_fd6c92ff.svg",
    "/resources/images/pieces/p030_e49c5dff.svg",
    "/resources/images/pieces/p031_00a0d7ff.svg",
    "/resources/images/pieces/p032_eead46ff.svg",
    "/resources/images/pieces/p033_8b59d3ff.svg",
    "/resources/images/pieces/p034_8f542bff.svg",
    "/resources/images/pieces/p035_40b93cff.svg",
    "/resources/images/pieces/p036_ff8f23ff.svg",
    "/resources/images/pieces/p037_fcfcfaff.svg",
    "/resources/images/pieces/p038_5d6c7cff.svg",
    "/resources/images/pieces/p039_f14be6ff.svg",
    "/resources/images/pieces/p040_f9e6d2ff.svg",
    "/resources/images/pieces/p041_faebaaff.svg",
    "/resources/images/pieces/p042_83623bff.svg",
    "/resources/images/pieces/p043_aa8967ff.svg",
    "/resources/images/pieces/p044_b87cc7ff.svg",
    "/resources/images/pieces/p045_f1e9d6ff.svg",

    "/resources/sounds/combination.mp3",
    "/resources/sounds/roll.mp3",
    "/resources/sounds/ticTac.mp3",
    "/resources/sounds/timeOver.wav",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) =>
            // allSettled, not addAll: addAll aborts the ENTIRE precache if
            // even one of 130+ requests 404s -- one missing/renamed file
            // would otherwise silently leave the whole app uncached.
            Promise.allSettled(
                PRECACHE_URLS.map((url) =>
                    cache.add(url).catch((err) => console.warn("[sw] precache failed:", url, err))
                )
            )
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// HTML/CSS/JS/manifest: network-first, so a deploy reaches users on their next
// online visit instead of being hidden behind a cache-first copy forever;
// the cached copy is only the offline fallback.
function isAppShell(url) {
    if (url.origin !== self.location.origin) return false;
    return url.pathname === "/" || /\.(html|css|js|json)$/.test(url.pathname);
}

function putInCache(request, response) {
    // Only cache real, complete responses; "opaque" cross-origin ones
    // (status 0) can't be inspected but are still usable offline later.
    if (response && (response.status === 200 || response.type === "opaque")) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
    }
}

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);

    if (isAppShell(url)) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    putInCache(event.request, response);
                    return response;
                })
                .catch(() =>
                    caches.match(event.request).then((cached) => {
                        if (cached) return cached;
                        if (event.request.mode === "navigate") return caches.match("/index.html");
                        return undefined;
                    })
                )
        );
        return;
    }

    // Art, sounds, fonts and other CDN files never change under the same URL:
    // cache-first, filling the cache with anything precaching missed (this is
    // also what stores the Google Fonts CSS + woff2, whose exact URLs Google
    // generates and can change).
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request)
                .then((response) => {
                    putInCache(event.request, response);
                    return response;
                })
                .catch(() => undefined);
        })
    );
});
