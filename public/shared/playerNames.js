//----------- PLAYER NAMES AND COUNTRIES ---------------
// A signed-in player may choose the name their opponents see. The app checks
// it as they type; the game server checks it again before showing it to
// anyone (a name that fails falls back to the random animal name).

export const NAME_MIN = 3;
export const NAME_MAX = 12;
const NAME_SHAPE = /^[\p{L}\p{N} _.-]+$/u;

// Words a name can't contain (English and Italian insults, slurs, sexual
// terms) and names that would pass for the game itself. Compared after
// folding look-alikes (0->o, 1->i, 3->e, @->a...), accents, doubled letters
// and punctuation, so "F.u.u.c.k" and "c4zz0" count too. Long, unmistakable
// words count anywhere in the name; short ones only as a whole word, so
// "Claudio" or "Sussex" stay fine.
const ANYWHERE = [
  "fuck", "shit", "bitch", "cunt", "pussy", "asshole", "slut", "whore", "nigg", "retard", "porn",
  "penis", "vagina", "nazi", "hitler", "dildo", "wank", "bastard",
  "cazzo", "minchia", "stronz", "merda", "puttan", "troia", "zoccol", "vaffa", "coglion", "frocio",
  "ricchion", "mignott", "pompin", "bocchin", "fottut", "fottiti", "segaiol",
  "linotte", "admin", "moderator",
];
const WHOLE_WORD = [
  "fuk", "fck", "dick", "cock", "fag", "rape", "sex", "boob", "boobs", "tits", "anal", "cum", "jizz",
  "kkk", "isis", "twat", "prick", "arse", "fica", "figa", "culo", "negro", "porco", "dio", "madonna",
  "sega", "scopa", "suca", "cazz", "support", "official", "staff",
];

const LOOK_ALIKE = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b", "9": "g" };

function fold(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/\p{M}/gu, "") // è -> e
    .replace(/[0-9!|@$]/g, (c) => LOOK_ALIKE[c] ?? c)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1"); // "fuuuck" -> "fuck"
}
const FOLDED_ANYWHERE = ANYWHERE.map(fold);
const FOLDED_WHOLE = new Set(WHOLE_WORD.map(fold));

function offensive(name) {
  const all = fold(name);
  if (FOLDED_ANYWHERE.some((w) => all.includes(w))) return true;
  if (FOLDED_WHOLE.has(all)) return true; // "s e x", "c.u.m"
  return name.split(/[\s_.-]+/).some((word) => FOLDED_WHOLE.has(fold(word)));
}

// Why a name can't be used, for the edit sheet ("" = it's fine).
export function nameProblem(raw) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN) return `At least ${NAME_MIN} characters.`;
  if (name.length > NAME_MAX) return `At most ${NAME_MAX} characters.`;
  if (!NAME_SHAPE.test(name)) return "Letters, numbers, spaces, _ . - only.";
  if (offensive(name)) return "Please choose another name.";
  return "";
}

// The name tidied up, or "" when it can't be used.
export function cleanPlayerName(raw) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  return nameProblem(name) ? "" : name;
}

// ISO 3166-1 codes. Their names come from the browser (Intl.DisplayNames).
export const COUNTRIES = (
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM " +
  "FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM " +
  "JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO " +
  "MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT " +
  "PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM " +
  "TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");
const COUNTRY_SET = new Set(COUNTRIES);

export const isCountry = (code) => COUNTRY_SET.has(code);

// "IT" -> the Italian flag emoji ("" for anything else).
export function flagOf(code) {
  if (!isCountry(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
