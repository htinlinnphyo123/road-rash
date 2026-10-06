import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BIKE, ROAD, WALL, GROUP, COMBAT } from '../core/constants.js';
import { events } from '../core/Events.js';
import { Melee } from '../combat/Melee.js';
import { makeWheel, makeMotorcycle } from '../visuals/Vehicles.js';
import { Ragdoll } from '../combat/Ragdoll.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const WHEEL_R = 0.33;
const NEUTRAL = Object.freeze({ throttle: 0, brake: 0, steer: 0 });

export class Rider {
  constructor(scene, physics, track, { color = 0xb01e1e, shirt = 0x222a44 } = {}) {
    this.track = track;
    this.isPlayer = false;

    // Track-space state
    this.speed = 0; this.yaw = 0; this.relYaw = 0;
    this.s = 0; this.lat = 0; this.drift = 0;
    this.offRoad = false; this.scraping = false;
    this.tp = {}; this.v3 = new THREE.Vector3();
    this._inp = { throttle: 0, brake: 0, steer: 0, attackL: false, attackR: false };
    this._stag = { throttle: 0, brake: 0, steer: 0 };

    // Combat state
    this.health = BIKE.maxHealth;
    this.stamina = COMBAT.maxStamina;
    this.balance = COMBAT.maxBalance;
    this.staminaDelay = 0;
    this.stagger = 0;
    this.invuln = 0;
    this.impactCd = 0;
    this.down = false; this.downT = 0; this.fallSide = 1;
    this.knockX = 0; this.knockZ = 0;
    this.vx = 0; this.vz = 0; // intended world velocity (pre-solver)
    this.leanTarget = 0; this.lean = 0;

    this.body = new CANNON.Body({
      mass: BIKE.mass,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.5, 0.9)),
      position: new CANNON.Vec3(0, 0.6, 0),
      fixedRotation: true,
      linearDamping: 0,
      material: physics.bikeMaterial,
      collisionFilterGroup: GROUP.BIKE,
      collisionFilterMask: GROUP.WORLD | GROUP.BIKE | GROUP.TRAFFIC,
    });
    this.body.userData = { kind: 'bike', entity: this };
    this.body.updateMassProperties();
    this.body.addEventListener('collide', (e) => this.onCollide(e));
    physics.world.addBody(this.body);

    this.prevPos = new THREE.Vector3(0, 0.6, 0);
    this.currPos = this.prevPos.clone();
    this.prevYaw = 0; this.currYaw = 0;
    this.position = this.prevPos.clone();
    this.renderYaw = 0;

    // Visuals
    this.mesh = new THREE.Group();
    this.leanGroup = new THREE.Group();
    this.mesh.add(this.leanGroup);

    this.riderMesh = makeMotorcycle(this.leanGroup, color, shirt);

    this.frontWheel = makeWheel(); this.frontWheel.position.set(0, WHEEL_R, -0.7);
    this.rearWheel = makeWheel(); this.rearWheel.position.set(0, WHEEL_R, 0.7);

    this.leanGroup.add(this.frontWheel, this.rearWheel);
    this.mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.mesh);

    this.melee = new Melee(this, this.leanGroup, this.mesh);
    this.ragdoll = new Ragdoll(scene, shirt);
  }

  // Override in subclasses
  think(dt) { return NEUTRAL; }

  fixedUpdate(dt) { this.preStep(dt, this.think(dt)); }

  placeAt(s, lat, speed = 0) {
    const h = this.track.at(s, this.tp).h;
    this.track.pointAt(s, lat, this.v3);
    this.body.position.set(this.v3.x, 0.6, this.v3.z);
    this.body.velocity.setZero();
    this.body.aabbNeedsUpdate = true;
    this.s = s; this.lat = lat;
    this.yaw = h; this.relYaw = 0; this.drift = 0;
    this.speed = speed;
    this.knockX = this.knockZ = this.vx = this.vz = 0;
    this.currPos.set(this.v3.x, 0.6, this.v3.z);
    this.prevPos.copy(this.currPos);
    this.currYaw = this.prevYaw = h;
  }

  resetRace(s, lat) {
    this.placeAt(s, lat, 0);
    this.health = BIKE.maxHealth; this.stamina = COMBAT.maxStamina; this.balance = COMBAT.maxBalance;
    this.staminaDelay = this.stagger = this.invuln = this.impactCd = this.downT = 0;
    this.down = false; this.lean = this.leanTarget = 0;
    this.offRoad = this.scraping = false;
    this.riderMesh.visible = this.mesh.visible = true;
    this.melee.cancel(); this.ragdoll.hide();
    if (this.isPlayer) this.rideTime = 0;
    if (this.attackCooldown !== undefined) this.attackCooldown = 0;
    this.body.force.setZero(); this.body.torque.setZero();
    this.body.quaternion.setFromEuler(0, this.yaw, 0);
    this.body.angularVelocity.setZero();
    this.render(1, 0);
  }

  receiveHit({ nx, nz, damage, knock, stagger, attacker }) {
    if (this.down || this.invuln > 0) return false;
    this.health = Math.max(0, this.health - damage);
    this.balance -= COMBAT.balancePerHit;
    this.knockX += nx * knock;
    this.knockZ += nz * knock;
    this.speed = Math.max(0, this.speed - knock * 0.5);
    this.stagger = Math.max(this.stagger, stagger);
    this.melee.cancel(); // getting hit interrupts your swing
    if (this.health <= 0 || this.balance <= 0) this.dismount(nx * knock * 0.8, nz * knock * 0.8, attacker);
    return true;
  }

  dismount(kx = 0, kz = 0, attacker = null) {
    if (this.down) return;
    this.down = true;
    this.downT = COMBAT.respawnDelay;
    this.fallSide = Math.random() < 0.5 ? -1 : 1;
    this.melee.cancel();
    this.speed *= 0.6;
    this.riderMesh.visible = false;
    this.ragdoll.launch(this.body.position, this.vx * 0.8 + kx, 6 + this.speed * 0.1, this.vz * 0.8 + kz);
    events.emit('dismount', { rider: this, attacker });
  }

  respawn() {
    this.placeAt(this.s, clamp(this.lat, -4.5, 4.5), 0);
    this.health = BIKE.maxHealth;
    this.stamina = COMBAT.maxStamina;
    this.balance = COMBAT.maxBalance;
    this.stagger = 0;
    this.down = false;
    this.invuln = COMBAT.invuln;
    this.lean = this.leanTarget = 0;
    this.riderMesh.visible = true;
    this.ragdoll.hide();
    events.emit('respawn', { rider: this });
  }

  onCollide(e) {
    const other = e.body;
    const kind = other.userData?.kind;
    if (!kind || this.impactCd > 0 || this.down) return; // ground has no kind

    const c = e.contact;
    const sign = c.bi === this.body ? -1 : 1;
    let nx = c.ni.x * sign, nz = c.ni.z * sign;
    const len = Math.hypot(nx, nz);
    if (len < 1e-3) return;
    nx /= len; nz /= len;

    const oe = other.userData.entity;
    const ovx = oe?.vx !== undefined ? oe.vx : other.velocity.x;
    const ovz = oe?.vx !== undefined ? oe.vz : other.velocity.z;
    const impact = -((this.vx - ovx) * nx + (this.vz - ovz) * nz);
    if (impact < 1.5) return;
    this.impactCd = 0.2;

    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const head = Math.abs(nx * fx + nz * fz);
    const bounce = kind === 'wall' ? 0.35 : kind === 'bike' ? 0.4 : 0.5;

    this.knockX += nx * impact * bounce;
    this.knockZ += nz * impact * bounce;
    this.speed = Math.max(0, this.speed - impact * (0.9 * head + 0.15));
    this.relYaw *= 0.5;

    let damage = 0, crash = false;
    if (this.invuln <= 0) {
      const mult = kind === 'wall' ? 0.8 : kind === 'bike' ? 0.5 : 1.4;
      damage = Math.max(0, impact - 8) * mult;
      this.health = Math.max(0, this.health - damage);
      crash = impact > BIKE.crashSpeed * (kind === 'bike' ? 1.4 : 1);
      if (crash) this.speed *= 0.3;
      if (crash || this.health <= 0) this.dismount(nx * impact * 0.6, nz * impact * 0.6, null);
    }
    events.emit('impact', { rider: this, kind, speed: impact, damage, nx, nz, crash, other });
  }

  preStep(dt, inp) {
    const B = BIKE, hw = ROAD.width / 2, track = this.track;
    if (this.impactCd > 0) this.impactCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.stagger > 0) this.stagger -= dt;
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else this.stamina = Math.min(COMBAT.maxStamina, this.stamina + COMBAT.staminaRegen * dt);

    let c = inp;
    if (this.down) {
      c = NEUTRAL;
      this.downT -= dt;
      if (this.downT <= 0) { this.respawn(); }
    } else {
      if (this.stagger <= 0) this.balance = Math.min(COMBAT.maxBalance, this.balance + COMBAT.balanceRegen * dt);
      if (this.stagger > 0) { c = this._stag; c.steer = inp.steer * 0.35; }
      else if (inp.attackL) this.melee.tryStart(-1);
      else if (inp.attackR) this.melee.tryStart(1);
    }
    this.melee.update(dt);

    track.project(this.body.position.x, this.body.position.z, this.s, this.tp);
    const { s, lat, h, k } = this.tp;
    this.s = s;
    this.lat = lat;
    const absLat = Math.abs(lat);
    this.offRoad = absLat > hw;

    // Anti-tunneling backstop
    const limit = hw + WALL.shoulder - 0.4;
    if (absLat > limit + 1.2) {
      const p = track.pointAt(s, Math.sign(lat) * limit, this.v3);
      this.body.position.x = p.x;
      this.body.position.z = p.z;
    }
    this.scraping = absLat > limit - 0.3;

    // Longitudinal
    let resist = 0;
    if (this.speed > 0) {
      resist = B.drag * this.speed + B.rolling;
      if (this.offRoad) resist += B.offRoadDrag * this.speed;
      if (this.scraping) resist += WALL.scrape;
      if (this.down) resist += COMBAT.slideDecel;
    }
    const a = c.throttle * B.accel - c.brake * B.brake - resist;
    this.speed = clamp(this.speed + a * dt, 0, B.maxSpeed);

    // Steering relative to the track tangent
    const speedFactor = Math.min(1, this.speed / 8) * (1 - 0.45 * (this.speed / B.maxSpeed));
    this.relYaw += c.steer * B.turnRate * speedFactor * dt;
    if (c.steer === 0) this.relYaw -= this.relYaw * B.yawRecover * dt;
    if (this.scraping) this.relYaw *= Math.exp(-6 * dt);
    this.relYaw = clamp(this.relYaw, -B.maxYaw, B.maxYaw);
    this.yaw = h + this.relYaw;

    // Curve drift + knockback
    this.drift += (k * this.speed * this.speed * B.curveDrift - this.drift * B.grip) * dt;
    const rx = Math.cos(h), rz = -Math.sin(h);
    this.vx = -Math.sin(this.yaw) * this.speed + rx * this.drift + this.knockX;
    this.vz = -Math.cos(this.yaw) * this.speed + rz * this.drift + this.knockZ;
    this.body.velocity.x = this.vx;
    this.body.velocity.z = this.vz;
    this.body.quaternion.setFromEuler(0, this.yaw, 0);

    const kd = Math.exp(-5 * dt);
    this.knockX *= kd;
    this.knockZ *= kd;

    this.leanTarget = this.down
      ? this.fallSide * 1.45
      : clamp(c.steer * B.maxLean * Math.min(1, this.speed / 20) + k * this.speed * 0.8, -B.maxLean, B.maxLean);
  }

  postStep() {
    this.prevPos.copy(this.currPos);
    this.prevYaw = this.currYaw;
    this.currPos.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.currYaw = this.yaw;
  }

  render(alpha, dt) {
    this.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.renderYaw = this.prevYaw + (this.currYaw - this.prevYaw) * alpha;

    this.mesh.position.set(this.position.x, this.position.y - 0.5, this.position.z);
    this.mesh.rotation.y = this.renderYaw;

    this.lean += (this.leanTarget - this.lean) * (1 - Math.exp(-8 * dt));
    const wobble = this.stagger > 0 ? Math.sin(performance.now() * 0.03) * 0.25 : 0;
    this.leanGroup.rotation.z = this.lean + wobble;

    const spin = (this.speed * dt) / WHEEL_R;
    this.frontWheel.rotation.x -= spin;
    this.rearWheel.rotation.x -= spin;

    this.melee.pose();
    this.ragdoll.update(dt);
    this.mesh.visible = this.invuln <= 0 || ((performance.now() / 90) | 0) % 2 === 0; // blink while invulnerable
  }
}