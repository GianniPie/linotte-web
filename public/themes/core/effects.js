// Small movements several themes use (one place, so they all behave the same).

/** A glint: grows, turns a quarter and fades. The element is removed when it is done. */
export function twinkle(el, ms) {
    el.animate([
        { opacity: 0, transform: "scale(.2) rotate(0deg)", offset: 0 },
        { opacity: 1, transform: "scale(1) rotate(45deg)", offset: 0.4 },
        { opacity: 0, transform: "scale(.3) rotate(90deg)", offset: 1 },
    ], { duration: ms, easing: "ease-in-out" }).onfinish = () => el.remove();
}
