import * as THREE from 'three';
import { ROAD } from '../core/constants.js';

const POLE_SPACING = 20, TREE_SPACING = 14;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function instanced(geo, color, count, scene) {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color }), count);
  m.castShadow = true;
  m.frustumCulled = false; // instances span far beyond the geometry's own bounds
  scene.add(m);
  return m;
}

export class Props {
  constructor(scene, track) {
    this.track = track;

    this.trunks = instanced(new THREE.CylinderGeometry(0.25, 0.35, 2, 6), 0x5b3b22, 96, scene);
    this.leaves = instanced(new THREE.ConeGeometry(1.8, 5, 8), 0x364f36, 96, scene);
    this.crowns = instanced(new THREE.ConeGeometry(1.4, 3.8, 9), 0x4b6341, 96, scene);
    this.dummy = new THREE.Object3D();
    this.p = {};
    this.pk = this.tk = null;
  }

  place(mesh, idx, s, lat, y, scale) {
    const p = this.track.at(s, this.p), d = this.dummy;
    d.position.set(p.x + Math.cos(p.h) * lat, y, p.z - Math.sin(p.h) * lat);
    d.rotation.y = p.h;
    d.scale.setScalar(scale);
    d.updateMatrix();
    mesh.setMatrixAt(idx, d.matrix);
  }

update(s) {
  const tk = Math.floor(s / TREE_SPACING);
  if (tk === this.tk) return;
  this.tk = tk;

  let n = 0;
  for (let k = Math.max(0, tk - 7); k <= tk + 32; k++) {
    for (const side of [-1, 1]) {
      if (hash(k * 2 + (side > 0 ? 1 : 0)) < 0.25) continue;
      const lat = side * (ROAD.width / 2 + 5 + hash(k * 7 + side) * 25);
      const sc = 0.8 + hash(k * 13 + side * 3) * 1.1;
      this.place(this.trunks, n, k * TREE_SPACING, lat, 1 * sc, sc);
      this.place(this.leaves, n, k * TREE_SPACING, lat, 4.5 * sc, sc);
      this.place(this.crowns, n, k * TREE_SPACING, lat, 6 * sc, sc);
      n++;
    }
  }
  this.trunks.count = this.leaves.count = this.crowns.count = n;
  this.trunks.instanceMatrix.needsUpdate = this.leaves.instanceMatrix.needsUpdate = this.crowns.instanceMatrix.needsUpdate = true;
}
}