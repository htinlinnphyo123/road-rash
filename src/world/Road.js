import * as THREE from 'three';
import { ROAD } from '../core/constants.js';
import { STEP } from './Track.js';

const CHUNK_SAMPLES = 32;
const CHUNK_LEN = CHUNK_SAMPLES * STEP; // 64 m
const BEHIND = 2, AHEAD = 7, POOL = BEHIND + AHEAD + 1;
const VERTS = (CHUNK_SAMPLES + 1) * 2;

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256; // one period along the road, full width across
  const g = c.getContext('2d');
  g.fillStyle = '#34383a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3500; i++) {
    const v = 43 + Math.random() * 18;
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.fillStyle = '#f2f2f2';
  g.fillRect(10, 0, 5, 256);
  g.fillRect(241, 0, 5, 256);
  g.fillStyle = '#e6c66c';
  g.fillRect(125, 0, 6, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export class Road {
  constructor(scene, track) {
    this.track = track;
    this.tmp = {};
    this.start = -1;

    const indices = [];
    for (let j = 0; j < CHUNK_SAMPLES; j++) {
      const a = 2 * j;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // CCW, faces +Y
    }
    const normals = new Float32Array(VERTS * 3);
    for (let i = 0; i < VERTS; i++) normals[i * 3 + 1] = 1;

    const material = new THREE.MeshStandardMaterial({
      map: makeRoadTexture(), roughness: 0.95,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, // no z-fight with grass
    });

    this.chunks = [];
    for (let c = 0; c < POOL; c++) {
      const geo = new THREE.BufferGeometry();
      const pos = new THREE.BufferAttribute(new Float32Array(VERTS * 3), 3).setUsage(THREE.DynamicDrawUsage);
      const uv = new THREE.BufferAttribute(new Float32Array(VERTS * 2), 2).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', pos);
      geo.setAttribute('uv', uv);
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geo.setIndex(indices);
      const mesh = new THREE.Mesh(geo, material);
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.chunks.push({ mesh, pos, uv, index: -1 });
    }

    this.grass = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshStandardMaterial({ color: 0x737653, roughness: 1 })
    );
    this.grass.rotation.x = -Math.PI / 2;
    this.grass.receiveShadow = true;
    scene.add(this.grass);
  }

  update(s, p) {
    this.grass.position.set(p.x, 0, p.z);
    const start = Math.max(0, Math.floor(s / CHUNK_LEN) - BEHIND);
    if (start === this.start) return;
    this.start = start;

    const free = this.chunks.filter((c) => c.index < start || c.index >= start + POOL);
    for (let idx = start; idx < start + POOL; idx++) {
      if (!this.chunks.some((c) => c.index === idx)) this.build(free.pop(), idx);
    }
  }

  build(chunk, index) {
    const hw = ROAD.width / 2, t = this.tmp;
    const P = chunk.pos.array, U = chunk.uv.array;
    for (let j = 0; j <= CHUNK_SAMPLES; j++) {
      const s = (index * CHUNK_SAMPLES + j) * STEP;
      this.track.at(s, t);
      const cx = Math.cos(t.h) * hw, sz = Math.sin(t.h) * hw;
      const v = s / ROAD.period;
      P.set([t.x - cx, 0.02, t.z + sz, t.x + cx, 0.02, t.z - sz], j * 6);
      U.set([0, v, 1, v], j * 4);
    }
    chunk.index = index;
    chunk.pos.needsUpdate = true;
    chunk.uv.needsUpdate = true;
    chunk.mesh.geometry.computeBoundingSphere();
  }
}