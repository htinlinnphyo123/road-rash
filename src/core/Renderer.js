import * as THREE from 'three';

const SUN_OFFSET = new THREE.Vector3(30, 50, 20);

export class Renderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const sky = new THREE.Color(0xb6c6cb);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 80, 380);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);

    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x70684c, 1.5));

    this.sun = new THREE.DirectionalLight(0xffdfad, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 30;
    Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 150 });
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Keep the shadow frustum centered on the player
  followSun(pos) {
    this.sun.target.position.copy(pos);
    this.sun.position.copy(pos).add(SUN_OFFSET);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}