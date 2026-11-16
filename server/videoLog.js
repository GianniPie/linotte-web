//----------- WHAT BECAME OF THE POINTS VIDEOS ---------------
// A signed-in player who isn't Pro watches a video after an online game and only then do
// the game's points count (Lobby#heldSeats, claimPoints, skipPoints). When those points
// don't arrive, this tells why: for every video, in order, what happened and when
//   shown            the game ended and its points wait for the video
//   watched          the app claimed them (after ms, the time since the video was shown)
//   closed           the app said the video was closed: no points
//   claim_failed     the app claimed them and the database refused
//   nothing_waiting  a claim arrived with nothing waiting (late, or the server restarted)
//   skip_nothing_waiting  the same for a "closed"
//   no_answer        the next game's video was shown with this one never answered
// It goes to the server's log, and to the video_events table when there is one
// (supabase/video_events.sql). Never throws, never waits for anyone.

import { SUPABASE_URL } from "../public/shared/accounts.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
let lastWarning = 0;

export async function logVideo(userId, event, { ms = null } = {}, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  if (!userId) return false;
  console.log(`points video: ${event}${ms !== null ? ` after ${(ms / 1000).toFixed(1)} s` : ""}, account ${String(userId).slice(0, 8)}`);
  if (!key || !url) return false;
  try {
    const res = await fetchImpl(`${url}/rest/v1/video_events`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, event, ms: ms === null ? null : Math.round(ms) }),
    });
    if (!res.ok && Date.now() - lastWarning > 10 * 60 * 1000) {
      lastWarning = Date.now();
      console.error("points video not logged: Supabase answered", res.status, "(is supabase/video_events.sql run?)");
    }
    return res.ok;
  } catch (err) {
    if (Date.now() - lastWarning > 10 * 60 * 1000) { lastWarning = Date.now(); console.error("points video not logged:", err.message); }
    return false;
  }
}
