import * as THREE from 'three';

const sphere = new THREE.SphereGeometry(1, 20, 14);
const limbGeometry = new THREE.CylinderGeometry(0.78, 1, 1, 12);
const bootGeometry = new THREE.BoxGeometry(1, 1, 1);
const leather = new THREE.MeshStandardMaterial({ color: 0x171b20, roughness: 0.82 });
const armor = new THREE.MeshStandardMaterial({ color: 0x30363c, roughness: 0.55 });
const seam = new THREE.MeshStandardMaterial({ color: 0x929999, roughness: 0.8 });
const skin = new THREE.MeshStandardMaterial({ color: 0x9f7257, roughness: 0.9 });
const visor = new THREE.MeshStandardMaterial({ color: 0x14232b, roughness: 0.12, metalness: 0.65 });

// Elliptical cross sections follow hips, waist, ribs and shoulders in a riding crouch.
const vertices = [], indices = [];
const rings = [[0.86, 0.22, 0.17, 0.13], [0.97, 0.14, 0.155, 0.12], [1.12, 0.02, 0.20, 0.14], [1.27, -0.09, 0.235, 0.125], [1.34, -0.14, 0.16, 0.10]];
for (const [y, z, width, depth] of rings) {
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8;
    vertices.push(Math.cos(angle) * width, y, z + Math.sin(angle) * depth);
  }
}
for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < 16; i++) {
  const a = r * 16 + i, b = r * 16 + (i + 1) % 16;
  indices.push(a, a + 16, b, b, a + 16, b + 16);
}
const torsoGeometry = new THREE.BufferGeometry();
torsoGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
torsoGeometry.setIndex(indices); torsoGeometry.computeVertexNormals();

export function makeHumanRider(color, shirt) {
  const rider = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.78 });
  const helmet = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.28, metalness: 0.2 });
  const trim = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const part = (geometry, material, x, y, z, sx, sy, sz) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true; rider.add(mesh); return mesh;
  };
  const limb = (material, a, b, radius) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const mesh = part(limbGeometry, material, 0, 0, 0, radius, start.distanceTo(end), radius);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  };
  part(sphere, leather, 0, 0.85, 0.25, 0.185, 0.12, 0.17);
  part(torsoGeometry, jacket, 0, 0, 0, 1, 1, 1);
  part(sphere, leather, 0, 1.32, -0.13, 0.10, 0.05, 0.09);
  part(sphere, skin, 0, 1.365, -0.16, 0.067, 0.06, 0.066);
  part(sphere, helmet, 0, 1.49, -0.21, 0.16, 0.185, 0.185);
  part(sphere, visor, 0, 1.50, -0.365, 0.145, 0.066, 0.047);
  part(sphere, helmet, 0, 1.407, -0.326, 0.14, 0.065, 0.095);
  part(bootGeometry, armor, 0, 1.41, -0.411, 0.095, 0.016, 0.009);
  // Restrained suit panels replace the oversized colored shoulder spheres.
  for (const side of [-1, 1]) {
    const hip = [side * 0.145, 0.85, 0.23], knee = [side * 0.29, 0.60, -0.15];
    const ankle = [side * 0.28, 0.31, 0.13];
    limb(leather, hip, knee, 0.105); limb(leather, knee, ankle, 0.073);
    part(sphere, armor, ...knee, 0.085, 0.095, 0.08);
    part(sphere, leather, ...ankle, 0.075, 0.13, 0.075);
    part(sphere, leather, side * 0.28, 0.245, 0.04, 0.08, 0.06, 0.15);
    const shoulder = [side * 0.215, 1.265, -0.10], elbow = [side * 0.32, 1.095, -0.12];
    const hand = [side * 0.30, 0.97, -0.49];
    limb(jacket, shoulder, elbow, 0.077); limb(jacket, elbow, hand, 0.06);
    part(sphere, jacket, ...shoulder, 0.079, 0.083, 0.08);
    part(sphere, armor, ...elbow, 0.066, 0.067, 0.065);
    part(sphere, leather, ...hand, 0.054, 0.045, 0.071);
    limb(trim, [side * 0.235, 1.28, -0.005], [side * 0.17, 1.17, 0.15], 0.013);
    limb(seam, [side * 0.12, 1.23, 0.038], [side * 0.09, 1.03, 0.235], 0.005);
    part(sphere, armor, side * 0.157, 1.48, -0.22, 0.009, 0.022, 0.025);
  }
  return rider;
}
