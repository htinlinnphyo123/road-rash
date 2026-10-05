import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ROAD, WALL, GROUP } from '../core/constants.js';

const SEG = 8, BEHIND = 4, AHEAD = 28, N = BEHIND + AHEAD + 1;
const HALF_THICK = 1.0; // collider half-thickness (anti-tunneling)

export class Barriers {
  constructor(scene, physics, track) {
    this.track = track;
    this.start = -1;
    this.p = {};
    this.v = new THREE.Vector3();
    this.dummy = new THREE.Object3D();
    this.inner = ROAD.width / 2 + WALL.shoulder;

    const shape = new CANNON.Box(new CANNON.Vec3(HALF_THICK, 0.75, SEG / 2 + 0.5)); // overlap hides gaps in bends
    const mk = () => {
      const b = new CANNON.Body({
        mass: 0, shape,
        collisionFilterGroup: GROUP.WORLD, collisionFilterMask: GROUP.BIKE,
      });
      b.userData = { kind: 'wall' };
      physics.world.addBody(b);
      return b;
    };
    this.slots = Array.from({ length: N }, () => ({ idx: -1, bodies: [mk(), mk()] }));

    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.3, 0.38, SEG + 0.1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.65 }),
      N * 2
    );
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.red = new THREE.Color(0x8b979b);
    this.white = new THREE.Color(0xb4bdbb);
    this.posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.85, 0.16), new THREE.MeshStandardMaterial({ color: 0x68777c, metalness: 0.6, roughness: 0.5 }), N * 2);
    this.posts.castShadow = true;
    this.posts.frustumCulled = false;
    scene.add(this.mesh, this.posts);
  }

  update(s) {
    const start = Math.max(0, Math.floor(s / SEG) - BEHIND);
    if (start === this.start) return;
    this.start = start;
    for (let idx = start; idx < start + N; idx++) {
      const slot = this.slots[idx % N]; // N consecutive indices map 1:1 onto slots
      if (slot.idx === idx) continue;
      slot.idx = idx;
      this.place(slot, idx % N, idx);
    }
    this.posts.instanceMatrix.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  place(slot, slotIndex, idx) {
    const sMid = (idx + 0.5) * SEG;
    const h = this.track.at(sMid, this.p).h;
    [-1, 1].forEach((side, k) => {
      // Collider: behind the inner face
      this.track.pointAt(sMid, side * (this.inner + HALF_THICK), this.v);
      const b = slot.bodies[k];
      b.position.set(this.v.x, 0.75, this.v.z);
      b.quaternion.setFromEuler(0, h, 0);
      b.aabbNeedsUpdate = true;

      // Visual: flush with the inner face
      this.track.pointAt(sMid, side * (this.inner + 0.15), this.v);
      this.dummy.position.set(this.v.x, 0.78, this.v.z);
      this.dummy.rotation.y = h;
      this.dummy.updateMatrix();
      const i = slotIndex * 2 + k;
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, idx % 2 ? this.red : this.white);
      this.dummy.position.y = 0.425;
      this.dummy.updateMatrix();
      this.posts.setMatrixAt(i, this.dummy.matrix);
    });
  }
}