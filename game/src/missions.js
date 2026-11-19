// Story missions for Solmar: five jobs from fixer Marla Voss.
// Each mission is a list of stages; a stage completes when the player
// reaches its target (or, for the vault, holds there for 3 seconds).

// Mission spots are all on streets or intersections (multiples of 50) or on
// the marina apron — never inside a building block.
const MISSION_SPOTS = {
  marina: { x: 275, z: 100, label: 'Marina drop-off' },
  docks: { x: 275, z: -150, label: 'Docks' },
  diner: { x: 50, z: 50, label: 'Diner' },
  pkgA: { x: -150, z: 50, label: 'Package 1' },
  pkgB: { x: 150, z: -100, label: 'Package 2' },
  pkgC: { x: 100, z: 150, label: 'Package 3' },
  pier: { x: 275, z: 0, label: 'Pier' },
  bank: { x: 0, z: -200, label: 'Bank vault' },
  safehouse: { x: -200, z: 200, label: 'Safehouse' },
  marla: { x: -50, z: -50, label: "Marla's corner" },
};

const MISSION_STAGES = [
  // 0 First Run
  [{ spot: 'marina', r: 8 }],
  // 1 Pickup
  [{ spot: 'docks', r: 7 }, { spot: 'diner', r: 8 }],
  // 2 Package Run
  [{ spot: 'pkgA', r: 6 }, { spot: 'pkgB', r: 6 }, { spot: 'pkgC', r: 6 }],
  // 3 The Exchange
  [{ spot: 'pier', r: 7, wanted: 2 }, { spot: 'safehouse', r: 9 }],
  // 4 The Big Score
  [{ spot: 'bank', r: 8, hold: 3, wanted: 3 }, { spot: 'safehouse', r: 9 }],
];

const Missions = {
  beacon: null,
  ring: null,
  stage: 0,
  holdT: 0,
  started: false,

  build(scene) {
    const geo = new THREE.CylinderGeometry(3.2, 3.2, 26, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 13;
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringGeo = new THREE.TorusGeometry(4, 0.35, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.4;
    this.ring.visible = false;
    scene.add(this.ring);
  },

  currentDef() { return SOL.missions[SOL.missionIndex]; },
  currentStages() { return MISSION_STAGES[SOL.missionIndex]; },

  target() {
    if (!this.started || SOL.missionIndex >= SOL.missions.length) return null;
    const st = this.currentStages()[this.stage];
    if (!st) return null;
    const spot = MISSION_SPOTS[st.spot];
    return { x: spot.x, z: spot.z, r: st.r, label: spot.label, hold: st.hold || 0, wanted: st.wanted || 0 };
  },

  objectiveText() {
    if (SOL.missionIndex >= SOL.missions.length) return 'Story complete — free roam. Enjoy Solmar.';
    const def = this.currentDef();
    if (!this.started) return `Go see ${def.giver} at ${MISSION_SPOTS.marla.label} — ${def.name} ($${def.reward}).`;
    const t = this.target();
    if (!t) return def.text;
    if (t.hold > 0) return `${def.name}: crack the vault — stand in the circle (${Math.ceil(t.hold - this.holdT)}s).`;
    return `${def.name}: go to ${t.label}.`;
  },

  start() {
    this.started = true;
    this.stage = 0;
    this.holdT = 0;
    SOL.missionStage = 'active';
  },

  update(dt, px, pz) {
    if (SOL.missionIndex >= SOL.missions.length) {
      this.beacon.visible = false;
      this.ring.visible = false;
      return null;
    }
    const def = this.currentDef();
    // Not started: beacon sits on Marla; walking into it starts the job.
    if (!this.started) {
      this.beacon.visible = true;
      this.ring.visible = true;
      this.beacon.position.set(MISSION_SPOTS.marla.x, 13, MISSION_SPOTS.marla.z);
      this.ring.position.set(MISSION_SPOTS.marla.x, 0.4, MISSION_SPOTS.marla.z);
      if (dist2(px, pz, MISSION_SPOTS.marla.x, MISSION_SPOTS.marla.z) < 36) {
        this.start();
        return { event: 'start', mission: def.name };
      }
      return null;
    }
    const t = this.target();
    if (!t) return null;
    this.beacon.visible = true;
    this.ring.visible = true;
    this.beacon.position.set(t.x, 13, t.z);
    this.ring.position.set(t.x, 0.4, t.z);
    // Pulse the beacon.
    const s = 1 + Math.sin(SOL.time * 4) * 0.12;
    this.beacon.scale.set(s, 1, s);

    const d = Math.hypot(px - t.x, pz - t.z);
    if (d < t.r) {
      if (t.hold > 0) {
        this.holdT += dt;
        if (this.holdT >= t.hold) {
          this.holdT = 0;
          return this.advance(t);
        }
        return null;
      }
      return this.advance(t);
    }
    this.holdT = Math.max(0, this.holdT - dt);
    return null;
  },

  advance(t) {
    if (t.wanted) Police.addWanted(t.wanted);
    this.stage++;
    const stages = this.currentStages();
    if (this.stage >= stages.length) {
      const def = this.currentDef();
      SOL.cash += def.reward;
      SOL.missionIndex++;
      this.started = false;
      this.stage = 0;
      SOL.missionStage = SOL.missionIndex >= SOL.missions.length ? 'done' : 'idle';
      return { event: 'complete', mission: def.name, reward: def.reward };
    }
    return { event: 'stage', mission: this.currentDef().name };
  },
};
