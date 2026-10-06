import * as THREE from 'three';
import { ROAD } from '../core/constants.js';

export class FinishLine {
  constructor(scene, track, s) {
    this.group = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ color: 0x202d35, metalness: 0.5, roughness: 0.4 });
    const light = new THREE.MeshBasicMaterial({ color: 0xe8ff65 });
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6, 0.35), frame);
      pole.position.set(side * (ROAD.width / 2 + 0.8), 3, 0); this.group.add(pole);
    }
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#15252b'; ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#e8ff65'; ctx.font = 'bold 85px Arial'; ctx.textAlign = 'center'; ctx.fillText('FINISH', 512, 94);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 2, 1.5, 0.15), new THREE.MeshBasicMaterial({ map: texture }));
    sign.position.y = 5.7; this.group.add(sign);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(ROAD.width + 2, 0.08, 0.22), light); strip.position.y = 4.9; this.group.add(strip);
    const tile = new THREE.PlaneGeometry(0.7, 0.7);
    const black = new THREE.MeshBasicMaterial({ color: 0x192129 });
    const white = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    for (let x = 0; x < 20; x++) for (let z = 0; z < 3; z++) {
      const square = new THREE.Mesh(tile, (x + z) % 2 ? black : white);
      square.rotation.x = -Math.PI / 2; square.position.set(-6.65 + x * 0.7, 0.045, (z - 1) * 0.7); this.group.add(square);
    }
    const point = track.at(s, {}); this.group.position.set(point.x, 0, point.z); this.group.rotation.y = point.h;
    scene.add(this.group);
  }
}
