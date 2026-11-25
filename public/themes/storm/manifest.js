// The Storm theme as plain data (the server reads it too: nothing here may touch the page). A theme has a list of options for
// each of its four elements (one each, for now); every option has its `index`, the number saved in the player's options
// and sent to the server (see themes/classic/manifest.js).
export default {
  id: "storm",
  name: "Storm",
  background: [
    { index: 9, title: "Storm Clouds", src: "themes/storm/background/background.svg", preview: "themes/storm/background/preview.png", ink: "storm" },
  ],
  board: [
    { index: 1, skin: "storm", name: "Storm", preview: "themes/storm/board/preview.png" },
  ],
  dice: [
    { index: 8, name: "STORM", sprite: "themes/storm/dice/sprite.svg", preview: "themes/storm/dice/preview.png", radius: 19.5 },
  ],
  piece: [
    { index: 45, file: "p046_3d6df0ff.svg" },
  ],
};
