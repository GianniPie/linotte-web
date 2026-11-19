//----------- PROBLEM REPORTS FROM PLAYERS ---------------
// The "Report a problem" form in the app: a few words and, if the player wants, a screenshot. What the player
// never has to see or fill in goes with it: who they are, their device and the app's version, the game they
// were in (the app's own view of it, and for an online game the server's), and the last errors the page
// logged. It is kept in Supabase's feedback table (supabase/feedback.sql), so nothing is lost, and sent by
// e-mail to the project's own address through Resend (https://resend.com): set RESEND_API_KEY on Render
// (the Resend account is the one made with that address, which until a domain is verified is also the only
// address Resend lets the test sender write to). Without the key it is only kept (and logged).

import { SUPABASE_URL } from "../public/shared/accounts.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
export const FEEDBACK_TO = process.env.FEEDBACK_TO || "linotte.cloud@gmail.com";
const FEEDBACK_FROM = process.env.FEEDBACK_FROM || "Linotte <onboarding@resend.dev>";

export const MAX_MESSAGE = 3000;
export const MAX_SCREENSHOT_BYTES = 1_500_000;
const MAX_DETAILS_CHARS = 60_000;

// A few an hour per account (or address): a reader's time can't be spent by a script.
export function createFeedbackBudget({ perHour = 5, now = Date.now } = {}) {
  const sent = new Map();
  return {
    take(key) {
      const t = now(), recent = (sent.get(key) || []).filter((x) => t - x < 3600_000);
      if (recent.length >= perHour) { sent.set(key, recent); return false; }
      recent.push(t);
      sent.set(key, recent);
      return true;
    },
  };
}

// A screenshot arrives as a data URL; only a real PNG, JPEG or WebP of a sensible size is kept.
const MAGIC = [
  ["image/png", "png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/jpeg", "jpg", [0xff, 0xd8, 0xff]],
  ["image/webp", "webp", [0x52, 0x49, 0x46, 0x46]],
];
export function parseScreenshot(dataUrl) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const buffer = Buffer.from(m[2], "base64");
  if (!buffer.length || buffer.length > MAX_SCREENSHOT_BYTES) return null;
  const kind = MAGIC.find(([mime, , bytes]) => mime === m[1] && bytes.every((b, i) => buffer[i] === b));
  return kind ? { mime: kind[0], ext: kind[1], buffer } : null;
}

const clip = (v, n) => String(v ?? "").slice(0, n);
const line = (label, value) => (value === undefined || value === null || value === "" ? "" : `${label}: ${value}\n`);

// What to write in the mail: the message first, then the sections a reader looks at in turn.
export function buildReport({ kind = "problem", message, client = {}, account = {}, replyTo = "", serverGame = null, ip = "", screenshot = null, version = "" }) {
  const g = client.game || {};
  const text =
    `${message}\n\n` +
    `----- Who -----\n` +
    line("Account", account.userId ? `${account.name || "?"} (${account.userId})` : "guest") +
    line("E-mail", account.email) + (replyTo && replyTo !== account.email ? line("E-mail to answer", replyTo) : "") + line("Role", account.role) + line("Level", account.level !== undefined ? `${account.level} (${account.xp} points)` : "") +
    line("Country", account.country) + line("Language", client.language) + line("Device id", client.playerId) +
    `\n----- App and device -----\n` +
    line("App version", version) + line("Where", `${client.host || ""}${client.native ? " (native app)" : client.standalone ? " (installed)" : ""}`) +
    line("Device", client.userAgent) + line("Screen", `${client.screen || ""}, window ${client.viewport || ""}, pixel ratio ${client.pixelRatio || ""}`) +
    line("Online", client.online) + line("Connection", client.connection) + line("Game server connected", client.serverConnected) + line("Address", ip) +
    line("Time", client.time) +
    `\n----- Game -----\n` +
    (g.mode ? line("Mode", `${g.mode}${g.strategy ? ` (${g.strategy})` : ""}`) + line("In progress", g.inProgress) + line("Over", g.over) +
      line("Turn of", g.currentPlayer) + line("Points", g.points) + line("Pieces left", g.piecesLeft) + line("Turns played", g.turns) : "No game open.\n") +
    (serverGame ? `\n----- The server's view of the online game -----\n` + line("Room", serverGame.roomId) + line("Kind", serverGame.kind) + line("Status", serverGame.status) +
      line("Seats", (serverGame.seats || []).map((s) => `${s.seat}: ${s.name} (${s.kind}${s.userId ? `, ${s.userId}` : ""}, ${s.connected ? "connected" : "away"})`).join("; ")) +
      line("Turn of", serverGame.currentPlayer) + line("Points", serverGame.points) + line("Idle turns", serverGame.idleTurns) : "") +
    (client.errors?.length ? `\n----- Latest errors on the page -----\n${client.errors.map((e) => `- ${clip(e, 400)}`).join("\n")}\n` : "");

  const details = JSON.stringify({ client, account, serverGame, version }, null, 2).slice(0, MAX_DETAILS_CHARS);
  const subject = `[Linotte ${kind === "contact" ? "contact" : "problem"}] ${account.name ? account.name : "guest"} · v${version} · ${clip(message.replace(/\s+/g, " "), 60)}`;
  const attachments = [{ filename: "details.json", content: Buffer.from(details).toString("base64") }];
  if (screenshot) attachments.push({ filename: `screenshot.${screenshot.ext}`, content: screenshot.buffer.toString("base64") });
  return { subject, text, details, attachments };
}

// The account's e-mail address (to reply to), asked to Supabase with the secret key. null when it can't be had.
export async function emailOf(userId, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  if (!userId || !key || !url) return null;
  try {
    const res = await fetchImpl(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.email === "string" && user.email ? user.email : null;
  } catch {
    return null;
  }
}

async function keep(row, { key, url, fetch: fetchImpl }) {
  const res = await fetchImpl(`${url}/rest/v1/feedback`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
}

async function mail(report, replyTo, { resendKey, fetch: fetchImpl }) {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FEEDBACK_FROM, to: [FEEDBACK_TO], subject: report.subject, text: report.text,
      ...(replyTo ? { reply_to: replyTo } : {}), attachments: report.attachments,
    }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status} ${await res.text().catch(() => "")}`.trim());
}

// Keeps and sends one report. Never throws; { ok } is true when it was kept or sent somewhere.
export async function sendFeedback(report, { userId = null, kind = "problem", message = "", replyTo = null, screenshot = null } = {}, {
  key = SECRET_KEY, url = SUPABASE_URL, resendKey = RESEND_KEY, fetch: fetchImpl = fetch,
} = {}) {
  let kept = false, mailed = false;
  if (key && url) {
    try {
      await keep({ user_id: userId, kind, message: clip(message, MAX_MESSAGE), details: JSON.parse(report.details || "{}"), screenshot: screenshot ? `data:${screenshot.mime};base64,${screenshot.buffer.toString("base64")}` : null }, { key, url, fetch: fetchImpl });
      kept = true;
    } catch (err) {
      console.error("feedback not kept:", err.message);
    }
  }
  if (resendKey) {
    try {
      await mail(report, replyTo, { resendKey, fetch: fetchImpl });
      mailed = true;
    } catch (err) {
      console.error("feedback not mailed:", err.message);
    }
  }
  if (!kept && !mailed && !key && !resendKey) {
    console.log("feedback (nowhere to send it):", report.subject, "\n", report.text); // a local run
    return { ok: true, kept, mailed };
  }
  return { ok: kept || mailed, kept, mailed };
}
