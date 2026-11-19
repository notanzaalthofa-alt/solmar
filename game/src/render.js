// Rendering: three.js scene, follow camera, HUD and 2D minimap.

const Render = {
  renderer: null,
  scene: null,
  camera: null,
  playerMesh: null,
  minimap: null,
  mapCtx: null,
  camYaw: 0,
  camPitch: 0.32,
  camDist: 13,
  flashMesh: null,

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(SOL.sky);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SOL.sky);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 20, 30);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.playerMesh = this.makePlayerMesh();
    this.scene.add(this.playerMesh);
    // Muzzle flash sprite (hidden unless shooting).
    this.flashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 })
    );
    this.flashMesh.visible = false;
    this.scene.add(this.flashMesh);
    this.minimap = document.getElementById('minimap');
    this.mapCtx = this.minimap.getContext('2d');
  },

  makePlayerMesh() {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2a5a8a });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x3a4a6a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.95, 0.38), jacket);
    body.position.y = 1.15;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.86;
    g.add(head);
    // A cap, so the player reads at a glance.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    cap.position.y = 2.1;
    g.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), jeans);
    legL.position.set(-0.17, 0.35, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.17;
    g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.2), jacket);
    armL.position.set(-0.44, 1.15, 0);
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.44;
    g.add(armR);
    return g;
  },

  syncPlayer(px, pz, heading, walking, walkPhase) {
    const m = this.playerMesh;
    m.position.set(px, 0, pz);
    m.rotation.y = -heading;
    // Walk cycle on the legs and arms.
    const swing = walking ? Math.sin(walkPhase) * 0.5 : 0;
    m.children[3].rotation.x = swing;
    m.children[4].rotation.x = -swing;
    m.children[5].rotation.x = -swing;
    m.children[6].rotation.x = swing;
  },

  updateCamera(dt, px, pz, heading, inCar, speed) {
    // Third-person follow: behind the player/car, smoothed.
    const back = inCar ? 15 : 11;
    const height = inCar ? 6.5 : 5.2;
    const tx = px - Math.cos(heading) * back;
    const tz = pz - Math.sin(heading) * back;
    const k = 1 - Math.pow(0.001, dt);
    this.camera.position.x = lerp(this.camera.position.x, tx, k);
    this.camera.position.y = lerp(this.camera.position.y, height, k);
    this.camera.position.z = lerp(this.camera.position.z, tz, k);
    this.camera.lookAt(px + Math.cos(heading) * 6, 1.6, pz + Math.sin(heading) * 6);
  },

  drawMinimap(px, pz, heading) {
    const c = this.mapCtx, S = 168;
    if (!c) return;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(16,24,32,0.82)';
    c.fillRect(0, 0, S, S);
    const span = SOL.half * 2 + 120;
    const toMap = (v) => ((v + span / 2) / span) * S;
    // Roads.
    c.strokeStyle = '#5a616a';
    c.lineWidth = 3;
    for (const s of SOL.city.streetLines) {
      c.beginPath(); c.moveTo(toMap(s), 0); c.lineTo(toMap(s), S); c.stroke();
      c.beginPath(); c.moveTo(0, toMap(s)); c.lineTo(S, toMap(s)); c.stroke();
    }
    // Beach and water.
    c.fillStyle = '#e8d29a';
    c.fillRect(0, toMap(SOL.beachZ), S, S - toMap(SOL.beachZ));
    c.fillStyle = '#2e7fa8';
    c.fillRect(0, toMap(SOL.waterZ), S, S - toMap(SOL.waterZ));
    // Buildings.
    c.fillStyle = '#8f959c';
    for (const b of SOL.city.buildings) {
      c.fillRect(toMap(b.x - b.w / 2), toMap(b.z - b.d / 2), (b.w / span) * S, (b.d / span) * S);
    }
    // Mission target.
    const t = Missions.target();
    if (t) {
      c.fillStyle = '#ffd23e';
      c.beginPath();
      c.arc(toMap(t.x), toMap(t.z), 6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffd23e';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(toMap(t.x), toMap(t.z), 10 + Math.sin(SOL.time * 4) * 2, 0, Math.PI * 2);
      c.stroke();
    }
    // Traffic (white), police (flashing blue/red), player (green arrow).
    c.fillStyle = '#e8e8e8';
    for (const car of Vehicles.traffic) {
      if (car.isPlayer) continue;
      c.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
    }
    for (const car of Police.cars) {
      c.fillStyle = (Math.floor(SOL.time * 6) % 2 === 0) ? '#3a6aff' : '#ff3a3a';
      c.beginPath();
      c.arc(toMap(car.x), toMap(car.z), 3.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#3aff6a';
    c.save();
    c.translate(toMap(px), toMap(pz));
    c.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)));
    c.beginPath();
    c.moveTo(6, 0); c.lineTo(-4, -4); c.lineTo(-4, 4); c.closePath();
    c.fill();
    c.restore();
  },

  updateHUD() {
    const el = (id) => document.getElementById(id);
    const cash = el('cash'); if (cash) cash.textContent = '$' + SOL.cash;
    const stars = el('stars');
    if (stars) stars.textContent = '★'.repeat(SOL.wanted) + '☆'.repeat(SOL.maxWanted - SOL.wanted);
    const health = el('health');
    if (health) { health.style.width = SOL.health + '%'; health.style.background = SOL.health > 50 ? '#3aff6a' : SOL.health > 25 ? '#ffd23e' : '#ff3a3a'; }
    const ammo = el('ammo'); if (ammo) ammo.textContent = 'Ammo ' + SOL.ammo;
    const obj = el('objective'); if (obj) obj.textContent = Missions.objectiveText();
    const speed = el('speed');
    if (speed) {
      const car = Vehicles.playerCar;
      speed.textContent = car ? Math.round(Math.abs(car.speed) * 2.2) + ' km/h' : '';
    }
    const wanted = el('wanted');
    if (wanted) wanted.style.opacity = SOL.wanted > 0 ? '1' : '0.35';
  },

  showScreen(title, text, sub) {
    const scr = document.getElementById('screen');
    const t = document.getElementById('screen-title');
    const tx = document.getElementById('screen-text');
    const sb = document.getElementById('screen-sub');
    if (t) t.textContent = title;
    if (tx) tx.textContent = text;
    if (sb) sb.textContent = sub || '';
    if (scr) scr.style.display = 'flex';
  },

  hideScreen() {
    const scr = document.getElementById('screen');
    if (scr) scr.style.display = 'none';
  },

  showMessage(text, ms) {
    const m = document.getElementById('message');
    if (!m) return;
    m.textContent = text;
    m.style.opacity = '1';
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => { m.style.opacity = '0'; }, ms || 2600);
  },
};
