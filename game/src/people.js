// Pedestrians: walkers on the sidewalks who flee from gunfire and cars.

function makePedMesh(shirt, pants) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.36), shirtMat);
  body.position.y = 1.15;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.85;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), pantsMat);
  legL.position.set(-0.16, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.2), shirtMat);
  armL.position.set(-0.42, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  return g;
}

const People = {
  list: [],
  shirts: [0xc94a4a, 0x4a7ac9, 0x4a8a4a, 0xe8d23e, 0x8a4ac9, 0xe8e8e8, 0x2c2f34, 0xc97a4a],

  spawn(scene, n) {
    const rng = mulberry32(555002);
    for (let i = 0; i < n; i++) {
      const p = SOL.city.randomStreetPoint(rng);
      // Put them on a sidewalk (offset from the street line).
      const onX = rng() < 0.5;
      const mesh = makePedMesh(RNG.pick(rng, this.shirts), RNG.pick(rng, [0x2c2f34, 0x4a4a5a, 0x6a5a4a]));
      mesh.position.set(p.x, 0, p.z);
      scene.add(mesh);
      this.list.push({
        mesh, x: p.x, z: p.z,
        heading: RNG.pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
        speed: RNG.range(rng, 1.2, 2.4),
        rng: mulberry32(3000 + i * 77),
        flee: 0, // seconds of fleeing left
        walkPhase: rng() * Math.PI * 2,
      });
    }
  },

  update(dt, playerX, playerZ, gunshotAt) {
    for (const p of this.list) {
      // Flee from a recent gunshot or a car bearing down.
      if (gunshotAt && dist2(p.x, p.z, gunshotAt.x, gunshotAt.z) < 900) p.flee = 2.5;
      if (p.flee > 0) {
        p.flee -= dt;
        const away = Math.atan2(p.z - playerZ, p.x - playerX);
        p.heading = angleLerp(p.heading, away, clamp(dt * 4, 0, 1));
        p.speed = 5.2;
      } else {
        p.speed = lerp(p.speed, 1.8, clamp(dt, 0, 1));
        // Wander: occasionally pick a new street-aligned heading.
        if (p.rng() < dt * 0.12) {
          p.heading = RNG.pick(p.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
        }
      }
      p.x += Math.cos(p.heading) * p.speed * dt;
      p.z += Math.sin(p.heading) * p.speed * dt;
      const fixed = SOL.city.collideCircle(p.x, p.z, 0.6);
      p.x = fixed.x; p.z = fixed.z;
      // Walk cycle (legs swing).
      p.walkPhase += dt * p.speed * 2.4;
      const swing = Math.sin(p.walkPhase) * 0.35;
      p.mesh.children[2].rotation.x = swing;
      p.mesh.children[3].rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = -p.heading;
    }
  },
};
