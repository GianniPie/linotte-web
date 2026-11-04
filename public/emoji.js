//----------- CHAT EMOJI ---------------
// Linotte's own drawings of the nine chat emoji (they replace Twemoji: no
// licence to credit, nothing fetched from the network, and the same flat
// colour + solid outline look as the coin and the buttons). Keyed by the
// emoji character itself, which is also what travels over the network
// (EMOTES in server/config.js), so the online chat doesn't change.

const FACE = "#E8B923"; // the coin's / chat button's gold
const FACE_LINE = "#8A6708";
const INK = "#3A2508";
const SKIN = "#F2C29B";
const SKIN_LINE = "#A8673A";

const face = (fill = FACE, line = FACE_LINE) =>
    `<circle cx="32" cy="32" r="27" fill="${fill}" stroke="${line}" stroke-width="4"/>`;

const svg = (body) =>
    `<svg class="emoji" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const EMOJI = {
    "🎲": {
        label: "Dice",
        svg: svg(`<g transform="rotate(-12 32 32)">
            <rect x="9" y="9" width="46" height="46" rx="11" fill="#fff" stroke="${INK}" stroke-width="4"/>
            <g fill="${INK}"><circle cx="21" cy="21" r="4.3"/><circle cx="43" cy="21" r="4.3"/><circle cx="32" cy="32" r="4.3"/><circle cx="21" cy="43" r="4.3"/><circle cx="43" cy="43" r="4.3"/></g>
        </g>`),
    },
    "❤️": {
        label: "Heart",
        svg: svg(`<path d="M32 55C13 42 6 30 12 19c5-9 16-9 20 0 4-9 15-9 20 0 6 11-1 23-20 36z" fill="#E8402A" stroke="#A3261A" stroke-width="4"/>
            <path d="M17 22c1-4 4-6 8-6" stroke="#fff" stroke-opacity=".65" stroke-width="3.5"/>`),
    },
    "😮": {
        label: "Wow",
        svg: svg(`${face()}
            <path d="M16 19c3-3 7-4 11-3M48 19c-3-3-7-4-11-3" stroke="${INK}" stroke-width="3.5"/>
            <g fill="${INK}"><ellipse cx="23" cy="28" rx="3.6" ry="5"/><ellipse cx="41" cy="28" rx="3.6" ry="5"/><ellipse cx="32" cy="45" rx="6" ry="7.5"/></g>`),
    },
    "🤣": {
        label: "Laughing",
        svg: svg(`<g transform="rotate(-18 32 32)">${face()}
            <path d="M17 23l8 4-8 4M47 23l-8 4 8 4" stroke="${INK}" stroke-width="3.5"/>
            <path d="M16 36h32c0 9-7 15-16 15s-16-6-16-15z" fill="${INK}"/>
            <path d="M24 47c4-4 12-4 16 0-4 3-12 3-16 0z" fill="#E8505B"/>
        </g>
        <g fill="#5BC0EB" stroke="#2F7FA8" stroke-width="2"><path d="M7 38c-3 4-3 8 1 9s5-4 1-9l-1-2z"/><path d="M57 18c3 4 3 8-1 9s-5-4-1-9l1-2z"/></g>`),
    },
    "🙏🏻": {
        label: "Thanks",
        svg: svg(`<g stroke="${INK}" stroke-width="2.5"><path d="M9 13l-4-3M8 23H3M55 13l4-3M56 23h5"/></g>
            <g fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="3.5">
                <path d="M32 6c-6 1-12 11-14 21l-5 11c-2 6 2 12 8 12h11z"/>
                <path d="M32 6c6 1 12 11 14 21l5 11c2 6-2 12-8 12h-11z"/>
            </g>
            <path d="M21 35c3 3 7 4 11 2M43 35c-3 3-7 4-11 2" stroke="${SKIN_LINE}" stroke-width="3"/>
            <g fill="#6FA8DC" stroke="#3E6C9A" stroke-width="3"><rect x="15" y="48" width="17" height="11" rx="3"/><rect x="32" y="48" width="17" height="11" rx="3"/></g>`),
    },
    "😡": {
        label: "Angry",
        svg: svg(`${face("#E8603C", "#9E2E1C")}
            <path d="M15 20l12 6M49 20l-12 6" stroke="${INK}" stroke-width="4"/>
            <g fill="${INK}"><ellipse cx="24" cy="31" rx="3.4" ry="4"/><ellipse cx="40" cy="31" rx="3.4" ry="4"/></g>
            <path d="M22 47c6-6 14-6 20 0" stroke="${INK}" stroke-width="4"/>`),
    },
    "🥺": {
        label: "Please",
        svg: svg(`${face()}
            <path d="M15 22c4 0 8-2 11-6M49 22c-4 0-8-2-11-6" stroke="${INK}" stroke-width="3.5"/>
            <g fill="${INK}"><circle cx="23" cy="32" r="7.5"/><circle cx="41" cy="32" r="7.5"/></g>
            <g fill="#fff"><circle cx="25.5" cy="29" r="2.8"/><circle cx="43.5" cy="29" r="2.8"/><circle cx="20.5" cy="35.5" r="1.3"/><circle cx="38.5" cy="35.5" r="1.3"/></g>
            <path d="M27 48c3-3 7-3 10 0" stroke="${INK}" stroke-width="3.5"/>`),
    },
    "🫤": {
        label: "Meh",
        svg: svg(`${face()}
            <g fill="${INK}"><ellipse cx="23" cy="27" rx="3.4" ry="4.6"/><ellipse cx="41" cy="27" rx="3.4" ry="4.6"/></g>
            <path d="M21 45l22-6" stroke="${INK}" stroke-width="4"/>`),
    },
    "👋": {
        label: "Hello",
        svg: svg(`<path d="M51 9c5 3 7 8 6 14M55 4c7 4 10 11 8 19" stroke="${INK}" stroke-width="3"/>
            <g transform="rotate(-18 32 36)" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="3.5">
                <rect x="8" y="30" width="9" height="20" rx="4.5" transform="rotate(-38 12 40)"/>
                <rect x="17" y="13" width="8" height="26" rx="4"/>
                <rect x="25" y="9" width="8" height="30" rx="4"/>
                <rect x="33" y="11" width="8" height="28" rx="4"/>
                <rect x="41" y="17" width="7.5" height="22" rx="3.75"/>
                <path d="M16 32h33v12c0 8-7 14-16 14s-17-6-17-14z"/>
            </g>`),
    },
};

// Inline SVG for an emoji character; falls back to the plain character.
export function emojiMarkup(char) {
    return EMOJI[char]?.svg ?? char;
}

export function emojiLabel(char) {
    return EMOJI[char]?.label ?? char;
}
