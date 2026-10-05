import * as THREE from 'three';
import { BIKE, RIDER_CAMERA as C } from '../core/constants.js';

const UP = new THREE.Vector3(0, 1, 0);

export class RiderCamera {
  constructor(camera) {
    this.camera = camera;
    this.shake = 0;
    this.offset = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
  }

  addShake(amount) { this.shake = Math.min(1.5, this.shake + amount); }

  update(dt, bike) {
    // A tight chase offset shows the whole bike without trailing farther away at speed.
    this.offset.set(0, C.height, C.distance).applyAxisAngle(UP, bike.renderYaw);
    this.camera.position.copy(bike.position).add(this.offset);
    this.lookTarget.set(-Math.sin(bike.renderYaw) * C.lookAhead, C.targetHeight,
      -Math.cos(bike.renderYaw) * C.lookAhead).add(bike.position);
    this.camera.lookAt(this.lookTarget);
    // Keep the horizon readable even during a dismount.
    this.camera.rotateZ(bike.down ? 0 : bike.lean * C.leanAmount);
    if (dt > 0 && this.shake > 0.001) {
      const amount = this.shake * C.shakeScale;
      this.camera.position.x += (Math.random() - 0.5) * amount;
      this.camera.position.y += (Math.random() - 0.5) * amount;
      this.shake *= Math.exp(-C.shakeDecay * dt);
    }
    const fov = C.baseFov + C.speedFov * Math.min(1, bike.speed / BIKE.maxSpeed);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
