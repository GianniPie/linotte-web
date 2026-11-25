// The Spring piece: a ladybird. The lids come over the drawing and it blinks twice, quickly.
export default {
  file: "p047_e63946ff.svg",
  fx: {
    every: 16, over: true, layers: [["pfx-lids", "ladybug-lids.svg"]],
    play: ([lids]) => lids.animate([{ opacity: 0 }, { opacity: 1, offset: 0.07 }, { opacity: 1, offset: 0.24 }, { opacity: 0, offset: 0.31 }, { opacity: 0, offset: 0.55 }, { opacity: 1, offset: 0.62 }, { opacity: 1, offset: 0.79 }, { opacity: 0 }], { duration: 750 }),
  },
};
