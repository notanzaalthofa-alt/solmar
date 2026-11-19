// Seeded random helpers for Solmar. One master rng drives the city layout;
// traffic, pedestrians and police keep their own seeded rngs so a frame's
// randomness never leaks into the world layout.

const RNG = {
  world: mulberry32(20261119),
  // Pick a value in [lo, hi).
  range(rng, lo, hi) { return lo + rng() * (hi - lo); },
  // Pick an integer in [lo, hi].
  int(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); },
  // Pick one element of an array.
  pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; },
  // Fisher-Yates shuffle, in place, using the given rng.
  shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  },
};
