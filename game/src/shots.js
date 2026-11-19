// Screenshot staging: poses the game for the 3-4 entry screenshots.
// Reads ?shot=N from the URL; main.js calls stageIfRequested() after init.
// Each shot sets up a real game state (no faked pixels), then reports ready.

const Shots = {
  applied: false,

  stageIfRequested() {
    if (this.applied) return;
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot) return;
    this.applied = true;
    const G = window.__game;
    if (!G) return;
    const n = parseInt(shot, 10);
    // Let one frame render first, then stage and report ready.
    setTimeout(() => {
      try { this.apply(n, G); } catch (e) { console.error('shot staging failed', e); }
      window.__ready = true;
      document.title = 'shot-ready';
    }, 600);
  },

  apply(n, G) {
    // All shots run in playing state with the HUD on.
    SOL.state = 'playing';
    Render.hideScreen();
    if (n === 1) {
      // Cover: on foot on the southern street, city skyline ahead.
      G.teleport(0, 250, Math.PI * 1.5); // face north, into the city
      SOL.missionIndex = 0;
      Missions.started = false;
      Missions.stage = 0;
      SOL.wanted = 0;
    } else if (n === 2) {
      // Driving: a sports car down a main street with traffic.
      G.teleport(-50, -50, 0);
      const car = G.giveCar('sport', 0xc94a4a);
      G.enterCar(car);
      car.speed = 26;
      SOL.missionIndex = 0;
      Missions.started = true;
      Missions.stage = 0;
      SOL.wanted = 0;
    } else if (n === 3) {
      // Chase: 3 stars, police on the player's tail.
      G.teleport(50, 50, Math.PI / 2);
      const car = G.giveCar('sedan', 0x4a7ac9);
      G.enterCar(car);
      car.speed = 30;
      SOL.wanted = 3;
      Police.ensureCars(Render.scene, car.x, car.z);
      SOL.missionIndex = 1;
      Missions.started = true;
      Missions.stage = 0;
    } else if (n === 4) {
      // Mission: at the bank vault for The Big Score, beacon glowing.
      G.teleport(0, -200, Math.PI / 2); // face south, toward the bank
      SOL.missionIndex = 4;
      Missions.started = true;
      Missions.stage = 0;
      Missions.holdT = 1.2;
      SOL.wanted = 2;
      SOL.cash = 1150;
    }
    // Let the camera settle behind the player/car for a few frames.
    for (let i = 0; i < 8; i++) {
      const p = G.playerPos();
      Render.updateCamera(0.12, p.x, p.z, p.heading, !!Vehicles.playerCar, Vehicles.playerCar ? Vehicles.playerCar.speed : 0);
      Render.syncPlayer(p.x, p.z, p.heading, false, 0);
      Render.updateHUD();
    }
    Render.drawMinimap(G.playerPos().x, G.playerPos().z, G.playerPos().heading);
  },
};
