// Solmar main loop: state machine, player movement, car enter/exit,
// save/load, and the __game / __probe hooks for testing and screenshots.

const Game = {
  player: { x: 0, z: 200, heading: Math.PI * 1.5, walkPhase: 0, moving: false },
  inCar: false,
  lastShotAt: null,
  saveTimer: 0,

  init() {
    const canvas = document.getElementById('game');
    Render.init(canvas);
    buildCity(Render.scene);
    Vehicles.spawnTraffic(Render.scene, 14);
    People.spawn(Render.scene, 26);
    Missions.build(Render.scene);
    Combat.build(Render.scene);
    Input.init(canvas);
    this.loadSave();
    AudioSys.ensure();
    this.showTitle();
    // Expose hooks for screenshots and probes.
    window.__game = {
      playerPos: () => ({ x: this.player.x, z: this.player.z, heading: this.player.heading }),
      teleport: (x, z, h) => this.teleport(x, z, h),
      giveCar: (kind, color) => this.giveCar(kind, color),
      enterCar: (car) => this.enterCar(car),
      state: () => ({ state: SOL.state, cash: SOL.cash, wanted: SOL.wanted, mission: SOL.missionIndex, health: SOL.health, ammo: SOL.ammo, inCar: this.inCar }),
    };
    window.__ready = false;
    Shots.stageIfRequested();
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this.step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  showTitle() {
    SOL.state = 'title';
    Render.showScreen(
      'SOLMAR',
      'A sun-soaked coastal city. Steal cars, dodge the law, run jobs for Marla Voss.',
      'WASD move/drive · E enter car · F punch · Click shoot · P pause · M mute — press any key to start'
    );
  },

  startGame() {
    SOL.state = 'playing';
    Render.hideScreen();
    AudioSys.resume();
    Render.showMessage('Welcome to Solmar. Go see Marla Voss.', 3200);
  },

  teleport(x, z, heading) {
    this.player.x = x; this.player.z = z;
    if (heading !== undefined) this.player.heading = heading;
    if (this.inCar && Vehicles.playerCar) {
      const car = Vehicles.playerCar;
      car.x = x; car.z = z;
      if (heading !== undefined) car.heading = heading;
      car.speed = 0;
    }
    Render.syncPlayer(x, z, this.player.heading, false, 0);
  },

  giveCar(kind, color) {
    const p = this.player;
    const car = makeCar(Render.scene, p.x + Math.cos(p.heading) * 4, p.z + Math.sin(p.heading) * 4, p.heading, kind, color);
    Vehicles.traffic.push(car);
    return car;
  },

  enterCar(car) {
    car.isPlayer = true;
    Vehicles.playerCar = car;
    this.inCar = true;
    Render.playerMesh.visible = false;
    if (car._wasTraffic) Police.addWanted(1);
  },

  exitCar() {
    const car = Vehicles.playerCar;
    if (!car) return;
    car.isPlayer = false;
    car.speed = 0;
    car._wasTraffic = true;
    Vehicles.playerCar = null;
    this.inCar = false;
    // Step out to the side of the car.
    const sx = car.x - Math.sin(car.heading) * 2.4;
    const sz = car.z + Math.cos(car.heading) * 2.4;
    const fixed = SOL.city.collideCircle(sx, sz, 0.8);
    this.player.x = fixed.x; this.player.z = fixed.z;
    this.player.heading = car.heading;
    Render.playerMesh.visible = true;
  },

  step(dt) {
    SOL.time += dt;
    // Global keys.
    if (Input.mute) { SOL.muted = !SOL.muted; Render.showMessage(SOL.muted ? 'Muted' : 'Sound on', 1200); }
    if (SOL.state === 'title') {
      if (Input.anyKey) this.startGame();
      this.renderWorld(dt);
      Input.endFrame();
      return;
    }
    if (SOL.state === 'busted' || SOL.state === 'wasted' || SOL.state === 'done') {
      if (Input.anyKey) this.restartAfterEnd();
      this.renderWorld(dt);
      Input.endFrame();
      return;
    }
    if (Input.pause) {
      if (SOL.state === 'playing') { SOL.state = 'paused'; Render.showScreen('PAUSED', 'Take a breath. Solmar waits.', 'Press P to resume'); }
      else if (SOL.state === 'paused') { SOL.state = 'playing'; Render.hideScreen(); }
    }
    if (SOL.state === 'paused') { Input.endFrame(); return; }

    // --- Playing ---
    const p = this.player;
    if (this.inCar) {
      Vehicles.updatePlayerCar(dt, Input);
      const car = Vehicles.playerCar;
      if (car) { p.x = car.x; p.z = car.z; p.heading = car.heading; }
      if (Input.enterCar) this.exitCar();
      AudioSys.setEngine(Math.abs(Vehicles.playerCar ? Vehicles.playerCar.speed : 0) / SOL.carMaxSpeed, true);
    } else {
      // On foot: A/D turn, W/S move.
      const turn = (Input.left ? 1 : 0) - (Input.right ? 1 : 0);
      p.heading += turn * 2.6 * dt;
      const move = (Input.up ? 1 : 0) - (Input.down ? 1 : 0);
      const speed = move * (Input.run ? SOL.runSpeed : SOL.walkSpeed);
      p.moving = move !== 0;
      p.x += Math.cos(p.heading) * speed * dt;
      p.z += Math.sin(p.heading) * speed * dt;
      if (p.moving) p.walkPhase += dt * speed * 1.4;
      const fixed = SOL.city.collideCircle(p.x, p.z, 0.8);
      p.x = fixed.x; p.z = fixed.z;
      // Enter a nearby car.
      if (Input.enterCar) {
        const car = Vehicles.nearestCar(p.x, p.z, 4.5);
        if (car) { car._wasTraffic = true; this.enterCar(car); Render.showMessage('Car stolen — the law is watching.', 2200); }
      }
      // Punch.
      if (Input.punch) {
        const r = Combat.punch(p.x, p.z, p.heading);
        if (r) { AudioSys.punch(); if (r.target) Render.showMessage('You punched a pedestrian. Wanted +1.', 1800); }
      }
      // Shoot toward the mouse ground point.
      if (Input.mouseClicked) {
        const aim = this.mouseGroundPoint();
        const r = Combat.shoot(p.x, p.z, aim.x, aim.z);
        if (r) {
          AudioSys.gunshot();
          this.lastShotAt = { x: p.x, z: p.z };
          if (r.event === 'hit') Render.showMessage('Hit! Wanted +1.', 1500);
          if (r.event === 'dryfire') Render.showMessage('Out of ammo — find a green crate.', 2000);
        }
      }
      AudioSys.setEngine(0, false);
    }

    // World systems.
    Vehicles.updateTraffic(dt);
    People.update(dt, p.x, p.z, this.lastShotAt);
    const bust = Police.update(dt, Render.scene, p.x, p.z, this.inCar);
    if (bust === 'busted') {
      SOL.state = 'busted';
      SOL.cash = Math.max(0, SOL.cash - 100);
      AudioSys.busted();
      Render.showScreen('BUSTED', 'The Solmar police caught you. You lose $100 bail.', 'Press any key to get back out there');
      this.saveGame();
      Input.endFrame();
      this.renderWorld(dt);
      return;
    }
    const m = Missions.update(dt, p.x, p.z);
    if (m) {
      if (m.event === 'start') { AudioSys.pickup(); Render.showMessage(`${m.mission} started.`, 2400); }
      if (m.event === 'stage') { AudioSys.pickup(); Render.showMessage('Objective updated.', 2000); }
      if (m.event === 'complete') {
        AudioSys.cash();
        Render.showMessage(`${m.mission} complete! +$${m.reward}`, 3200);
        if (SOL.missionIndex >= SOL.missions.length) {
          SOL.state = 'done';
          Render.showScreen('STORY COMPLETE', 'You ran every job in Solmar and walked away rich.', 'Free roam continues — press any key');
          this.saveGame();
        }
      }
    }
    const c = Combat.update(dt, p.x, p.z);
    if (c && c.event === 'ammo') { AudioSys.pickup(); Render.showMessage('Ammo +12.', 1800); }
    // Health regen (slow) while not wanted.
    if (SOL.wanted === 0 && SOL.health < SOL.playerHealth) SOL.health = Math.min(SOL.playerHealth, SOL.health + dt * 2);
    if (SOL.health <= 0) {
      SOL.state = 'wasted';
      AudioSys.busted();
      Render.showScreen('WASTED', 'Solmar got the better of you.', 'Press any key to try again');
      this.saveGame();
      Input.endFrame();
      this.renderWorld(dt);
      return;
    }
    // Siren when wanted.
    AudioSys.setSiren(SOL.wanted > 0 && SOL.state === 'playing');
    // Muzzle flash.
    if (Combat.muzzle > 0) {
      Render.flashMesh.visible = true;
      const fx = p.x + Math.cos(p.heading) * 1.6;
      const fz = p.z + Math.sin(p.heading) * 1.6;
      Render.flashMesh.position.set(fx, 1.3, fz);
    } else {
      Render.flashMesh.visible = false;
    }
    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 10) { this.saveTimer = 0; this.saveGame(); }

    this.renderWorld(dt);
    Input.endFrame();
  },

  renderWorld(dt) {
    const p = this.player;
    Render.syncPlayer(p.x, p.z, p.heading, p.moving && !this.inCar, p.walkPhase);
    const car = Vehicles.playerCar;
    Render.updateCamera(dt, p.x, p.z, p.heading, this.inCar, car ? car.speed : 0);
    Render.drawMinimap(p.x, p.z, p.heading);
    Render.updateHUD();
    // Gentle water shimmer.
    if (SOL.city.water) SOL.city.water.position.y = 0.15 + Math.sin(SOL.time * 0.8) * 0.05;
    Render.renderer.render(Render.scene, Render.camera);
  },

  mouseGroundPoint() {
    const nx = (Input.mouseX / window.innerWidth) * 2 - 1;
    const ny = -(Input.mouseY / window.innerHeight) * 2 + 1;
    const cam = Render.camera;
    const origin = cam.position.clone();
    const dir = new THREE.Vector3(nx, ny, 0.5).unproject(cam).sub(origin).normalize();
    if (Math.abs(dir.y) < 1e-4) return { x: this.player.x + 10, z: this.player.z };
    const t = -origin.y / dir.y;
    return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
  },

  restartAfterEnd() {
    if (SOL.state === 'done') {
      SOL.state = 'playing';
      Render.hideScreen();
      return;
    }
    // Busted / wasted: respawn at the safehouse corner, keep progress.
    SOL.health = SOL.playerHealth;
    SOL.wanted = 0;
    this.teleport(-200, 200, Math.PI * 1.5);
    SOL.state = 'playing';
    Render.hideScreen();
    Render.showMessage('Back on the streets.', 2000);
  },

  saveGame() {
    try {
      localStorage.setItem(SOL.saveKey, JSON.stringify({
        cash: SOL.cash, missionIndex: SOL.missionIndex, health: SOL.health, ammo: SOL.ammo,
      }));
    } catch (e) { /* storage unavailable */ }
  },

  loadSave() {
    try {
      const raw = localStorage.getItem(SOL.saveKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.cash === 'number') SOL.cash = s.cash;
      if (typeof s.missionIndex === 'number') SOL.missionIndex = Math.min(s.missionIndex, SOL.missions.length);
      if (typeof s.health === 'number') SOL.health = s.health;
      if (typeof s.ammo === 'number') SOL.ammo = s.ammo;
    } catch (e) { /* ignore corrupt save */ }
  },
};

window.addEventListener('DOMContentLoaded', () => Game.init());
