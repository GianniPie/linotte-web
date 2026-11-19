//----------- ACCESSIBILITY ---------------
// The game's buttons are mostly <div class="button">: fine to a finger, invisible to a screen reader and
// out of reach of a keyboard. Instead of turning every one into a <button> (each has its own look and
// handlers), this gives them what a button has: a role, a place in the tab order, Enter and Space, a name,
// and (for the ones that are on or off) the state. It runs once the page is there and again for whatever
// is added later (the lists of the ranking and the friends are built by the app).

import { t } from "./i18n.js";
import { diceNames } from "./shared/assets.js";

// What is a button without being a <button>.
const BUTTON_LIKE = ".button, .winner-button, .icon, .options, .car-item-content, .chat-fab, .home-ad, [data-sheet-close]";
const NATIVE = "button, a[href], input, select, textarea, summary";

// Names for the buttons that only have a picture.
const NAMES = {
  "#options": () => t("Options"),
  "#icon-back": () => t("BACK"),
  "#icon-tab1": () => t("Game"),
  "#icon-tab2": () => t("Options"),
  "#icon-tab3": () => t("How to play"),
  "#chat-fab": () => t("Reactions"),
  ".car-button.previous": () => t("Previous"),
  ".car-button.next": () => t("Next"),
};

function nameOf(el) {
  for (const [selector, label] of Object.entries(NAMES)) if (el.matches(selector)) return label();
  const dice = el.matches(".die-options") ? Number(el.id.slice(2)) : -1;
  if (dice >= 0 && diceNames[dice]) return t(diceNames[dice]);
  if (el.matches(".bg-options")) return `${t("Background")} ${Number(el.id.slice(2)) + 1}`;
  return "";
}

function enhance(root = document) {
  root.querySelectorAll(BUTTON_LIKE).forEach((el) => {
    if (el.matches(NATIVE)) return;
    if (!el.hasAttribute("role")) el.setAttribute("role", "button");
    if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
  });
  // Pictures that are only decoration.
  root.querySelectorAll("img:not([alt])").forEach((img) => img.setAttribute("alt", ""));
  // Names.
  root.querySelectorAll([...Object.keys(NAMES), ".die-options", ".bg-options"].join(",")).forEach((el) => {
    if (el.hasAttribute("aria-label") && !el.dataset.a11yName) return; // the page's own name stays
    const name = nameOf(el);
    if (name) { el.setAttribute("aria-label", name); el.dataset.a11yName = "1"; }
  });
  syncStates(root);
}

// On or off, and not usable: from the classes the app already toggles.
function syncStates(root = document) {
  root.querySelectorAll(".die-options, .bg-options, .lb-tab, .opt-btn").forEach((el) => {
    el.setAttribute("aria-pressed", String(el.classList.contains("selected") || el.classList.contains("is-on")));
  });
  root.querySelectorAll(".button, .die-options, .bg-options").forEach((el) => {
    const off = el.classList.contains("is-inactive") || el.classList.contains("is-level-locked");
    if (off) el.setAttribute("aria-disabled", "true"); else el.removeAttribute("aria-disabled");
  });
}

// Enter and Space press what is focused, as they do a <button>.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target;
  if (!(el instanceof HTMLElement) || el.matches(NATIVE) || el.getAttribute("role") !== "button") return;
  e.preventDefault();
  el.click();
});

function start() {
  enhance();
  let queued = false;
  const again = () => { // one pass after a burst of changes
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; enhance(); });
  };
  new MutationObserver(again).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
