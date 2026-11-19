// Solmar city generation: grid streets, seeded buildings, beach, marina.
// Builds the three.js scene's static world and exposes collision data.

function makeFacadeTexture(rng, base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Window grid, some lit.
  const cols = 4, rows = 10;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 10 + col * 28, y = 12 + r * 24;
      g.fillStyle = rng() < 0.28 ? lit : 'rgba(20,30,44,0.85)';
      g.fillRect(x, y, 18, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const span = SOL.half * 2 + 80; // world units covered by the texture
  const toPx = (v) => ((v + span / 2) / span) * S;
  // Asphalt base.
  g.fillStyle = '#43484f';
  g.fillRect(0, 0, S, S);
  // Sidewalk blocks (light) between streets.
  g.fillStyle = '#8f959c';
  const streets = [];
  for (let i = -5; i <= 5; i++) streets.push(i * SOL.pitch);
  for (let i = 0; i < streets.length - 1; i++) {
    for (let j = 0; j < streets.length - 1; j++) {
      const x0 = streets[i] + SOL.street / 2, x1 = streets[i + 1] - SOL.street / 2;
      const z0 = streets[j] + SOL.street / 2, z1 = streets[j + 1] - SOL.street / 2;
      g.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
    }
  }
  // Lane dashes.
  g.fillStyle = '#e8e4d2';
  for (const s of streets) {
    for (let v = -SOL.half; v < SOL.half; v += 16) {
      g.fillRect(toPx(s) - 1.5, toPx(v), 3, 8);
      g.fillRect(toPx(v), toPx(s) - 1.5, 8, 3);
    }
  }
  // Beach (south) and marina apron (east).
  g.fillStyle = '#e8d29a';
  g.fillRect(0, toPx(SOL.beachZ), S, S - toPx(SOL.beachZ));
  g.fillStyle = '#7a6a4a';
  g.fillRect(toPx(SOL.marinaX), 0, S - toPx(SOL.marinaX), S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildCity(scene) {
  const rng = RNG.world;
  const city = { colliders: [], buildings: [], palms: [], lamps: [], boats: [] };

  // Lighting.
  const sun = new THREE.DirectionalLight(0xfff2c9, 1.6);
  sun.position.set(120, 220, 80);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9e8, 0.75));
  scene.fog = new THREE.Fog(0x8ec9e8, 320, 720);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SOL.half * 2 + 80, SOL.half * 2 + 80),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Water (south) and a second strip so the horizon reads as sea.
  const waterMat = new THREE.MeshLambertMaterial({ color: SOL.water, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(SOL.half * 2 + 80, 120), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.15, SOL.waterZ + 55);
  scene.add(water);
  city.water = water;

  // Facade textures (three variants, seeded).
  const facades = [
    makeFacadeTexture(rng, '#5a6b7d', '#ffe9a8'),
    makeFacadeTexture(rng, '#8a6a52', '#ffd98a'),
    makeFacadeTexture(rng, '#4f7a6a', '#e8ffb0'),
    makeFacadeTexture(rng, '#7d5a6b', '#ffc9d6'),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });

  // Buildings: one per block cell, downtown taller.
  const streets = [];
  for (let i = -5; i <= 5; i++) streets.push(i * SOL.pitch);
  const palette = ['#c9a86a', '#a8b8c9', '#c98a6a', '#8ac9a8', '#d6c9a8', '#9a8ac9'];
  for (let i = 0; i < streets.length - 1; i++) {
    for (let j = 0; j < streets.length - 1; j++) {
      const cx = (streets[i] + streets[i + 1]) / 2;
      const cz = (streets[j] + streets[j + 1]) / 2;
      // The bank landmark occupies the (0, -175) block; skip the regular building there.
      if (cx === 0 && cz === -175) continue;
      const downtown = Math.abs(cx) < 110 && Math.abs(cz) < 110;
      const h = downtown ? RNG.range(rng, 22, 64) : RNG.range(rng, 7, 24);
      const w = RNG.range(rng, 22, 32), d = RNG.range(rng, 22, 32);
      const tex = RNG.pick(rng, facades);
      const mat = new THREE.MeshLambertMaterial({ map: tex, color: RNG.pick(rng, palette) });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx + RNG.range(rng, -2, 2), h / 2, cz + RNG.range(rng, -2, 2));
      scene.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1, d + 1), roofMat);
      roof.position.set(b.position.x, h + 0.5, b.position.z);
      scene.add(roof);
      city.buildings.push({ mesh: b, x: b.position.x, z: b.position.z, w, d, h });
      city.colliders.push({
        minX: b.position.x - w / 2 - 0.4, maxX: b.position.x + w / 2 + 0.4,
        minZ: b.position.z - d / 2 - 0.4, maxZ: b.position.z + d / 2 + 0.4,
      });
    }
  }

  // Landmark: the bank (mission 5) — a wide pale tower in the (0, -175) block.
  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(30, 34, 24),
    new THREE.MeshLambertMaterial({ map: facades[0], color: '#e8e0c8' })
  );
  bank.position.set(0, 17, -175);
  scene.add(bank);
  city.bank = { x: 0, z: -175 };
  city.colliders.push({ minX: -15.4, maxX: 15.4, minZ: -187.4, maxZ: -162.6 });

  // Palms along the beach and a few streets.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
  for (let k = 0; k < 46; k++) {
    const onBeach = k < 30;
    const x = onBeach ? RNG.range(rng, -240, 240) : RNG.pick(rng, streets) + RNG.range(rng, -6, 6);
    const z = onBeach ? RNG.range(rng, SOL.beachZ + 4, SOL.beachZ + 22) : RNG.range(rng, -240, 240);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat);
    crown.position.set(x, 8.2, z);
    scene.add(crown);
    city.palms.push({ x, z });
  }

  // Street lamps.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f34 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xcc9900 });
  for (let k = 0; k < 36; k++) {
    const x = RNG.pick(rng, streets) + 8;
    const z = RNG.range(rng, -240, 240);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 5), poleMat);
    pole.position.set(x, 3, z);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
    head.position.set(x, 6.2, z);
    scene.add(head);
    city.lamps.push({ x, z });
  }

  // Marina: wooden docks and moored boats (east edge).
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (let k = 0; k < 4; k++) {
    const z = -150 + k * 100;
    const dock = new THREE.Mesh(new THREE.BoxGeometry(26, 1, 6), dockMat);
    dock.position.set(SOL.marinaX + 12, 0.5, z);
    scene.add(dock);
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.4, 5),
      new THREE.MeshLambertMaterial({ color: RNG.pick(rng, [0xe8e8e8, 0x2a6a8a, 0xc94a4a]) })
    );
    hull.position.set(SOL.marinaX + 14, 1.4, z + 12);
    scene.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 3.6), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    cabin.position.set(SOL.marinaX + 14, 3.4, z + 12);
    scene.add(cabin);
    city.boats.push({ x: SOL.marinaX + 14, z: z + 12 });
  }

  // Helpers.
  city.isOnRoad = function (x, z) {
    // On a street if within half a street width of a street line.
    for (const s of streets) {
      if (Math.abs(x - s) < SOL.street / 2 + 1) return true;
      if (Math.abs(z - s) < SOL.street / 2 + 1) return true;
    }
    return false;
  };
  city.streetLines = streets;
  city.collideCircle = function (x, z, r) {
    // Push a circle out of building colliders; returns corrected {x, z}.
    for (const c of city.colliders) {
      const nx = clamp(x, c.minX, c.maxX), nz = clamp(z, c.minZ, c.maxZ);
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-6) { x = c.maxX + r; continue; }
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      }
    }
    // Keep inside the playable bounds (beach edge, marina edge, north wall).
    x = clamp(x, -SOL.half - 30, SOL.marinaX + 20);
    z = clamp(z, -SOL.half - 30, SOL.beachZ + 24);
    return { x, z };
  };
  city.randomStreetPoint = function (rng2) {
    const s = RNG.pick(rng2, streets);
    const along = RNG.range(rng2, -230, 230);
    return rng2() < 0.5 ? { x: s, z: along } : { x: along, z: s };
  };

  SOL.city = city;
  return city;
}
