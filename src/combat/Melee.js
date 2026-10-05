import * as THREE from 'three';
import { COMBAT } from '../core/constants.js';
import { events } from '../core/Events.js';

const ease = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const DEBUG = location.search.includes('debug');

export class Melee {
  constructor(owner, leanGroup, root) {
    this.owner = owner;
    this.state = 'idle';
    this.t = 0;
    this.side = 1;          // -1 left, +1 right
    this.hit = new Set();   // targets already struck by this swing
    this.arms = {};
    this.bufferSide = 0;
    this.bufferTime = 0;

    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.22, 1.15, 0.05);
      const geo = new THREE.CylinderGeometry(0.045, 0.075, 1, 10);
      geo.rotateZ(-side * Math.PI / 2);
      geo.translate(side * 0.5, 0, 0); // pivot at the shoulder
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xbfc9d1, metalness: 0.75, roughness: 0.28 }));
      mesh.castShadow = true;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.095, 0.095), new THREE.MeshStandardMaterial({ color: 0x20272b }));
      grip.position.x = side * 0.18;
      arm.add(mesh, grip);
      arm.visible = false;
      leanGroup.add(arm);
      const trail = new THREE.Mesh(new THREE.RingGeometry(0.35, 1, 24, 1, -0.9, 1.8),
        new THREE.MeshBasicMaterial({ color: 0xe8ff65, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
      trail.rotation.set(Math.PI / 2, 0, side < 0 ? Math.PI : 0);
      trail.position.set(side * 0.22, 1.15, 0.05);
      trail.visible = false;
      leanGroup.add(trail);
      this.arms[side] = { arm, mesh, trail };
    }

    if (DEBUG) {
      this.dbg = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.4, 1),
        new THREE.MeshBasicMaterial({ color: 0xff3366, wireframe: true })
      );
      this.dbg.visible = false;
      root.add(this.dbg);
    }
    this.setWeapon('bat');
  }

  get weapon() { return COMBAT.weapons[this.weaponName]; }
  get active() { return this.state === 'active'; }
  get progress() { return Math.min(1, this.t / this.weapon.active); }

  setWeapon(name) {
    this.weaponName = name;
    for (const side of [-1, 1]) {
      this.arms[side].mesh.scale.x = this.weapon.length;
      this.arms[side].trail.scale.setScalar(this.weapon.length);
    }
  }

  tryStart(side) {
    const w = this.weapon;
    if (this.owner.down || this.owner.stagger > 0) return false;
    if (this.state !== 'idle') {
      if (this.state === 'recovery') { this.bufferSide = side; this.bufferTime = COMBAT.inputBuffer; }
      return false;
    }
    if (this.owner.stamina < w.cost) return false;
    this.owner.stamina -= w.cost;
    this.owner.staminaDelay = COMBAT.regenDelay;
    this.state = 'windup';
    this.t = 0;
    this.side = side;
    this.hit.clear();
    events.emit('swing', { rider: this.owner, side });
    return true;
  }

  cancel() {
    this.state = 'idle';
    this.t = 0;
    this.bufferSide = 0; this.bufferTime = 0;
    this.arms[-1].arm.visible = this.arms[1].arm.visible = false;
    this.arms[-1].trail.visible = this.arms[1].trail.visible = false;
    if (this.dbg) this.dbg.visible = false;
  }

  update(dt) {
    this.bufferTime = Math.max(0, this.bufferTime - dt);
    if (this.state === 'idle') return;
    const w = this.weapon;
    this.t += dt;
    if (this.state === 'windup' && this.t >= w.windup) { this.state = 'active'; this.t -= w.windup; }
    if (this.state === 'active' && this.t >= w.active) { this.state = 'recovery'; this.t -= w.active; }
    if (this.state === 'recovery' && this.t >= w.recovery) {
      const buffered = this.bufferTime > 0 ? this.bufferSide : 0;
      this.cancel();
      if (buffered) this.tryStart(buffered);
    }
  }

  // Render-side animation. For a swing on `side`, rotation.y = side * theta sweeps back -> forward.
  pose() {
    if (this.state === 'idle') return;
    const w = this.weapon;
    let theta;
    if (this.state === 'windup') theta = -0.2 + (-0.9 + 0.2) * ease(this.t / w.windup);
    else if (this.state === 'active') theta = -0.9 + 1.8 * ease(this.progress);
    else theta = 0.9 + (0.2 - 0.9) * ease(this.t / w.recovery);

    for (const side of [-1, 1]) {
      const a = this.arms[side].arm;
      this.arms[side].trail.visible = this.active && side === this.side;
      a.visible = side === this.side;
      if (a.visible) a.rotation.y = side * theta;
    }

    if (this.dbg) {
      this.dbg.visible = this.active;
      if (this.active) {
        const width = w.reach + COMBAT.targetHalfWidth - w.inner, depth = 2 * (w.halfLen + COMBAT.targetHalfLength);
        const fwd = w.back + (w.front - w.back) * this.progress;
        this.dbg.scale.set(width, 1, depth);
        this.dbg.position.set(this.side * (w.inner + w.reach + COMBAT.targetHalfWidth) / 2, 0.6, -fwd);
      }
    }
  }
}