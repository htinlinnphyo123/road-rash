import * as THREE from 'three';
import { HIT_FX } from '../core/constants.js';
import { events } from '../core/Events.js';

// One reusable burst per rider: no mesh/material allocation when a hit lands.
export class HitEffects {
  constructor(scene, riders, player, flash = null) {
    this.flash = flash; this.flashTime = 0;
    const vertices = [];
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      vertices.push(Math.cos(angle) * 0.12, Math.sin(angle) * 0.12, 0,
        Math.cos(angle) * 0.55, Math.sin(angle) * 0.55, 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.effects = riders.map(rider => {
      const material = new THREE.LineBasicMaterial({ color: 0xffec91, transparent: true, depthWrite: false });
      const burst = new THREE.LineSegments(geometry, material);
      burst.visible = false; scene.add(burst);
      return { rider, burst, time: 0, side: 1 };
    });
    events.on('hit', ({ attacker, target }) => {
      const effect = this.effects.find(e => e.rider === target);
      if (!effect) return;
      effect.time = HIT_FX.recoilDuration;
      const dx = target.body.position.x - attacker.body.position.x;
      const dz = target.body.position.z - attacker.body.position.z;
      effect.side = dx * Math.cos(target.yaw) - dz * Math.sin(target.yaw) < 0 ? -1 : 1;
      if (flash && (target === player || attacker === player)) {
        this.flashTime = HIT_FX.flashDuration;
        flash.classList.toggle('received', target === player);
      }
    });
    events.on('raceReset', () => this.reset());
  }
  reset() {
    this.flashTime = 0;
    if (this.flash) this.flash.style.opacity = '0';
    for (const e of this.effects) {
      e.time = 0; e.burst.visible = false;
      e.rider.riderMesh.rotation.z = 0; e.rider.riderMesh.position.x = 0;
    }
  }
  update(dt, camera) {
    this.flashTime = Math.max(0, this.flashTime - dt);
    if (this.flash) this.flash.style.opacity = String(this.flashTime / HIT_FX.flashDuration);
    for (const e of this.effects) {
      e.time = Math.max(0, e.time - dt);
      const strength = e.time / HIT_FX.recoilDuration;
      const recoil = Math.sin(strength * Math.PI / 2) * e.side;
      e.rider.riderMesh.rotation.z = -recoil * HIT_FX.recoilAngle;
      e.rider.riderMesh.position.x = recoil * 0.12;
      const age = HIT_FX.recoilDuration - e.time;
      e.burst.visible = e.time > 0 && age < HIT_FX.duration;
      if (e.burst.visible) {
        e.burst.position.copy(e.rider.position); e.burst.position.y += 0.7;
        e.burst.quaternion.copy(camera.quaternion);
        e.burst.scale.setScalar(0.7 + age * 4);
        e.burst.material.opacity = Math.max(0, 1 - age / HIT_FX.duration);
      }
    }
  }
}
