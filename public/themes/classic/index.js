// The main theme, wired: its manifest (plain data). It has nothing that moves, so there is no code to give.
import manifest from "./manifest.js";

export default { ...manifest, code: { background: {}, board: {}, piece: {} } };
