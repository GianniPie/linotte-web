// The Ice piece: a plump penguin. The flippers flap twice now and then.
const flapKeys = (deg) => [{ transform: "rotate(0deg)" }, { transform: `rotate(${deg}deg)`, offset: 0.25 }, { transform: "rotate(0deg)", offset: 0.5 }, { transform: `rotate(${deg * 0.8}deg)`, offset: 0.78 }, { transform: "rotate(0deg)" }];
export default {
  file: "p048_1b1d26ff.svg",
  fx: {
    every: 22, layers: [["pfx-flip-l", "penguin-flipper-l.svg"], ["pfx-flip-r", "penguin-flipper-r.svg"], ["pfx-still", "penguin-body.svg"]],
    play: ([left, right]) => { left.animate(flapKeys(22), { duration: 1100, easing: "ease-in-out" }); right.animate(flapKeys(-22), { duration: 1100, easing: "ease-in-out" }); },
  },
};
