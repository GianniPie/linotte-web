// The Ice theme as plain data (the server reads it too: nothing here may touch the page). A theme has a list of options for
// each of its four elements (one each, for now); every option has its `index`, the number saved in the player's options
// and sent to the server (see themes/classic/manifest.js).
export default {
  id: "ice",
  name: "Ice",
  background: [
    { index: 11, title: "Ice Glacier", src: "themes/ice/background/background.svg", preview: "themes/ice/background/preview.png", ink: "ice" },
  ],
  board: [
    { index: 3, skin: "ice", name: "Ice", preview: "themes/ice/board/preview.png" },
  ],
  dice: [
    { index: 10, name: "ICE", sprite: "themes/ice/dice/sprite.webp", preview: "themes/ice/dice/preview.webp", radius: 10.5 },
  ],
  piece: [
    { index: 47, file: "p048_1b1d26ff.svg" },
  ],
};
