//----------- PLAYER NAMES AND COUNTRIES ---------------
// A signed-in player may choose the name their opponents see. The app checks
// it as they type; the game server checks it again before showing it to
// anyone (a name that fails falls back to the random animal name).

export const NAME_MIN = 3;
export const NAME_MAX = 12;
// Only the alphabets the game can check: Latin letters (with accents) and Chinese, digits and a few
// separators. Cyrillic, Greek and the like are out because their letters look just like Latin ones
// ("Cаzzo" with a Cyrillic "а") and a filter can't tell the difference by eye; the game is offered
// in English, Italian, French, Spanish, Portuguese and Chinese.
const NAME_SHAPE = /^[\p{Script=Latin}\p{Script=Han}0-9 _.-]+$/u;

// What a name can't contain: insults, slurs, sexual terms, blasphemy, in the game's languages, and names
// that would pass for the game itself. Everything is compared after folding: accents, look-alike digits
// (0 -> o, 1 -> i, 3 -> e, 4 -> a...), k -> c, ph -> f, doubled letters and punctuation, so "F.u.u.c.k",
// "c4zz0", "Kazzo" and "Phuck" count too. Three kinds of match:
//   ANYWHERE   long, unmistakable stems, anywhere in the name ("MegaFuckerX"); short ones would also hit
//              honest words ("Claudio", "Sussex", "Computer").
//   WHOLE_WORD short words, only as a word of their own: separated ("Big Dick", "big_dick") or joined
//              with a capital ("BigDick"). "Dickens" and "Class" stay fine.
//   COMPOUNDS  blasphemy and its look-alikes made of two parts ("Dio" + an insult, in either order):
//              "DioBrutto", "BruttoDio", "porcodio", wherever they sit in the name.
const ANYWHERE = [
  // English
  "fuck", "shit", "bitch", "cunt", "pussy", "asshole", "slut", "whore", "nigg", "retard", "porn",
  "vagina", "nazi", "hitler", "dildo", "wank", "bastard", "faggot", "blowjob", "handjob", "cumshot",
  "jerkoff", "motherfuck", "cocksuck", "paedo", "tranny", "dickhead", "bollock", "twat",
  // Italian
  "cazzo", "cazzat", "minchia", "stronz", "merda", "puttan", "troia", "troie", "zoccol", "vaffa", "fanculo",
  "coglion", "frocio", "ricchion", "mignott", "pompin", "bocchin", "fottut", "fottiti", "segaiol", "inculo",
  "incula", "culatton", "sborr", "baldracca", "bagascia", "mortacci", "figadilegno", "troione", "scopat",
  // French
  "merde", "putain", "salope", "connard", "connasse", "encule", "niquer", "couille", "foutre", "batard",
  // Spanish
  "mierda", "cabron", "gilipolla", "pendej", "culero", "maricon", "hijueputa", "hijodeputa", "chingad",
  "chingar", "puñeta", "joputa",
  // Portuguese
  "caralho", "buceta", "arrombad", "filhodaputa", "cuzao", "viado",
  // German
  "scheisse", "arschloch", "fotze", "hurensohn", "wichser", "schwuchtel", "nutte",
  // the game itself and its staff
  "linotte", "admin", "moderator",
];
const WHOLE_WORD = [
  "rapist", "fuk", "fck", "fvck", "fuq", "phuk", "penis", "dick", "cock", "fag", "rape", "sex", "boob", "boobs", "tits", "anal", "cum", "jizz", "kkk",
  "isis", "prick", "arse", "kike", "spic", "chink", "gook", "coon", "pedo", "pimp", "milf",
  "fica", "figa", "culo", "negro", "porco", "dio", "madonna", "sega", "scopa", "suca", "cazz", "merd",
  "suck", "sucami", "pirla", "finocchio", "gay", "lesbica", "puttana",
  "fdp", "ntm", "pute", "bite", "nique", "enculer", "bordel",
  "puta", "puto", "joder", "verga", "pinche", "hdp", "coño", "concha",
  "foda", "foder", "porra", "cu", "merdoso",
  "support", "official", "staff",
];
// Blasphemy: a holy name and an insult, either way round, glued or not ("DioBrutto", "BruttoDio",
// "porcodio", "Dio Cane"). The insults are whole words (with their feminine forms), so that "stronzodio"
// is caught as well as "diostronzo".
const HOLY = ["dio", "madonna", "cristo", "gesu", "gesucristo"];
const INSULT = [
  "cane", "porco", "porca", "maiale", "merda", "bestia", "ladro", "ladra", "bastardo", "brutto", "brutta",
  "stronzo", "stronza", "boia", "infame", "schifo", "cagna", "zoccola", "puttana", "troia", "cretino",
  "maledetto", "maledetta", "impiccato", "impiccata", "bruto", "bruta",
];

const LOOK_ALIKE = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };

// The name as a bare string of a-z letters; Chinese characters stay as they are.
function fold(text, ambiguous = {}) {
  return String(text)
    .normalize("NFKD").replace(/\p{M}/gu, "") // è -> e, full-width ｆ -> f
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[0-9]/g, (c) => ambiguous[c] ?? LOOK_ALIKE[c] ?? c)
    .replace(/ph/g, "f")
    .replace(/k/g, "c")
    .replace(/[^a-z\p{Script=Han}]/gu, "")
    .replace(/([a-z])\1+/g, "$1"); // "fuuuck" -> "fuck"
}
const FOLDED_ANYWHERE = ANYWHERE.map(fold);
const FOLDED_WHOLE = new Set(WHOLE_WORD.map(fold));
const FOLDED_COMPOUNDS = HOLY.flatMap((h) => INSULT.flatMap((i) => [fold(h + i), fold(i + h)])).filter((w) => w.length >= 6);

// Chinese: insults that no honest name has.
const HAN_BAD = ["操你", "草你", "他妈", "他媽", "妈的", "媽的", "傻逼", "傻屄", "沙比", "婊子", "狗屎", "王八", "屌", "鸡巴", "雞巴", "贱人", "賤人", "去死", "卧槽", "臥槽", "我操", "日你", "肏", "逼", "尼玛", "你妈", "你媽"];

// The words of a name: split at spaces and separators, and where a capital starts a new word
// ("BruttoDio" -> Brutto, Dio; "XMLHttp" -> XML, Http).
function words(name) {
  return name
    .split(/[\s_.-]+/)
    .flatMap((part) => part
      .replace(/(\p{Ll}|[0-9])(\p{Lu})/gu, "$1 $2")
      .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
      .split(" "))
    .filter(Boolean);
}

// A digit can stand for two letters ("1" is i or l, "7" is t or z: "Ca77o"), so each way is tried.
const READINGS = [{}, { "1": "l" }, { "7": "z" }, { "1": "l", "7": "z" }];
const withoutDigits = (text) => String(text).replace(/[0-9]+/g, "");

function offensive(name) {
  const parts = words(name);
  for (const reading of READINGS) {
    const all = fold(name, reading);
    if (HAN_BAD.some((w) => all.includes(fold(w)))) return true;
    if (FOLDED_ANYWHERE.some((w) => all.includes(w))) return true;
    if (FOLDED_COMPOUNDS.some((w) => all.includes(w))) return true;
    if (FOLDED_WHOLE.has(all)) return true; // "s e x", "c.u.m"
    if (parts.some((word) => FOLDED_WHOLE.has(fold(word, reading)))) return true;
  }
  // Numbers added to a bad word ("Dick69", "Sex123") don't hide it.
  return FOLDED_WHOLE.has(fold(withoutDigits(name))) || parts.some((word) => FOLDED_WHOLE.has(fold(withoutDigits(word))));
}

// A name can be changed once a day (the database enforces it: supabase/profiles_name_limit.sql). How long
// is left to wait after a change made at `changedAt` (an ISO date; none: free to change), in ms.
export const NAME_CHANGE_WAIT_MS = 24 * 3600 * 1000;
export function nameChangeWaitMs(changedAt, now = Date.now()) {
  const when = Date.parse(changedAt || "");
  return Number.isNaN(when) ? 0 : Math.max(0, when + NAME_CHANGE_WAIT_MS - now);
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
