// Combat: fists, a pistol, ammo crates, and player health.

const Combat = {
  crates: [],
  punchCooldown: 0,
  shootCooldown: 0,
  muzzle: 0, // frames of muzzle flash left

  build(scene) {
    const rng = mulberry32(424242);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a, emissive: 0x0a2a0a });
    const lidMat = new THREE.MeshLambertMaterial({ color: 0xffd23e });
    for (let i = 0; i < 6; i++) {
      const p = SOL.city.randomStreetPoint(rng);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.4), mat);
      box.position.set(p.x, 0.5, p.z);
      scene.add(box);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 1.5), lidMat);
      lid.position.set(p.x, 1.05, p.z);
      scene.add(lid);
      this.crates.push({ mesh: box, lid, x: p.x, z: p.z, taken: false });
    }
  },

  // Punch: hits the nearest ped or police car within 2.2 units ahead.
  punch(px, pz, heading) {
    if (this.punchCooldown > 0) return null;
    this.punchCooldown = 0.45;
    const fx = Math.cos(heading), fz = Math.sin(heading);
    for (const p of People.list) {
      const dx = p.x - px, dz = p.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < 2.4 && dx * fx + dz * fz > 0) {
        // Knock the ped down (they get up and flee).
        p.flee = 4;
        p.x += fx * 3; p.z += fz * 3;
        Police.addWanted(1);
        return { event: 'punch', target: 'ped' };
      }
    }
    return { event: 'punch', target: null };
  },

  // Pistol: hitscan toward the aim point (world x,z on the ground plane).
  shoot(px, pz, aimX, aimZ) {
    if (this.shootCooldown > 0) return null;
    if (SOL.ammo <= 0) return { event: 'dryfire' };
    this.shootCooldown = 0.28;
    SOL.ammo--;
    this.muzzle = 4;
    const dx = aimX - px, dz = aimZ - pz;
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;
    // Nearest ped or police car along the ray (within a 1.6-unit corridor).
    let best = null, bestD = 60;
    const consider = (x, z, obj) => {
      const rx = x - px, rz = z - pz;
      const along = rx * ux + rz * uz;
      const side = Math.abs(-rx * uz + rz * ux);
      if (along > 1 && along < bestD && side < 1.6) { bestD = along; best = obj; }
    };
    for (const p of People.list) consider(p.x, p.z, { kind: 'ped', ref: p });
    for (const c of Police.cars) consider(c.x, c.z, { kind: 'police', ref: c });
    if (best) {
      if (best.kind === 'ped') {
        best.ref.flee = 5;
        best.ref.x += ux * 2; best.ref.z += uz * 2;
      } else {
        // Shooting a cop car slows it and raises the heat.
        best.ref.speed *= 0.4;
      }
      Police.addWanted(1);
      return { event: 'hit', kind: best.kind, at: { x: px + ux * bestD, z: pz + uz * bestD } };
    }
    return { event: 'shot', at: { x: px + ux * 40, z: pz + uz * 40 } };
  },

  update(dt, px, pz) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.muzzle = Math.max(0, this.muzzle - 1);
    // Ammo crates: walk into one to refill.
    for (const c of this.crates) {
      if (c.taken) continue;
      if (dist2(px, pz, c.x, c.z) < 4) {
        c.taken = true;
        c.mesh.visible = false;
        c.lid.visible = false;
        SOL.ammo = Math.min(24, SOL.ammo + 12);
        return { event: 'ammo', amount: 12 };
      }
    }
    return null;
  },

  damage(n) {
    SOL.health = Math.max(0, SOL.health - n);
    return SOL.health <= 0 ? 'wasted' : null;
  },
};
