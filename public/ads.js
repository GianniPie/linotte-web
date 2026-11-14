//----------- ADS ---------------
// Every ad goes through here, so the real networks (AdMob in the store apps,
// a web network on the site) can replace these stand-ins without touching
// the game:
//   renderBanner(el)  a banner: the home's (adaptive, ~60px) and the game's
//                     (50px, portrait)
//   interstitial()    a full-screen video at a natural break (the end of a
//                     game), skippable after a few seconds; resolves when gone
//   rewarded(msg)     a full-screen video watched for a reward (a rewarded ad
//                     the player chose, or the points of a finished game);
//                     resolves true only if watched to the end. msg is what
//                     closing it early is said to cost
// Until a network is connected these are sample ads, clearly labelled, from
// made-up advertisers. Pro players see none: the callers check (linotte.js).

import { t } from "./i18n.js";

// Made-up advertisers: nothing here is a real brand.
const SAMPLES = [
    { name: "Fizzbee", line: "Sparkling lemonade, zero sugar", icon: "🍋", from: "#ffd84d", to: "#2fa7e0", ink: "#0d3b66" },
    { name: "Mossy Mountains", line: "A cosy puzzle adventure", icon: "🏔️", from: "#7ed6a5", to: "#2e6b4f", ink: "#ffffff" },
    { name: "Cloudsock", line: "The softest socks on Earth", icon: "🧦", from: "#f7b2d9", to: "#7b6cf6", ink: "#ffffff" },
];
const pick = () => SAMPLES[Math.floor(Math.random() * SAMPLES.length)];

//--------- banner ---------
export function renderBanner(el, onRemoveAds) {
    const show = () => {
        const ad = pick();
        el.replaceChildren();
        el.style.setProperty("--ad-from", ad.from);
        el.style.setProperty("--ad-to", ad.to);
        const icon = Object.assign(document.createElement("span"), { className: "ad-banner-icon", textContent: ad.icon });
        const text = document.createElement("span");
        text.className = "ad-banner-text";
        text.append(Object.assign(document.createElement("b"), { textContent: ad.name }), " ", ad.line);
        const label = Object.assign(document.createElement("span"), { className: "ad-label", textContent: t("Ad") });
        const cta = Object.assign(document.createElement("span"), { className: "ad-banner-cta", textContent: t("OPEN") });
        const remove = Object.assign(document.createElement("button"), { className: "ad-remove", type: "button", textContent: "✕" });
        remove.setAttribute("aria-label", t("Remove ads"));
        remove.addEventListener("click", (e) => { e.stopPropagation(); onRemoveAds?.(); });
        el.append(icon, text, cta, label, remove);
    };
    show();
    clearInterval(el.adTimer);
    el.adTimer = setInterval(show, 30000); // a new ad every 30s, like a real banner
}

//--------- full-screen video ---------
// One stand-in video: the advertiser's colours, its icon bouncing, its name
// and line, a progress bar, the seconds left, and SKIP (an interstitial,
// after SKIP_AFTER seconds) or the reward countdown (a rewarded video).
const VIDEO_SECONDS = 15;
const SKIP_AFTER = 5;

function playVideo({ rewarded, closeMessage }) {
    return new Promise((resolve) => {
        const ad = pick();
        const box = document.createElement("div");
        box.className = "ad-video";
        box.style.setProperty("--ad-from", ad.from);
        box.style.setProperty("--ad-to", ad.to);
        box.style.setProperty("--ad-ink", ad.ink);
        box.style.setProperty("--ad-seconds", `${VIDEO_SECONDS}s`);
        box.innerHTML = `
            <div class="ad-video-stage">
                <div class="ad-video-icon"></div>
                <div class="ad-video-name"></div>
                <div class="ad-video-line"></div>
                <button class="ad-video-cta" type="button"></button>
            </div>
            <div class="ad-video-top">
                <span class="ad-label"></span>
                <span class="ad-video-time"></span>
                <button class="ad-video-close" type="button"></button>
            </div>
            <div class="ad-video-bar"><div></div></div>
            <div class="ad-video-confirm" hidden>
                <div class="ad-video-confirm-box">
                    <p></p>
                    <button class="ad-keep" type="button"></button>
                    <button class="ad-quit" type="button"></button>
                </div>
            </div>`;
        const $ = (s) => box.querySelector(s);
        $(".ad-video-icon").textContent = ad.icon;
        $(".ad-video-name").textContent = ad.name;
        $(".ad-video-line").textContent = ad.line;
        $(".ad-video-cta").textContent = t("Learn more");
        $(".ad-label").textContent = t("Sample ad");
        $(".ad-video-confirm p").textContent = closeMessage || t("Close the video? You won't get the point.");
        $(".ad-keep").textContent = t("KEEP WATCHING");
        $(".ad-quit").textContent = t("CLOSE");
        document.body.appendChild(box);

        const started = performance.now();
        let paused = 0, pausedAt = 0, done = false;
        const elapsed = () => ((pausedAt || performance.now()) - started - paused) / 1000;
        const close = $(".ad-video-close");
        const time = $(".ad-video-time");
        const finish = (completed) => {
            if (done) return;
            done = true;
            clearInterval(clock);
            box.classList.add("is-leaving");
            setTimeout(() => box.remove(), 250);
            resolve(completed);
        };
        const tick = () => {
            const left = Math.max(0, Math.ceil(VIDEO_SECONDS - elapsed()));
            if (rewarded) {
                time.textContent = left > 0 ? t("Reward in {n}s", { n: left }) : t("Reward earned");
                close.textContent = "✕";
                close.classList.toggle("is-ready", left === 0);
            } else {
                time.textContent = `0:${String(left).padStart(2, "0")}`;
                const skipIn = Math.ceil(SKIP_AFTER - elapsed());
                close.textContent = skipIn > 0 ? t("Skip in {n}", { n: skipIn }) : t("SKIP ›");
                close.classList.toggle("is-ready", skipIn <= 0);
            }
            if (left === 0 && rewarded) close.classList.add("is-ready");
            if (left === 0 && !rewarded) finish(true);
        };
        const clock = setInterval(tick, 250);
        tick();

        close.addEventListener("click", () => {
            const left = VIDEO_SECONDS - elapsed();
            if (!rewarded) { if (elapsed() >= SKIP_AFTER) finish(false); return; }
            if (left <= 0) return finish(true);
            // Leaving a rewarded video early: ask, with the video paused.
            pausedAt = performance.now();
            box.classList.add("is-paused");
            $(".ad-video-confirm").hidden = false;
        });
        $(".ad-keep").addEventListener("click", () => {
            paused += performance.now() - pausedAt;
            pausedAt = 0;
            box.classList.remove("is-paused");
            $(".ad-video-confirm").hidden = true;
        });
        $(".ad-quit").addEventListener("click", () => finish(false));
        $(".ad-video-cta").addEventListener("click", () => {
            const note = Object.assign(document.createElement("div"), { className: "ad-video-note", textContent: t("This is a sample ad.") });
            box.appendChild(note);
            setTimeout(() => note.remove(), 1800);
        });
    });
}

export function interstitial() {
    return playVideo({ rewarded: false });
}

export function rewarded(closeMessage) {
    return playVideo({ rewarded: true, closeMessage });
}
