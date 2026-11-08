//----------- LANGUAGES ---------------
// Linotte speaks English, Italian, French, Spanish, Portuguese (Brazil) and
// Chinese (Simplified). The English text itself is the key: public/lang/xx.js
// maps each English sentence to its translation, and anything missing simply
// stays in English. Only the player's own language file is loaded.
//
// The page marks what to translate: data-i18n (the element's text) and
// data-i18n-html (its markup: links and bold kept, translated as a whole).
// aria-labels are translated whenever the dictionary knows them. The script
// uses t("English text", { name: ... }) with {name} placeholders.
//
// The language is the phone's (when it's one of these, else English) unless
// the player picked one in the options.

// In the options, in alphabetical order of their own names.
export const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "it", name: "Italiano" },
    { code: "pt", name: "Português" },
    { code: "zh", name: "中文" },
];
const SUPPORTED = LANGUAGES.map((l) => l.code);
const KEY = "linotte-lang";

function chooseLanguage() {
    try {
        const saved = localStorage.getItem(KEY);
        if (SUPPORTED.includes(saved)) return saved;
    } catch { /* storage off */ }
    for (const tag of navigator.languages || [navigator.language || "en"]) {
        const base = String(tag).slice(0, 2).toLowerCase();
        if (SUPPORTED.includes(base)) return base;
    }
    return "en";
}

export const LANG = chooseLanguage();

// Loaded before the game's script runs (this module is imported first and
// waits for it). A file that fails to load leaves the game in English.
let DICT = {};
if (LANG !== "en") {
    try {
        DICT = (await import(`./lang/${LANG}.js`)).default;
    } catch (err) {
        console.error("language not loaded:", err.message);
    }
}

const squash = (text) => String(text).replace(/\s+/g, " ").trim();

// The text in the player's language, with {placeholders} filled in.
export function t(english, vars = {}) {
    const key = squash(english);
    const text = DICT[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all));
}

// Picked in the options: remembered, and the page reloads in that language.
// The options page asks to be opened again where it was (see reopenAfterReload
// in linotte.js), so the player stays on it.
export function setLanguage(code, { reopen = null } = {}) {
    if (!SUPPORTED.includes(code) || code === LANG) return;
    try {
        localStorage.setItem(KEY, code);
        if (reopen) sessionStorage.setItem("linotte-reopen", JSON.stringify(reopen));
    } catch { /* storage off: this visit only */ }
    location.reload();
}

export function translatePage(root = document) {
    document.documentElement.lang = LANG;
    if (LANG === "en") return;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = squash(el.textContent);
        if (DICT[key]) el.textContent = DICT[key];
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
        const key = squash(el.innerHTML);
        if (DICT[key]) el.innerHTML = DICT[key];
    });
    root.querySelectorAll("[aria-label]").forEach((el) => {
        const key = squash(el.getAttribute("aria-label"));
        if (DICT[key]) el.setAttribute("aria-label", DICT[key]);
    });
}

// Runs as soon as this module loads (before the game's own script), so the
// page is in the right language before anything else reads or fills it.
translatePage();

// Chinese headings use their own font file (see fonts/fonts.css), which the
// browser would only fetch on the first Chinese character drawn, showing
// the phone's font for a moment: start it now.
if (LANG === "zh") document.fonts?.load('1em "Changa One"', "中文").catch(() => {});
