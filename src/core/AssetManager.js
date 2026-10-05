import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Howl } from 'howler';

export class AssetManager {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.models = new Map();
    this.textures = new Map();
    this.sounds = new Map();
  }

  // manifest: { models: {name: url}, textures: {name: url}, sounds: {name: {src, loop?, volume?}} }
  async load(manifest, onProgress) {
    const { models = {}, textures = {}, sounds = {} } = manifest;
    const total = Object.keys(models).length + Object.keys(textures).length + Object.keys(sounds).length;
    let done = 0;
    const tick = () => onProgress?.(total ? ++done / total : 1);
    const jobs = [];

    for (const [k, url] of Object.entries(models)) {
      jobs.push(this.gltfLoader.loadAsync(url).then((g) => { this.models.set(k, g); tick(); }));
    }
    for (const [k, url] of Object.entries(textures)) {
      jobs.push(this.textureLoader.loadAsync(url).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        this.textures.set(k, t); tick();
      }));
    }
    for (const [k, opts] of Object.entries(sounds)) {
      jobs.push(new Promise((resolve, reject) => {
        const howl = new Howl({
          ...opts,
          src: [].concat(opts.src),
          preload: true,
          onload: () => { this.sounds.set(k, howl); tick(); resolve(); },
          onloaderror: (_, err) => reject(new Error(`Sound "${k}" failed to load: ${err}`)),
        });
      }));
    }

    await Promise.all(jobs);
    onProgress?.(1);
  }

  // Each caller gets its own copy (skinned meshes included)
  model(name) {
    const g = this.models.get(name);
    if (!g) throw new Error(`Model "${name}" not loaded`);
    return clone(g.scene);
  }
  texture(name) { return this.textures.get(name); }
  sound(name) { return this.sounds.get(name); }
}