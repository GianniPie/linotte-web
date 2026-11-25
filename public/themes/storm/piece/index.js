// The Storm piece: an umbrella. The canopy twirls once now and then (the shine stays).
export default {
  file: "p046_3d6df0ff.svg",
  fx: {
    every: 26, layers: [["pfx-spin", "umbrella-canopy.svg"], ["pfx-still", "umbrella-shine.svg"]],
    play: ([canopy]) => canopy.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 1500, easing: "cubic-bezier(.45, 0, .25, 1)" }),
  },
};
