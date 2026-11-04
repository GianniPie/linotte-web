//----------- PLAYER NAMES ---------------
// Players don't type a name (no free text to moderate): the server gives
// everyone a short bird + number name, stable per playerId so the same
// install is always the same "person". Kept to 8 characters so it fits the
// player box.

const BIRDS = [
  "Wren", "Finch", "Robin", "Lark", "Swift", "Owl", "Crane", "Heron",
  "Raven", "Dove", "Jay", "Kite", "Tern", "Pipit", "Linnet", "Stork",
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nameFromId(id) {
  const h = hash(String(id));
  const bird = BIRDS[h % BIRDS.length];
  const num = String((h >>> 8) % 100).padStart(2, "0");
  return bird + num;
}

export function randomName(exclude = "") {
  let name;
  do {
    name = BIRDS[Math.floor(Math.random() * BIRDS.length)] + String(Math.floor(Math.random() * 100)).padStart(2, "0");
  } while (name === exclude);
  return name;
}
