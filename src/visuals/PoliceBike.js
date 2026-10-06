import * as THREE from 'three';

// Touring patrol silhouette: panniers, tall shield, crash bars and white livery.
export function dressPoliceBike(group) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf0f2e9, metalness: 0.35, roughness: 0.35 });
  const black = new THREE.MeshStandardMaterial({ color: 0x101923, roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf0c354, metalness: 0.65, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8ab9d2, transparent: true, opacity: 0.45, metalness: 0.2, roughness: 0.2 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const part = (material, x, y, z, sx, sy, sz) => {
    const mesh = new THREE.Mesh(box, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; group.add(mesh); return mesh;
  };
  for (const side of [-1, 1]) {
    part(white, side * 0.35, 0.65, 0.61, 0.25, 0.4, 0.56);
    part(black, side * 0.35, 0.87, 0.61, 0.27, 0.05, 0.58);
    part(black, side * 0.481, 0.65, 0.61, 0.016, 0.12, 0.5);
    part(gold, side * 0.493, 0.66, 0.61, 0.012, 0.17, 0.14).rotation.x = Math.PI / 4;
    part(white, side * 0.32, 0.72, -0.35, 0.08, 0.23, 0.5);
    part(black, side * 0.43, 0.42, -0.2, 0.05, 0.2, 0.56);
  }
  part(glass, 0, 1.15, -0.58, 0.5, 0.54, 0.045).rotation.x = -0.2;
  part(white, 0, 0.93, 0.68, 0.55, 0.17, 0.37);
  part(black, 0.26, 1.23, 0.79, 0.018, 0.65, 0.018);
}
