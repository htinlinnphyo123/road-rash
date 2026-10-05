import * as THREE from 'three';

const rubber = new THREE.MeshStandardMaterial({ color: 0x16191b, roughness: 0.95 });
const metal = new THREE.MeshStandardMaterial({ color: 0xadb5b9, metalness: 0.8, roughness: 0.28 });
const dark = new THREE.MeshStandardMaterial({ color: 0x20282c, roughness: 0.65 });
const glass = new THREE.MeshStandardMaterial({ color: 0x263e4b, metalness: 0.45, roughness: 0.18 });
const white = new THREE.MeshStandardMaterial({ color: 0xffedba, emissive: 0xffdf99, emissiveIntensity: 0.7 });
const red = new THREE.MeshStandardMaterial({ color: 0xb91916, emissive: 0xff2412, emissiveIntensity: 0.6 });
const pearl = new THREE.MeshStandardMaterial({ color: 0xe4e9e9, metalness: 0.35, roughness: 0.3 });
const led = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, emissive: 0xb3ddff, emissiveIntensity: 1.3 });
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(1, 16, 12);
const tyre = new THREE.CylinderGeometry(1, 1, 1, 20);

function part(group, geometry, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function block(g, m, x, y, z, sx, sy, sz) { return part(g, box, m, x, y, z, sx, sy, sz); }
function link(g, m, a, b, width) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const mesh = block(g, m, 0, 0, 0, width, start.distanceTo(end), width);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
}
// Cross-sections make tapered body panels instead of stacked rectangular blocks.
// Each section is [z, half-width, bottom y, top y, top-width ratio]. Built only at spawn.
function shell(group, material, sections) {
  const vertices = [], indices = [];
  for (const [z, w, bottom, top, taper] of sections) {
    vertices.push(-w, bottom, z, w, bottom, z, w * taper, top, z, -w * taper, top, z);
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let edge = 0; edge < 4; edge++) {
      const a = i * 4 + edge, b = i * 4 + (edge + 1) % 4;
      indices.push(a, b, b + 4, a, b + 4, a + 4);
    }
  }
  const last = (sections.length - 1) * 4;
  indices.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return part(group, geometry, material, 0, 0, 0, 1, 1, 1);
}

export function makeWheel(radius = 0.33, width = 0.18) {
  const group = new THREE.Group();
  part(group, tyre, rubber, 0, 0, 0, radius, width, radius).rotation.z = Math.PI / 2;
  part(group, tyre, metal, 0, 0, 0, radius * 0.62, width + 0.012, radius * 0.62).rotation.z = Math.PI / 2;
  part(group, tyre, dark, 0, 0, 0, radius * 0.24, width + 0.025, radius * 0.24).rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      link(group, metal, [side * (width / 2 + 0.012), 0, 0],
        [side * (width / 2 + 0.012), Math.sin(angle) * radius * 0.7, Math.cos(angle) * radius * 0.7], radius * 0.09);
    }
  }
  return group;
}
export function makeMotorcycle(group, color, shirt) {
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3 });
  part(group, sphere, paint, 0, 0.73, -0.17, 0.24, 0.23, 0.4);
  shell(group, paint, [[-0.82, 0.16, 0.57, 0.94, 0.7], [-0.48, 0.32, 0.29, 0.94, 0.8], [0.1, 0.27, 0.27, 0.68, 0.9]]);
  shell(group, glass, [[-0.75, 0.13, 0.89, 0.94, 0.8], [-0.5, 0.2, 0.94, 1.16, 0.85], [-0.36, 0.18, 0.94, 1.13, 0.8]]);
  block(group, dark, 0, 0.79, 0.3, 0.32, 0.09, 0.4);
  shell(group, paint, [[0.35, 0.18, 0.69, 0.84, 0.85], [0.7, 0.15, 0.75, 0.94, 0.65], [0.96, 0.07, 0.79, 0.89, 0.6]]);
  for (const side of [-1, 1]) {
    const stripe = block(group, pearl, side * 0.29, 0.67, -0.33, 0.035, 0.075, 0.43);
    stripe.rotation.x = -0.22;
    block(group, dark, side * 0.31, 0.5, -0.29, 0.025, 0.1, 0.28);
    block(group, led, side * 0.12, 0.87, -0.827, 0.16, 0.035, 0.035);
    block(group, red, side * 0.055, 0.855, 0.957, 0.06, 0.027, 0.018);
    link(group, dark, [side * 0.2, 0.62, 0.13], [side * 0.2, 0.78, 0.64], 0.045);
  }

  block(group, dark, 0, 0.41, 0, 0.34, 0.33, 0.43);
  for (let i = 0; i < 5; i++) block(group, metal, 0, 0.32 + i * 0.052, -0.07, 0.37, 0.018, 0.32);
  for (const side of [-1, 1]) {
    link(group, metal, [side * 0.12, 0.33, -0.7], [side * 0.12, 0.94, -0.48], 0.045);
    link(group, dark, [side * 0.12, 0.33, 0.7], [side * 0.12, 0.6, 0], 0.07);
    link(group, metal, [side * 0.25, 0.27, 0.65], [side * 0.25, 0.29, -0.2], 0.085);
  }
  block(group, metal, 0, 0.96, -0.5, 0.7, 0.045, 0.07);
  block(group, dark, 0, 1.00, -0.61, 0.27, 0.08, 0.17);
  block(group, glass, 0, 1.045, -0.61, 0.22, 0.015, 0.12);
  for (const side of [-1, 1]) {
    block(group, rubber, side * 0.3, 0.96, -0.5, 0.15, 0.07, 0.09);
    link(group, metal, [side * 0.31, 0.98, -0.5], [side * 0.44, 1.15, -0.65], 0.022);
    part(group, sphere, dark, side * 0.44, 1.17, -0.65, 0.12, 0.07, 0.035);
    part(group, sphere, glass, side * 0.44, 1.17, -0.62, 0.105, 0.055, 0.012);
  }


  const rider = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const torso = part(rider, sphere, jacket, 0, 1.13, 0.04, 0.24, 0.37, 0.17);
  torso.rotation.x = -0.35;
  part(rider, sphere, dark, 0, 1.51, -0.12, 0.205, 0.22, 0.21);
  part(rider, sphere, glass, 0, 1.53, -0.265, 0.17, 0.09, 0.08);
  block(rider, paint, 0, 1.3, 0.19, 0.29, 0.05, 0.03);
  for (const side of [-1, 1]) {
    part(rider, sphere, paint, side * 0.18, 1.28, 0.035, 0.1, 0.11, 0.15);
    block(rider, pearl, side * 0.085, 1.11, 0.195, 0.035, 0.25, 0.018);
  }
  part(rider, sphere, paint, 0, 1.665, -0.12, 0.08, 0.045, 0.17);
  for (const side of [-1, 1]) {
    link(rider, dark, [side * 0.17, 0.88, 0.35], [side * 0.29, 0.61, -0.02], 0.16);
    link(rider, dark, [side * 0.29, 0.61, -0.02], [side * 0.25, 0.3, 0.22], 0.13);
    block(rider, rubber, side * 0.25, 0.29, 0.12, 0.16, 0.13, 0.3);
    link(rider, jacket, [side * 0.2, 1.3, -0.04], [side * 0.3, 1.08, -0.22], 0.12);
    link(rider, jacket, [side * 0.3, 1.08, -0.22], [side * 0.3, 0.96, -0.5], 0.1);
  }
  group.add(rider);
  return rider;
}
export function makeCar(color, variant = 0) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.23 });
  const coupe = variant % 3 === 0, electric = variant % 3 === 1;
  const roof = coupe ? 1.24 : 1.4;
  shell(group, paint, [[-2.03, 0.72, 0.35, 0.66, 0.92], [-1.65, 0.86, 0.34, 0.83, 0.9],
    [-0.65, 0.87, 0.34, 0.88, 0.92], [0.7, 0.87, 0.34, 0.9, 0.93], [1.65, 0.84, 0.35, 0.89, 0.88], [2.03, 0.73, 0.4, 0.78, 0.9]]);
  shell(group, glass, [[-1.05, 0.7, 0.84, 0.88, 1], [-0.35, 0.7, 0.84, roof, 0.84],
    [0.6, 0.7, 0.85, roof, 0.84], [1.35, 0.69, 0.86, 0.9, 0.95]]);
  shell(group, paint, [[-0.38, 0.595, roof - 0.035, roof + 0.025, 0.98], [0.62, 0.595, roof - 0.035, roof + 0.025, 0.98]]);
  for (const side of [-1, 1]) {
    link(group, paint, [side * 0.7, 0.85, -1.05], [side * 0.585, roof, -0.35], 0.035);
    link(group, paint, [side * 0.585, roof, 0.6], [side * 0.67, 0.88, 1.35], 0.045);
    if (!coupe) link(group, dark, [side * 0.7, 0.87, 0.22], [side * 0.59, roof, 0.22], 0.045);
    block(group, dark, side * 0.855, 0.37, 0, 0.045, 0.09, 2.2);
    block(group, paint, side * 0.86, 0.98, -0.65, 0.18, 0.075, 0.22);
    block(group, metal, side * 0.878, 0.84, 0.4, 0.018, 0.025, 0.2);
    for (const z of [-1.27, 1.28]) {
      const wheel = makeWheel(0.35, 0.18);
      wheel.position.set(side * 0.81, 0.35, z); group.add(wheel);
    }
    const lamp = block(group, led, side * 0.5, 0.69, -1.997, 0.37, 0.04, 0.045);
    lamp.rotation.y = side * -0.16;
    block(group, dark, side * 0.54, 0.48, -1.99, 0.26, 0.11, 0.035);
    block(group, red, side * 0.52, 0.765, 2.007, 0.31, 0.045, 0.03);
    if (!electric) block(group, metal, side * 0.5, 0.43, 2.035, 0.14, 0.09, 0.09);
  }
  block(group, dark, 0, 0.45, -2.045, 1.35, 0.055, 0.065);
  block(group, dark, 0, 0.55, -2.038, electric ? 0.52 : 0.7, electric ? 0.045 : 0.15, 0.025);
  block(group, metal, 0, 0.72, -2.034, 0.09, 0.04, 0.018);
  block(group, dark, 0, 0.46, 2.035, 1.36, 0.11, 0.045);
  block(group, red, 0, 0.765, 2.042, 0.78, 0.025, 0.018);
  block(group, pearl, 0, 0.63, 2.046, 0.33, 0.11, 0.015);
  if (coupe) {
    for (const side of [-1, 1]) block(group, dark, side * 0.45, 0.96, 1.73, 0.045, 0.2, 0.06);
    block(group, dark, 0, 1.05, 1.73, 1.44, 0.05, 0.19);
  }
  return group;
}
