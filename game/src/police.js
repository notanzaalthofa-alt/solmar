// Police: wanted level, pursuit cars, bust and decay.

const Police = {
  cars: [],
  bustTimer: 0,
  hiddenTimer: 0,

  addWanted(n) {
    SOL.wanted = clamp(SOL.wanted + n, 0, SOL.maxWanted);
    this.hiddenTimer = 0;
  },

  spawnCar(scene, x, z) {
    const car = makeCar(scene, x, z, 0, 'sedan', 0x1a1a1a);
    car.isPolice = true;
    car.speed = 0;
    // Light bar.
    const barMat = new THREE.MeshLambertMaterial({ color: 0x2244cc, emissive: 0x1133aa });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.1), barMat);
    bar.position.set(-0.2, 1.75, 0);
    car.mesh.add(bar);
    car._light = bar;
    this.cars.push(car);
    return car;
  },

  // Keep the number of pursuit cars proportional to the wanted level.
  ensureCars(scene, px, pz) {
    const want = Math.min(SOL.wanted, 3);
    while (this.cars.length < want) {
      const a = Math.random() * Math.PI * 2;
      const d = 55 + Math.random() * 25;
      const p = SOL.city.collideCircle(px + Math.cos(a) * d, pz + Math.sin(a) * d, 2);
      this.spawnCar(scene, p.x, p.z);
    }
    while (this.cars.length > want) {
      const car = this.cars.pop();
      car.mesh.visible = false;
    }
  },

  update(dt, scene, px, pz, inCar) {
    if (SOL.wanted > 0) this.ensureCars(scene, px, pz);
    else {
      // No wanted level: clear pursuit cars.
      for (const car of this.cars) car.mesh.visible = false;
      this.cars.length = 0;
    }

    let nearest = Infinity;
    for (const car of this.cars) {
      if (!car.mesh.visible) car.mesh.visible = true;
      const dx = px - car.x, dz = pz - car.z;
      const d = Math.hypot(dx, dz);
      nearest = Math.min(nearest, d);
      const want = Math.atan2(dz, dx);
      const turnRate = 2.6;
      car.heading = angleLerp(car.heading, want, clamp(dt * turnRate, 0, 1));
      const target = SOL.wanted >= 3 ? 34 : 27;
      car.speed = lerp(car.speed, target, clamp(dt * 1.2, 0, 1));
      car.x += Math.cos(car.heading) * car.speed * dt;
      car.z += Math.sin(car.heading) * car.speed * dt;
      const fixed = SOL.city.collideCircle(car.x, car.z, 2.2);
      car.x = fixed.x; car.z = fixed.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -car.heading;
      // Flashing light bar.
      car._light.material.emissive.setHex((Math.floor(SOL.time * 6) % 2 === 0) ? 0x1133aa : 0xaa1100);
      // Ram the player car.
      if (inCar && d < 4.5) {
        const pc = Vehicles.playerCar;
        if (pc) {
          pc.speed *= 0.94;
          pc.x += (pc.x - car.x) * 0.02;
          pc.z += (pc.z - car.z) * 0.02;
        }
      }
    }

    // Bust: on foot and a police car is right on top of the player.
    if (!inCar && SOL.wanted > 0 && nearest < 3.2) {
      this.bustTimer += dt;
      if (this.bustTimer > 1.1) {
        this.bustTimer = 0;
        return 'busted';
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    // Wanted decay: only while no police car is near.
    if (SOL.wanted > 0 && nearest > 46) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer > 4) SOL.wanted = Math.max(0, SOL.wanted - SOL.wantedDecay * dt * 4);
    } else {
      this.hiddenTimer = 0;
    }
    return null;
  },
};
