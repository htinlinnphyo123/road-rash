import * as THREE from 'three';

const rand = (a) => (Math.random() - 0.5) * 2 * a;

export class Ragdoll {
  constructor(scene, shirt = 0x222a44) {
    this.group = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: shirt });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf2c14e });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.65, 0.3), cloth);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skin);
    head.position.y = 0.52;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.2), cloth);
    legs.position.y = -0.62;
    this.group.add(torso, head, legs);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.visible = false;
    scene.add(this.group);

    this.vel = new THREE.Vector3();
    this.spin = new THREE.Vector3();
    this.active = false;
  }

  launch(pos, vx, vy, vz) {
    this.group.position.set(pos.x, 1.2, pos.z);
    this.group.rotation.set(0, 0, 0);
    this.vel.set(vx, vy, vz);
    this.spin.set(rand(9), rand(5), rand(9));
    this.group.visible = this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    const g = this.group;
    this.vel.y -= 30 * dt;
    g.position.addScaledVector(this.vel, dt);
    g.rotation.x += this.spin.x * dt;
    g.rotation.y += this.spin.y * dt;
    g.rotation.z += this.spin.z * dt;
    if (g.position.y < 0.35) {
      g.position.y = 0.35;
      this.vel.y = this.vel.y < -2 ? -this.vel.y * 0.3 : 0;
      const f = Math.exp(-3 * dt);
      this.vel.x *= f; this.vel.z *= f;
      this.spin.multiplyScalar(Math.exp(-4 * dt));
    }
  }

  hide() { this.group.visible = this.active = false; }
}