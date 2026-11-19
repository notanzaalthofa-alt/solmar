// Solmar — shared configuration and global state.
// All values are authored here; every other module reads SOL.

const SOL = {
  // City layout
  block: 36,          // building block size
  street: 14,         // street width
  pitch: 50,          // block + street (grid spacing)
  half: 250,          // city half-extent (streets run -225..225, beach beyond)
  beachZ: 262,        // sand starts here (south edge)
  waterZ: 292,        // water plane starts here
  marinaX: 262,       // docks start here (east edge)

  // Player
  walkSpeed: 9,
  runSpeed: 14,
  playerHealth: 100,

  // Driving
  carAccel: 22,
  carBrake: 34,
  carMaxSpeed: 42,
  carTurn: 1.9,

  // Wanted
  wantedDecay: 0.055, // stars per second while hidden
  maxWanted: 5,

  // Cash
  startCash: 200,

  // Colors (sun-soaked coastal palette)
  sky: 0x8ec9e8,
  sun: 0xfff2c9,
  sand: 0xe8d29a,
  water: 0x2e7fa8,
  road: 0x3a3f46,
  sidewalk: 0x9aa0a6,

  // Mission data (names, rewards, flavor)
  missions: [
    { id: 0, name: 'First Run', reward: 150, giver: 'Marla Voss', text: 'Drive the package to the marina drop-off.' },
    { id: 1, name: 'Pickup', reward: 300, giver: 'Marla Voss', text: 'Pick up the courier at the docks and bring them to the diner.' },
    { id: 2, name: 'Package Run', reward: 250, giver: 'Marla Voss', text: 'Collect 3 packages scattered around Solmar.' },
    { id: 3, name: 'The Exchange', reward: 350, giver: 'Marla Voss', text: 'Grab the briefcase at the pier, then lose the heat.' },
    { id: 4, name: 'The Big Score', reward: 800, giver: 'Marla Voss', text: 'Hit the bank vault and escape to the safehouse.' },
  ],

  // Runtime state (filled in by main.js)
  state: 'title',      // title | playing | paused | busted | wasted | done
  cash: 200,
  health: 100,
  ammo: 12,
  wanted: 0,
  missionIndex: 0,
  missionStage: 'idle', // idle | active | done
  time: 0,
  paused: false,
  muted: false,
  saveKey: 'solmar-save-v1',
};

// Seeded RNG (mulberry32) — deterministic city, traffic and pedestrians.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small helpers shared by modules.
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
