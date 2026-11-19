// Vehicles: car factory, traffic AI (grid waypoints), and player-car physics.

const CAR_COLORS = [0xc94a4a, 0x4a7ac9, 0xe8e8e8, 0x2c2f34, 0x4a8a4a, 0xc9a44a, 0x8a4ac9, 0x6a7a8a];
const CAR_KINDS = ['sedan', 'taxi', 'van', 'sport'];

function makeCarMesh(kind, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const bodyLen = kind === 'van' ? 5.2 : 4.4;
  const bodyH = kind === 'van' ? 1.7 : 1.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, bodyH, 2.0), bodyMat);
  body.position.y = 0.75;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(kind === 'van' ? 4.6 : 2.3, kind === 'van' ? 0.9 : 0.85, 1.8),
    kind === 'van' ? bodyMat : glassMat
  );
  cabin.position.set(kind === 'van' ? 0 : -0.3, bodyH + 0.45, 0);
  g.add(cabin);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  for (const [wx, wz] of [[1.5, 1.0], [1.5, -1.0], [-1.5, 1.0], [-1.5, -1.0]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2c9, emissive: 0xaa8800 });
  for (const wz of [0.7, -0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.35), headMat);
    h.position.set(bodyLen / 2, 0.8, wz);
    g.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc92a2a, emissive: 0x660000 });
  for (const wz of [0.7, -0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.35), tailMat);
    t.position.set(-bodyLen / 2, 0.8, wz);
    g.add(t);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.35, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x665500 })
    );
    sign.position.set(-0.3, bodyH + 1.15, 0);
    g.add(sign);
  }
  return g;
}

// A car entity: { mesh, x, z, heading, speed, kind, color, isPlayer, route, target }
function makeCar(scene, x, z, heading, kind, color) {
  const mesh = makeCarMesh(kind, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = -heading;
  scene.add(mesh);
  return { mesh, x, z, heading, speed: 0, kind, color, isPlayer: false, route: null, target: null, rng: mulberry32((Math.random() * 1e9) | 0) };
}

const Vehicles = {
  traffic: [],
  playerCar: null,

  spawnTraffic(scene, n) {
    const rng = mulberry32(777001);
    const lines = SOL.city.streetLines;
    for (let i = 0; i < n; i++) {
      const p = SOL.city.randomStreetPoint(rng);
      const kind = RNG.pick(rng, CAR_KINDS);
      const color = kind === 'taxi' ? 0xffd23e : RNG.pick(rng, CAR_COLORS);
      const car = makeCar(scene, p.x, p.z, RNG.pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), kind, color);
      car.speed = RNG.range(rng, 7, 13);
      car.rng = mulberry32(9000 + i * 131);
      // Route: waypoints are street intersections; pick a neighbour to head for.
      car.wp = { x: Math.round(p.x / SOL.pitch) * SOL.pitch, z: Math.round(p.z / SOL.pitch) * SOL.pitch };
      this.pickNextWaypoint(car);
      this.traffic.push(car);
    }
  },

  pickNextWaypoint(car) {
    // From the current waypoint (an intersection), step to a random neighbour.
    const cur = car.wp;
    const dirs = [[SOL.pitch, 0], [-SOL.pitch, 0], [0, SOL.pitch], [0, -SOL.pitch]];
    RNG.shuffle(car.rng, dirs);
    for (const [dx, dz] of dirs) {
      const nx = cur.x + dx, nz = cur.z + dz;
      if (Math.abs(nx) > SOL.half || Math.abs(nz) > SOL.half) continue;
      // Don't immediately reverse.
      if (car.prev && nx === car.prev.x && nz === car.prev.z) continue;
      car.prev = cur;
      car.wp = { x: nx, z: nz };
      return;
    }
    // Dead end: go back the way we came.
    car.prev = cur;
    car.wp = { x: cur.x - (car.wp.x - cur.x), z: cur.z - (car.wp.z - cur.z) };
  },

  updateTraffic(dt) {
    for (const car of this.traffic) {
      if (car.isPlayer) continue;
      const dx = car.wp.x - car.x, dz = car.wp.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 5) { this.pickNextWaypoint(car); continue; }
      const want = Math.atan2(dz, dx);
      car.heading = angleLerp(car.heading, want, clamp(dt * 3.2, 0, 1));
      // Slow down if a car (traffic or the player's) is close ahead.
      let slow = false;
      const allCars = this.playerCar ? [...this.traffic, this.playerCar] : this.traffic;
      for (const other of allCars) {
        if (other === car) continue;
        const ox = other.x - car.x, oz = other.z - car.z;
        const ahead = ox * Math.cos(car.heading) + oz * Math.sin(car.heading);
        const side = Math.abs(-ox * Math.sin(car.heading) + oz * Math.cos(car.heading));
        if (ahead > 0 && ahead < 9 && side < 2.4) { slow = true; break; }
      }
      const target = slow ? 0 : car.speed;
      car._v = car._v === undefined ? car.speed : car._v;
      car._v = lerp(car._v, target, clamp(dt * 1.6, 0, 1));
      car.x += Math.cos(car.heading) * car._v * dt;
      car.z += Math.sin(car.heading) * car._v * dt;
      const fixed = SOL.city.collideCircle(car.x, car.z, 2.2);
      car.x = fixed.x; car.z = fixed.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -car.heading;
    }
  },

  // Player driving (arcade): input {up, down, left, right}.
  updatePlayerCar(dt, input) {
    const car = this.playerCar;
    if (!car) return;
    if (input.up) car.speed += SOL.carAccel * dt;
    if (input.down) car.speed -= SOL.carBrake * dt;
    if (!input.up && !input.down) car.speed = lerp(car.speed, 0, clamp(dt * 1.4, 0, 1));
    car.speed = clamp(car.speed, -14, SOL.carMaxSpeed);
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    car.heading += steer * SOL.carTurn * clamp(Math.abs(car.speed) / 14, 0, 1) * dir * dt;
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.z += Math.sin(car.heading) * car.speed * dt;
    const fixed = SOL.city.collideCircle(car.x, car.z, 2.2);
    if (fixed.x !== car.x || fixed.z !== car.z) car.speed *= 0.55; // bumped a building
    car.x = fixed.x; car.z = fixed.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = -car.heading;
  },

  nearestCar(x, z, maxD) {
    let best = null, bestD = maxD;
    for (const car of this.traffic) {
      if (car.isPlayer) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  },
};
