# Solmar — an open-world crime game

[![make.fun](https://make.fun/badge/competition/gta6-01)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/entries/gta6-01)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/maker)](https://make.fun)

**Solmar** is a complete original open-world crime game in the spirit of GTA 6,
built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
It runs offline in a desktop browser from its own static files — no network
request, no build step. Just serve `game/` and open `game/index.html`.

## The city

Solmar is a sun-soaked coastal city: a downtown of glass towers, quiet
suburbs, a sandy beach and a marina full of boats. You play Danny Cole, a
courier who runs jobs for fixer Marla Voss — five story missions, from a first
delivery at the marina to the big bank score, each paying cash.

## What is in it

- A city to explore **on foot and by car** — seeded streets, buildings, palms,
  lamps, beach and marina, all generated deterministically
- **Traffic AI** that drives the grid, and **pedestrians** who stroll the
  sidewalks and flee from gunfire
- **Stealable cars** — walk up to any car, press E, and it is yours (the law
  notices)
- A **wanted system (0–5 stars)** with police pursuit cars, flashing light
  bars, busts on foot, and a wanted level that decays once you slip away
- **5 story missions** with cash rewards, a glowing objective beacon, and a
  story-complete screen
- **Combat** — fists (F), a pistol (click to shoot, hitscan), ammo crates
  around the city, and a health bar that slowly regenerates
- **HUD with a 2D minimap** — cash, wanted stars, health, ammo, mission
  objective, speed, and a live top-down map
- **Title / pause / busted / wasted / done screens**, a **localStorage save**,
  and **WebAudio synth sound** (engine hum, siren, gunshots, pickups)
- **Three.js vendored locally** (`game/vendor/three.min.js`) — the game never
  touches the network

## Controls

| Key | Action |
| --- | --- |
| W / S | Move forward / back (on foot) · accelerate / brake (driving) |
| A / D | Turn (on foot) · steer (driving) |
| Shift | Run |
| E | Enter / exit a car |
| F | Punch |
| Mouse click | Shoot the pistol |
| P | Pause |
| M | Mute |

## Play it

```sh
# any static server works; for example:
npx serve game
# then open http://localhost:3000 in desktop Chrome
```

## Build the dossier

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/dossier.json` (plus `game/` and `screenshots/`) with the
kit's `buildDossier`.

## License

MIT — see [LICENSE](LICENSE).

---
Built for make.fun — [make.fun/r/naxr310m](https://make.fun/r/naxr310m)
