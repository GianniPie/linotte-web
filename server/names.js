//----------- PLAYER NAMES ---------------
// Players don't type a name (no free text to moderate): the server gives
// everyone a short animal + number name, stable per playerId so the same
// install is always the same "person". Only animals that can't be read as a
// person's name (no Robin, Jay, Raven...). At most 6 letters, so with the
// number it stays within 8 characters and fits the player box.

const ANIMALS = [
  "Otter", "Panda", "Koala", "Lynx", "Gecko", "Bison", "Moose", "Hippo",
  "Zebra", "Lemur", "Llama", "Puffin", "Badger", "Walrus", "Toucan", "Beaver",
  "Owl", "Heron", "Stork", "Ibis", "Newt", "Yak", "Turtle", "Tiger",
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
  const animal = ANIMALS[h % ANIMALS.length];
  const num = String((h >>> 8) % 100).padStart(2, "0");
  return animal + num;
}

export function randomName(exclude = "") {
  let name;
  do {
    name = ANIMALS[Math.floor(Math.random() * ANIMALS.length)] + String(Math.floor(Math.random() * 100)).padStart(2, "0");
  } while (name === exclude);
  return name;
}
