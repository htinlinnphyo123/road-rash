import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { makeCar } from '../visuals/Vehicles.js';
import { GROUP } from '../core/constants.js';

const LANES = [
  { lat: -3.5, dir: -1, speed: [16, 26] }, // oncoming
  { lat: 3.5, dir: 1, speed: [14, 24] },   // same direction
];
const COLORS = [0x254d78, 0xd5dadd, 0x4d5851, 0x20272b, 0x9c252c, 0xb2b8bf];
const HALF = new CANNON.Vec3(0.9, 0.75, 2.1);
class TrafficCar {
  constructor(scene, physics, track, color, variant) {
    this.track = track;
    this.tmp = {};
    this.active = false;
    this.s = 0; this.lat = 0; this.dir = 1; this.speed = 0;
    this.tx = this.tz = this.tyaw = 0;

    this.body = new CANNON.Body({
      mass: 0, type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Box(HALF),
      collisionFilterGroup: GROUP.TRAFFIC, collisionFilterMask: GROUP.BIKE,
    });
    this.body.userData = { kind: 'traffic', entity: this };
    physics.world.addBody(this.body);

    this.mesh = makeCar(color, variant);
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.prevPos = new THREE.Vector3(); this.currPos = new THREE.Vector3();
    this.prevYaw = 0; this.currYaw = 0;
  }

  pose() {
    const t = this.track.at(this.s, this.tmp);
    this.tx = t.x + Math.cos(t.h) * this.lat;
    this.tz = t.z - Math.sin(t.h) * this.lat;
    this.tyaw = this.dir > 0 ? t.h : t.h + Math.PI;
  }

  teleport(s, lane) {
    this.s = s; this.lat = lane.lat; this.dir = lane.dir;
    this.speed = lane.speed[0] + Math.random() * (lane.speed[1] - lane.speed[0]);
    this.pose();
    const b = this.body;
    b.position.set(this.tx, 0.75, this.tz);
    b.quaternion.setFromEuler(0, this.tyaw, 0);
    b.velocity.setZero();
    b.aabbNeedsUpdate = true;
    this.currPos.set(this.tx, 0.75, this.tz);
    this.prevPos.copy(this.currPos);
    this.prevYaw = this.currYaw = this.tyaw;
    this.mesh.visible = this.active = true;
  }

  park() {
    this.active = false;
    this.mesh.visible = false;
    this.body.position.set(0, -50, 0);
    this.body.velocity.setZero();
    this.body.aabbNeedsUpdate = true;
  }

  fixedUpdate(dt) {
    this.s += this.dir * this.speed * dt;
    this.pose();
    const b = this.body;
    b.velocity.set((this.tx - b.position.x) / dt, 0, (this.tz - b.position.z) / dt);
    b.quaternion.setFromEuler(0, this.tyaw, 0);
  }

  postStep() {
    this.prevPos.copy(this.currPos);
    this.prevYaw = this.currYaw;
    this.currPos.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.currYaw = this.tyaw;
  }

  render(alpha) {
    this.mesh.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.mesh.position.y -= 0.75;
    this.mesh.rotation.y = this.prevYaw + (this.currYaw - this.prevYaw) * alpha;
  }
}

export class Traffic {
  constructor(scene, physics, track, count = 10) {
    this.cars = Array.from({ length: count }, (_, i) =>
      new TrafficCar(scene, physics, track, COLORS[i % COLORS.length], i));
    this.cars.forEach((c) => c.park());
  }

  trySpawn(car, playerS) {
    for (let i = 0; i < 8; i++) {
      const lane = LANES[Math.random() < 0.5 ? 0 : 1];
      const s = playerS + 150 + Math.random() * 250;
      const clear = this.cars.every((o) => !o.active || o.lat !== lane.lat || Math.abs(o.s - s) > 30);
      if (clear) return car.teleport(s, lane);
    }
  }

  fixedUpdate(dt, playerS) {
    for (const car of this.cars) {
      if (!car.active) { this.trySpawn(car, playerS); continue; }
      if (car.s < playerS - 60 || car.s > playerS + 450) { car.park(); continue; }
      car.fixedUpdate(dt);
    }
  }

  postStep() { this.cars.forEach((c) => c.active && c.postStep()); }
  render(alpha) { this.cars.forEach((c) => c.active && c.render(alpha)); }
}