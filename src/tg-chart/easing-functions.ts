export function linear(t: number) { return t }
export function easeInOutQuint(t: number) { return t < .5 ? 16 * Math.pow(t, 5) : 1 + 16 * Math.pow(t - 1, 5); }
