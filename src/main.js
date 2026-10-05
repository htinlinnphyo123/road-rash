import { HUD } from './ui/HUD.js';
import { Game } from './core/Game.js';
import { Renderer } from './core/Renderer.js';
import { Input } from './core/Input.js';
import { AssetManager } from './core/AssetManager.js';
import { events } from './core/Events.js';
import manifest from './core/manifest.js';
import { COMBAT } from './core/constants.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { Track } from './world/Track.js';
import { Road } from './world/Road.js';
import { Props } from './world/Props.js';
import { Barriers } from './world/Barriers.js';
import { Traffic } from './entities/Traffic.js';
import { PlayerBike } from './entities/PlayerBike.js';
import { DummyRider } from './entities/DummyRider.js';
import { Combat } from './combat/Combat.js';
import { RiderCamera } from './camera/RiderCamera.js';

async function boot() {
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  const bar = document.getElementById('bar');
  const assets = new AssetManager();
  await assets.load(manifest, (p) => { bar.style.width = `${p * 100}%`; });

  const gfx = new Renderer(document.getElementById('app'));
  const input = new Input(gfx.renderer.domElement);
  const physics = new PhysicsWorld();
  const track = new Track(1337);
  const road = new Road(gfx.scene, track);
  const props = new Props(gfx.scene, track);
  const barriers = new Barriers(gfx.scene, physics, track);
  const traffic = new Traffic(gfx.scene, physics, track, 8);
  const bike = new PlayerBike(gfx.scene, physics, track, input);
  const chase = new RiderCamera(gfx.camera);

  const dummySpecs = [
    { s: 60,  lat: -3, cruise: 26, color: 0x2f6fd0, shirt: 0x1d3f7a },
    { s: 100, lat: 3,  cruise: 32, color: 0x2aa05a, shirt: 0x14502d },
    { s: 140, lat: 0,  cruise: 29, color: 0xe0b422, shirt: 0x7a5d10 },
    { s: 180, lat: -2, cruise: 35, color: 0x8a3fc0, shirt: 0x45206a },
  ];
  const dummies = dummySpecs.map((o) => new DummyRider(gfx.scene, physics, track, o));
  const riders = [bike, ...dummies];
  const combat = new Combat(riders);
  bike.combat = combat;

  const hud = new HUD(bike, input, combat);

  let debug = null;
  if (location.search.includes('debug')) {
    const { default: CannonDebugger } = await import('cannon-es-debugger');
    debug = new CannonDebugger(gfx.scene, physics.world, { color: 0x00ff88 });
    window.dbg = { bike, riders, COMBAT }; // e.g. dbg.bike.melee.setWeapon('kick')
  }

  events.on('impact', ({ rider, speed }) => { if (rider === bike) chase.addShake(Math.min(1, speed / 30)); });
  events.on('hit', ({ attacker, target }) => {
    if (target === bike) chase.addShake(0.6);
    else if (attacker === bike) chase.addShake(0.3);
  });
  barriers.update(bike.s);
  chase.update(1, bike);
  for (const rider of riders) rider.render(1, 0);
  road.update(bike.s, bike.position);
  props.update(bike.s);
  gfx.followSun(bike.position);
  await gfx.renderer.compileAsync(gfx.scene, gfx.camera);
  gfx.render();
  document.body.classList.remove('booting');
  const loading = document.getElementById('loading');
  loading.classList.add('leaving');
  loading.addEventListener('transitionend', () => loading.remove(), { once: true });
  setTimeout(() => loading.remove(), 500);

  new Game({
    fixedUpdate(dt) {
      if (hud.paused) return;
      barriers.update(bike.s);
      traffic.fixedUpdate(dt, bike.s);

      // Keep the test dummies in play: leapfrog any that fall far behind or ahead
      for (const d of dummies) {
        if (d.s < bike.s - 120 || d.s > bike.s + 320) {
          d.placeAt(bike.s + 120 + Math.random() * 80, d.laneLat, d.cruise);
        }
      }

      riders.forEach((r) => r.fixedUpdate(dt));
      combat.fixedUpdate();
      physics.step(dt);
      riders.forEach((r) => r.postStep());
      traffic.postStep();
    },
    update(alpha, dt) {
      if (hud.paused) { alpha = 1; dt = 0; }
      riders.forEach((r) => r.render(alpha, dt));
      traffic.render(alpha);
      road.update(bike.s, bike.position);
      props.update(bike.s);
      gfx.followSun(bike.position);
      if (!hud.paused) chase.update(dt, bike);
      debug?.update();
      gfx.render();
      hud.update(dt);
    },
  }).start();
}

boot().catch((error) => {
  console.error(error);
  document.getElementById('loading-title').textContent = 'COULD NOT START THE ENGINE';
  document.getElementById('loading-detail').innerHTML = 'Please <a href="">reload</a>. Check that WebGL is available in your browser.';
});