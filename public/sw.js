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
//    saving the result) -- anything of our own that precaching missed. The
//    fonts and the confetti library are bundled (public/fonts, public/vendor),
//    so the app loads nothing from other sites.

// Bump when sw.js's own strategy changes, or to flush stale copies. App files (see isAppShell) no
// longer depend on this to update -- they are fetched network-first -- but a
// new name evicts the stale copies older installs are holding.
const CACHE_VERSION = "linotte-v2.35.15";

const PRECACHE_URLS = [
    "/",
    "/index.html",
    "/linotte.css",
    "/a11y.js",
    "/diagnostics.js",
    "/online.css",
    "/home.css",
    "/resources/images/stats.svg",
    "/resources/images/devil-2.svg",
    "/resources/images/devil-vs-3.svg",
    "/resources/images/ranking.svg",
    "/resources/images/levelroad.svg",
    "/resources/images/chat.svg",
    "/resources/images/chat/ok.svg",
    "/resources/images/chat/hahah.svg",
    "/resources/images/chat/wow.svg",
    "/resources/images/chat/pig.svg",
    "/resources/images/chat/peach.svg",
    "/resources/images/chat/roll.svg",
    "/resources/images/chat/heart.svg",
    "/resources/images/chat/grrr.svg",
    "/resources/images/chat/mhhh.svg",
    "/resources/images/chat/pls.svg",
    "/resources/images/chat/thx.svg",
    "/resources/images/chat/hey.svg",
    "/resources/images/chat/tick.svg",
    "/resources/images/chat/ding.svg",
    "/resources/images/avatar-guest.svg",
    "/animations.css",
    "/linotte.js",
    "/version.js",
    "/online.js",
    "/push.js",
    "/botlab-client.js",
    "/auth.js",
    "/stats.js",
    "/ads.js",
    "/ads.css",
    "/levels.css",
    "/i18n.js",
    "/lang/it.js",
    "/lang/fr.js",
    "/lang/es.js",
    "/lang/pt.js",
    "/lang/zh.js",
    "/demo.js",
    "/demo.css",
    "/config.js",
    "/vendor/socket.io.esm.min.js",
    "/vendor/confetti.browser.js",
    "/fonts/fonts.css",
    "/fonts/changa-one-latin-400-normal.woff2",
    "/fonts/atkinson-hyperlegible-latin-400-normal.woff2",
    "/fonts/atkinson-hyperlegible-latin-700-normal.woff2",
    "/fonts/noto-sans-sc-900-linotte.woff2",
    "/legal/terms.html",
    "/legal/privacy.html",
    "/legal/support.html",
    "/manifest.json",

    "/shared/accounts.js",
    "/shared/assets.js",
    "/shared/botAI.js",
    "/shared/chat.js",
    "/shared/level.js",
    "/shared/demoScripts.js",
    "/shared/fairyTrail.js",
    "/shared/gameController.js",
    "/shared/gameEngine.js",
    "/shared/pieces.js",
    "/shared/playerNames.js",
    "/shared/turn.js",
    "/shared/themes.js",
    "/themes/classic/background/background.css",
    "/themes/classic/index.js",
    "/themes/classic/manifest.js",
    "/themes/core/motion.js",
    "/themes/core/theme-host.js",
    "/themes/core/background.js",
    "/themes/core/core.css",
    "/themes/core/effects.js",
    "/themes/core/piece-fx.js",
    "/themes/core/theme-core.js",
    "/themes/ice/background/background.css",
    "/themes/ice/background/index.js",
    "/themes/ice/board/board.css",
    "/themes/ice/board/index.js",
    "/themes/ice/dice/dice.css",
    "/themes/ice/index.js",
    "/themes/ice/manifest.js",
    "/themes/ice/piece/index.js",
    "/themes/ice/piece/piece.css",
    "/themes/manifests.js",
    "/themes/registry.js",
    "/themes/spring/background/background.css",
    "/themes/spring/background/index.js",
    "/themes/spring/board/board.css",
    "/themes/spring/board/index.js",
    "/themes/spring/index.js",
    "/themes/spring/manifest.js",
    "/themes/spring/piece/index.js",
    "/themes/spring/piece/piece.css",
    "/themes/storm/background/background.css",
    "/themes/storm/background/index.js",
    "/themes/storm/board/board.css",
    "/themes/storm/board/index.js",
    "/themes/storm/index.js",
    "/themes/storm/manifest.js",
    "/themes/storm/piece/index.js",
    "/shared/utils.js",


    "/resources/favicon/apple-touch-icon.png",
    "/resources/favicon/favicon-96x96.png",
    "/resources/favicon/favicon.ico",
    "/resources/favicon/favicon.svg",
    "/resources/favicon/web-app-manifest-192x192.png",
    "/resources/favicon/web-app-manifest-512x512.png",

    "/resources/images/board_n.svg",
    "/resources/images/board_p.svg",
    "/resources/images/board_t.svg",
    "/resources/images/g1.svg",
    "/resources/images/g10455.svg",
    "/resources/images/g10456.svg",
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
    "/resources/images/p105-coin.svg",
    "/resources/images/p105-pawn.svg",
    "/resources/images/t001.svg",
    "/resources/images/t002.svg",
    "/resources/images/t003.svg",
    "/resources/images/t004.svg",
    "/resources/images/tie.svg",

    "/themes/classic/background/confetti-doodles-preview.png",
    "/themes/classic/background/confetti-doodles.svg",
    "/themes/classic/background/diamond-sunset-preview.png",
    "/themes/classic/background/diamond-sunset.svg",
    "/themes/classic/background/liquid-cheese-preview.png",
    "/themes/classic/background/liquid-cheese.svg",
    "/themes/classic/background/parabolic-ellipse-preview.png",
    "/themes/classic/background/parabolic-ellipse.svg",
    "/themes/classic/background/pattern-randomized-preview.png",
    "/themes/classic/background/pattern-randomized.svg",
    "/themes/classic/background/repeating-triangles-preview.png",
    "/themes/classic/background/repeating-triangles.svg",
    "/themes/storm/background/preview.png",
    "/themes/storm/background/background.svg",
    "/themes/storm/background/far.svg",
    "/themes/storm/background/mid.svg",
    "/themes/storm/background/near.svg",
    "/themes/storm/background/glow-a.svg",
    "/themes/storm/background/glow-b.svg",
    "/themes/storm/background/bolt-a.svg",
    "/themes/storm/background/bolt-b.svg",
    "/themes/storm/background/streak.svg",
    "/themes/spring/background/background.svg",
    "/themes/spring/background/clouds-a.svg",
    "/themes/spring/background/clouds-b.svg",
    "/themes/spring/background/grass-back.svg",
    "/themes/spring/background/grass-front.svg",
    "/themes/spring/background/petal.svg",
    "/themes/spring/background/leaf.svg",
    "/themes/spring/background/preview.png",
    "/themes/ice/background/background.svg",
    "/themes/ice/background/aurora.svg",
    "/themes/ice/background/range.svg",
    "/themes/ice/background/flake.svg",
    "/themes/ice/background/glint.svg",
    "/themes/ice/background/preview.png",
    "/themes/classic/board/preview.png",
    "/themes/storm/board/preview.png",
    "/themes/storm/board/streaks.svg",
    "/themes/storm/board/drop.svg",
    "/themes/spring/board/preview.png",
    "/themes/spring/board/blooms.svg",
    "/themes/ice/board/preview.png",
    "/themes/ice/board/frame.svg",
    "/themes/ice/background/ink/g1.svg",
    "/themes/ice/background/ink/g2.svg",
    "/themes/ice/background/ink/g3.svg",
    "/themes/ice/background/ink/g4.svg",
    "/themes/ice/background/ink/g5.svg",
    "/themes/ice/background/ink/g6.svg",
    "/themes/ice/background/ink/g7.svg",
    "/themes/ice/background/ink/g8.svg",
    "/themes/spring/board/fly-butterfly-a.svg",
    "/themes/spring/board/fly-butterfly-b.svg",
    "/themes/spring/board/fly-bee.svg",
    "/themes/spring/background/ink/g1.svg",
    "/themes/spring/background/ink/g2.svg",
    "/themes/spring/background/ink/g3.svg",
    "/themes/spring/background/ink/g4.svg",
    "/themes/spring/background/ink/g5.svg",
    "/themes/spring/background/ink/g6.svg",
    "/themes/spring/background/ink/g7.svg",
    "/themes/spring/background/ink/g8.svg",
    "/themes/classic/background/subtle-prism-preview.png",
    "/themes/classic/background/subtle-prism.svg",
    "/themes/classic/background/sun-tornado-preview.png",
    "/themes/classic/background/sun-tornado.svg",
    "/themes/classic/background/tortoise-shell-preview.png",
    "/themes/classic/background/tortoise-shell.svg",

    "/themes/classic/dice/classic-preview.svg",
    "/themes/classic/dice/candy-preview.webp",
    "/themes/classic/dice/candy.webp",
    "/themes/classic/dice/chinese-preview.png",
    "/themes/classic/dice/chinese.png",
    "/themes/classic/dice/classic.svg",
    "/themes/classic/dice/flat.svg",
    "/themes/classic/dice/flat-preview.svg",
    "/themes/classic/dice/persian-preview.png",
    "/themes/classic/dice/persian.png",
    "/themes/classic/dice/red-preview.png",
    "/themes/classic/dice/red.png",
    "/themes/classic/dice/space-preview.webp",
    "/themes/classic/dice/space.webp",
    "/themes/storm/dice/preview.png",
    "/themes/storm/dice/sprite.svg",
    "/themes/spring/dice/preview.png",
    "/themes/spring/dice/sprite.svg",
    "/themes/ice/dice/preview.webp",
    "/themes/ice/dice/sprite.webp",
    "/themes/classic/dice/traditional-preview.webp",
    "/themes/classic/dice/traditional.webp",

    "/themes/classic/piece/p001_ed1c24ff.svg",
    "/themes/classic/piece/p002_40b93cff.svg",
    "/themes/classic/piece/p003_50ade5ff.svg",
    "/themes/classic/piece/p004_e9dc01ff.svg",
    "/themes/classic/piece/p005_c240fcff.svg",
    "/themes/classic/piece/p006_f14be6ff.svg",
    "/themes/classic/piece/p007_e3e3e3ff.svg",
    "/themes/classic/piece/p008_ff7106ff.svg",
    "/themes/classic/piece/p009_737373ff.svg",
    "/themes/classic/piece/p010_ff0606ff.svg",
    "/themes/classic/piece/p011_b4aaaaff.svg",
    "/themes/classic/piece/p012_e1b27cff.svg",
    "/themes/classic/piece/p013_e06a51ff.svg",
    "/themes/classic/piece/p014_f7e764ff.svg",
    "/themes/classic/piece/p015_5c5cddff.svg",
    "/themes/classic/piece/p016_be1500ff.svg",
    "/themes/classic/piece/p017_fdc97aff.svg",
    "/themes/classic/piece/p018_eb7035ff.svg",
    "/themes/classic/piece/p019_bbcd46ff.svg",
    "/themes/classic/piece/p020_e9a233ff.svg",
    "/themes/classic/piece/p021_f3442eff.svg",
    "/themes/classic/piece/p022_a4c037ff.svg",
    "/themes/classic/piece/p023_dc5443ff.svg",
    "/themes/classic/piece/p024_336483ff.svg",
    "/themes/classic/piece/p025_ad8a72ff.svg",
    "/themes/classic/piece/p026_d75650ff.svg",
    "/themes/classic/piece/p027_babac3ff.svg",
    "/themes/classic/piece/p028_c5d4eaff.svg",
    "/themes/classic/piece/p029_fd6c92ff.svg",
    "/themes/classic/piece/p030_e49c5dff.svg",
    "/themes/classic/piece/p031_00a0d7ff.svg",
    "/themes/classic/piece/p032_eead46ff.svg",
    "/themes/classic/piece/p033_8b59d3ff.svg",
    "/themes/classic/piece/p034_8f542bff.svg",
    "/themes/classic/piece/p035_40b93cff.svg",
    "/themes/classic/piece/p036_ff8f23ff.svg",
    "/themes/classic/piece/p037_fcfcfaff.svg",
    "/themes/classic/piece/p038_5d6c7cff.svg",
    "/themes/classic/piece/p039_f14be6ff.svg",
    "/themes/classic/piece/p040_f9e6d2ff.svg",
    "/themes/classic/piece/p041_faebaaff.svg",
    "/themes/classic/piece/p042_83623bff.svg",
    "/themes/classic/piece/p043_aa8967ff.svg",
    "/themes/classic/piece/p044_b87cc7ff.svg",
    "/themes/classic/piece/p045_f1e9d6ff.svg",
    "/themes/storm/piece/p046_3d6df0ff.svg",
    "/themes/spring/piece/p047_e63946ff.svg",
    "/themes/ice/piece/p048_1b1d26ff.svg",
    "/themes/spring/piece/ladybug-lids.svg",
    "/themes/ice/piece/penguin-body.svg",
    "/themes/ice/piece/penguin-flipper-l.svg",
    "/themes/ice/piece/penguin-flipper-r.svg",
    "/themes/storm/piece/umbrella-canopy.svg",
    "/themes/storm/piece/umbrella-shine.svg",

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

    // Live game traffic (socket.io long-polling, same- or cross-origin) and
    // invite links must always hit the network -- a cached poll response
    // would feed the game stale or someone else's messages.
    if (url.pathname.startsWith("/socket.io/") || url.pathname.startsWith("/j/") || url.pathname === "/healthz") return;

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

    // Our own art and sounds: stale-while-revalidate -- served instantly from
    // the cache (works offline), and refreshed from the network in the
    // background so a file replaced under the same URL (the app icons were)
    // shows up on the next open instead of being pinned to the old copy.
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                const refresh = fetch(event.request)
                    .then((response) => {
                        putInCache(event.request, response);
                        return response;
                    })
                    .catch(() => undefined);
                return cached || refresh;
            })
        );
        return;
    }

    // Other sites (the sign-in service, the game server's API): live data,
    // never cached -- a copy would freeze it.
});
