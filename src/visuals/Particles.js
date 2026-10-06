import * as THREE from 'three';
import { events } from '../core/Events.js';
import { FX } from '../core/constants.js';

const SIDES = [-0.18, 0.18], CONTACTS = [-0.7, 0.7];
const SMOKE_VEL = { x: 0, y: 0.5, z: 0 }, SPARK_VEL = { x: 0, y: 2, z: 0 };

function PooledParticle() {
  this.life = 0; this.maxLife = 1;
  this.x = 0; this.y = 0; this.z = 0;
  this.vx = 0; this.vy = 0; this.vz = 0;
  this.size = 0.1; this.grow = 0; this.fade = 1;
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.tmp = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.rgt = new THREE.Vector3();

    const smokeGeo = new THREE.PlaneGeometry(1, 1);
    const pixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4, radius = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
      pixels[i + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 255);
    }
    const smokeTexture = new THREE.DataTexture(pixels, 32, 32);
    smokeTexture.needsUpdate = true;
    this.smokeMat = new THREE.MeshBasicMaterial({
      map: smokeTexture, color: 0xadb5b9, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.NormalBlending,
    });
    this.smokes = [];
    for (let i = 0; i < FX.smokeMax; i++) {
      const m = new THREE.Mesh(smokeGeo, this.smokeMat.clone());
      m.visible = false; m.frustumCulled = false;
      scene.add(m);
      this.smokes.push({ mesh: m, p: new PooledParticle() });
    }
    this.smokeIdx = 0;
    this.smokeTimer = 0;

    const sparkGeo = new THREE.BoxGeometry(1, 1, 1);
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfff08a, transparent: true, opacity: 1, depthWrite: false,
    });
    this.sparks = [];
    for (let i = 0; i < FX.sparkMax; i++) {
      const m = new THREE.Mesh(sparkGeo, this.sparkMat.clone());
      m.visible = false; m.frustumCulled = false;
      scene.add(m);
      this.sparks.push({ mesh: m, p: new PooledParticle() });
    }
    this.sparkIdx = 0;
    this.sparkTimer = 0;
    events.on('raceReset', () => this.reset());
    events.on('impact', ({ rider, speed }) => {
      if (speed < 3) return;
      this.tmp.set(rider.body.position.x, 0.4, rider.body.position.z);
      this.emitSparks(Math.min(25, 8 + Math.floor(speed)), this.tmp, SPARK_VEL, 0.6, FX.sparkLife);
    });
    events.on('hit', ({ target }) => {
      this.tmp.set(target.body.position.x, target.body.position.y + 0.6, target.body.position.z);
      this.emitSparks(16, this.tmp, SPARK_VEL, 0.35, FX.sparkLife);
    });
  }

  reset() {
    this.sparkTimer = this.smokeTimer = 0;
    for (const pool of [this.smokes, this.sparks]) for (const slot of pool) { slot.p.life = 0; slot.mesh.visible = false; }
  }

  emitSmoke(count, pos, vel, spread, startSize, grow, life) {
    for (let i = 0; i < count; i++) {
      const slot = this.smokes[this.smokeIdx];
      this.smokeIdx = (this.smokeIdx + 1) % this.smokes.length;
      const p = slot.p;
      p.maxLife = life * (0.8 + Math.random() * 0.5);
      p.life = p.maxLife;
      p.x = pos.x + (Math.random() - 0.5) * spread;
      p.y = pos.y + Math.random() * spread * 0.5;
      p.z = pos.z + (Math.random() - 0.5) * spread;
      p.vx = vel.x + (Math.random() - 0.5) * spread * 2;
      p.vy = vel.y + Math.random() * 1.5;
      p.vz = vel.z + (Math.random() - 0.5) * spread * 2;
      p.size = startSize * (0.8 + Math.random() * 0.4);
      p.grow = grow;
      slot.mesh.position.set(p.x, p.y, p.z);
      slot.mesh.scale.setScalar(p.size);
      slot.mesh.visible = true;
    }
  }

  emitSparks(count, pos, vel, spread, life) {
    for (let i = 0; i < count; i++) {
      const slot = this.sparks[this.sparkIdx];
      this.sparkIdx = (this.sparkIdx + 1) % this.sparks.length;
      const p = slot.p;
      p.maxLife = life * (0.6 + Math.random() * 0.8);
      p.life = p.maxLife;
      p.x = pos.x; p.y = pos.y; p.z = pos.z;
      const ang = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 0.6 + 0.4) * FX.sparkSpeed;
      p.vx = vel.x + Math.cos(ang) * spread * speed;
      p.vy = vel.y + Math.random() * speed;
      p.vz = vel.z + Math.sin(ang) * spread * speed;
      p.size = 0.05 + Math.random() * 0.04;
      slot.mesh.position.set(p.x, p.y, p.z);
      slot.mesh.scale.setScalar(p.size);
      slot.mesh.visible = true;
    }
  }

  _updatePool(list, dt, gravity, camera) {
    for (const item of list) {
      const p = item.p;
      if (p.life <= 0) { item.mesh.visible = false; continue; }
      p.life -= dt;
      if (p.life <= 0) { item.mesh.visible = false; continue; }
      const t = 1 - p.life / p.maxLife;
      p.vy -= gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const drag = Math.exp(-0.9 * dt);
      p.vx *= drag; p.vz *= drag;
      const size = p.size + p.grow * t;
      item.mesh.position.set(p.x, p.y, p.z);
      item.mesh.scale.set(size, size, camera ? size : size * 4);
      item.mesh.material.opacity = Math.max(0, (1 - t) * 0.78);
      if (camera) item.mesh.lookAt(camera.position);
    }
  }

  update(dt, riders, impactEvent, camera = null) {
    if (dt <= 0) return;
    this._updatePool(this.smokes, dt, -1.0, camera);
    this._updatePool(this.sparks, dt, 6.2);

    for (const rider of riders) {
      if (rider.down) continue;
      this.fwd.set(-Math.sin(rider.yaw), 0, -Math.cos(rider.yaw));
      this.rgt.set(Math.cos(rider.yaw), 0, -Math.sin(rider.yaw));
      for (const s of SIDES) {
        for (const fwdOff of CONTACTS) {
          this.tmp.copy(rider.body.position)
            .addScaledVector(this.fwd, fwdOff)
            .addScaledVector(this.rgt, s);
          this.tmp.y = 0.15;
          const slip = Math.abs(rider.drift) > FX.slipThreshold || rider.offRoad;
          const slipOk = slip && rider.speed > FX.slipSmokeMinSpeed;
          const scrapeOk = rider.scraping && rider.speed > FX.railScrapeMinSpeed;
          if (slipOk) {
            const amt = (rider.offRoad ? 1.6 : 0.9) * Math.max(0.5, Math.min(2, Math.abs(rider.drift) / (FX.slipThreshold + 0.3)));
            this.smokeTimer += dt * FX.smokeRate * amt;
            while (this.smokeTimer >= 1) {
              this.smokeTimer -= 1;
              this.emitSmoke(1, this.tmp, SMOKE_VEL, 0.15,
                rider.offRoad ? 0.35 : 0.25, FX.smokeGrow * (rider.offRoad ? 0.9 : 0.6), FX.smokeLife * (rider.offRoad ? 1.3 : 1));
            }
          }
          if (scrapeOk) {
            this.sparkTimer += dt * FX.sparkRate;
            while (this.sparkTimer >= 1) {
              this.sparkTimer -= 1;
              this.emitSparks(1, this.tmp, SPARK_VEL, 1.6, FX.sparkLife);
            }
          }
        }
      }
    }
  }
}
