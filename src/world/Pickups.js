import * as THREE from 'three';
import { ROAD, PICKUPS, COMBAT } from '../core/constants.js';
import { events } from '../core/Events.js';

const SEG = PICKUPS.spacing;
const BEHIND = PICKUPS.spawnBehind;
const AHEAD = PICKUPS.spawnAhead;
const N = BEHIND + AHEAD + 1;
const WEAPON_KEYS = Object.keys(PICKUPS.weaponWeights);
const WEAPON_WEIGHTS = WEAPON_KEYS.map((k) => PICKUPS.weaponWeights[k]);
const WEAPON_TOTAL = WEAPON_WEIGHTS.reduce((a, b) => a + b, 0);

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function pickWeapon(seed) {
  let r = hash(seed * 97 + 13) * WEAPON_TOTAL;
  for (let i = 0; i < WEAPON_KEYS.length; i++) {
    r -= WEAPON_WEIGHTS[i];
    if (r <= 0) return WEAPON_KEYS[i];
  }
  return WEAPON_KEYS[0];
}
function weaponColor(name) {
  switch (name) {
    case 'pipe': return 0x9aa2a6;
    case 'chain': return 0xe8ff65;
    case 'bat': return 0xd7a968;
    default: return 0xffffff;
  }
}

export class Pickups {
  constructor(scene, track) {
    this.track = track;
    this.start = -1;
    this.p = {};
    this.v = new THREE.Vector3();
    this.dummy = new THREE.Object3D();

    const box = new THREE.BoxGeometry(0.55, 0.25, 0.85);
    const lid = new THREE.BoxGeometry(0.62, 0.08, 0.92);
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x1d2328, roughness: 0.55, metalness: 0.4 });
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x37444d, roughness: 0.5, metalness: 0.55 });
    this.caseMeshes = new THREE.InstancedMesh(box, caseMat, N * 2);
    this.lidMeshes = new THREE.InstancedMesh(lid, lidMat, N * 2);
    this.glowMeshes = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
      N * 2
    );
    for (const m of [this.caseMeshes, this.lidMeshes, this.glowMeshes]) {
      m.castShadow = m.receiveShadow = false;
      m.frustumCulled = false;
      scene.add(m);
    }
    const colorCount = N * 2;
    this.caseColors = new Float32Array(colorCount * 3);
    this.lidColors = new Float32Array(colorCount * 3);
    this.glowColors = new Float32Array(colorCount * 3);
    this.caseColorAttr = new THREE.InstancedBufferAttribute(this.caseColors, 3);
    this.lidColorAttr = new THREE.InstancedBufferAttribute(this.lidColors, 3);
    this.glowColorAttr = new THREE.InstancedBufferAttribute(this.glowColors, 3);
    this.caseMeshes.instanceColor = this.caseColorAttr;
    this.lidMeshes.instanceColor = this.lidColorAttr;
    this.glowMeshes.instanceColor = this.glowColorAttr;
    this.caseMeshes.material.vertexColors = true;
    this.lidMeshes.material.vertexColors = true;
    this.glowMeshes.material.vertexColors = true;
    this.glowColor = new THREE.Color();
    this.caseBase = new THREE.Color(0x1d2328);
    this.lidBase = new THREE.Color(0x37444d);

    this.slots = Array.from({ length: N * 2 }, () => ({
      idx: -1, seed: 0, weapon: 'bat', active: false, s: 0,
      cooldown: 0, bob: Math.random() * Math.PI * 2,
    }));
    this.used = new Uint8Array(N * 2);
  }

  update(dt, bike) {
    const start = Math.max(0, Math.floor(bike.s / SEG) - BEHIND);
    if (start !== this.start) {
      this.start = start;
      let slotIdx = 0;
      for (let i = start; i < start + N; i++) {
        for (const side of [-1, 1]) {
          const slot = this.slots[slotIdx];
          const seed = i * 2 + (side > 0 ? 1 : 0);
          if (slot.idx !== seed) {
            slot.idx = seed;
            slot.seed = seed;
            slot.weapon = pickWeapon(seed);
            slot.active = hash(seed) < PICKUPS.perSideChance;
            slot.s = (i + 0.5) * SEG;
            slot.cooldown = 0;
            slot.bob = hash(seed + 5) * Math.PI * 2;
          }
          slotIdx++;
        }
      }
    }

    const playerS = bike.s;
    const bikeLat = bike.lat;
    const tr2 = PICKUPS.triggerRadius * PICKUPS.triggerRadius;
    const inner = ROAD.width / 2 - PICKUPS.halfRoadInset;

    for (let k = 0; k < this.slots.length; k++) {
      const slot = this.slots[k];
      if (slot.cooldown > 0) slot.cooldown = Math.max(0, slot.cooldown - dt);
      slot.bob += dt * PICKUPS.bobFreq;
      this.used[k] = 0;
      if (slot.idx < 0 || !slot.active) continue;
      const behind = slot.s < playerS - SEG * (BEHIND + 0.5);
      const ahead = slot.s > playerS + SEG * (AHEAD + 0.5);
      if (behind || ahead) continue;
      const side = slot.idx % 2 === 0 ? -1 : 1;
      const lat = side * inner;
      this.track.pointAt(slot.s, lat, this.v);
      this.v.y = 0.3 + Math.sin(slot.bob) * PICKUPS.bobAmp;
      this.dummy.position.copy(this.v);
      const h = this.track.at(slot.s, this.p).h;
      this.dummy.rotation.y = h;
      this.dummy.updateMatrix();
      this.caseMeshes.setMatrixAt(k, this.dummy.matrix);
      this.dummy.position.y = 0.53 + Math.sin(slot.bob) * PICKUPS.bobAmp;
      this.dummy.updateMatrix();
      this.lidMeshes.setMatrixAt(k, this.dummy.matrix);
      this.glowColor.setHex(weaponColor(slot.weapon));
      this.glowColors[k * 3] = this.glowColor.r;
      this.glowColors[k * 3 + 1] = this.glowColor.g;
      this.glowColors[k * 3 + 2] = this.glowColor.b;
      this.caseColors[k * 3] = this.caseBase.r;
      this.caseColors[k * 3 + 1] = this.caseBase.g;
      this.caseColors[k * 3 + 2] = this.caseBase.b;
      const lidMix = 0.65;
      this.lidColors[k * 3] = this.lidBase.r * (1 - lidMix) + this.glowColor.r * lidMix;
      this.lidColors[k * 3 + 1] = this.lidBase.g * (1 - lidMix) + this.glowColor.g * lidMix;
      this.lidColors[k * 3 + 2] = this.lidBase.b * (1 - lidMix) + this.glowColor.b * lidMix;
      this.dummy.position.y = 0.5 + Math.sin(slot.bob) * PICKUPS.bobAmp;
      this.dummy.scale.setScalar(slot.cooldown > 0 ? 0 : 1);
      this.dummy.updateMatrix();
      this.glowMeshes.setMatrixAt(k, this.dummy.matrix);
      this.used[k] = 1;

      if (slot.cooldown <= 0) {
        const dx = this.v.x - bike.body.position.x;
        const dz = this.v.z - bike.body.position.z;
        if (dx * dx + dz * dz < tr2) {
          slot.cooldown = PICKUPS.respawnCooldown;
          if (slot.weapon !== 'bat' || bike.melee.weaponName !== slot.weapon) {
            bike.melee.setWeapon(slot.weapon);
            events.emit('pickup', { rider: bike, weapon: slot.weapon });
          } else {
            events.emit('pickup', { rider: bike, weapon: slot.weapon, refill: true });
          }
          bike.stamina = COMBAT.maxStamina;
          bike.invuln = Math.max(bike.invuln, COMBAT.pickupFlash);
          bike.staminaDelay = 0;
        }
      }
    }

    this.caseMeshes.count = this.lidMeshes.count = this.glowMeshes.count = 0;
    for (let k = 0; k < this.slots.length; k++) {
      if (!this.used[k]) continue;
      this.caseMeshes.count = this.lidMeshes.count = this.glowMeshes.count = k + 1;
    }
    this.caseMeshes.instanceMatrix.needsUpdate = true;
    this.lidMeshes.instanceMatrix.needsUpdate = true;
    this.glowMeshes.instanceMatrix.needsUpdate = true;
    this.caseColorAttr.needsUpdate = true;
    this.lidColorAttr.needsUpdate = true;
    this.glowColorAttr.needsUpdate = true;
  }
}
