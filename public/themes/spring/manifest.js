// The Spring theme as plain data (the server reads it too: nothing here may touch the page). A theme has a list of options for
// each of its four elements (one each, for now); every option has its `index`, the number saved in the player's options
// and sent to the server (see themes/classic/manifest.js).
export default {
  id: "spring",
  name: "Spring",
  background: [
    { index: 10, title: "Spring Meadow", src: "themes/spring/background/background.svg", preview: "themes/spring/background/preview.png", ink: "spring" },
  ],
  board: [
    { index: 2, skin: "spring", name: "Spring", preview: "themes/spring/board/preview.png" },
  ],
  dice: [
    { index: 9, name: "SPRING", sprite: "themes/spring/dice/sprite.svg", preview: "themes/spring/dice/preview.png", radius: 19.5 },
  ],
  piece: [
    { index: 46, file: "p047_e63946ff.svg" },
  ],
};
