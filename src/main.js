import { HUD } from './ui/HUD.js';
import { Game } from './core/Game.js';
import { Renderer } from './core/Renderer.js';
import { Input } from './core/Input.js';
import { AssetManager } from './core/AssetManager.js';
import { events } from './core/Events.js';
import manifest from './core/manifest.js';
import { COMBAT, RIVALS, HIT_FX } from './core/constants.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { Track } from './world/Track.js';
import { Road } from './world/Road.js';
import { Props } from './world/Props.js';
import { Barriers } from './world/Barriers.js';
import { Traffic } from './entities/Traffic.js';
import { PlayerBike } from './entities/PlayerBike.js';
import { AIRider } from './ai/AIRider.js';
import { Race } from './race/Race.js';
import { FinishLine } from './world/FinishLine.js';
import { GameAudio } from './audio/GameAudio.js';
import { HitEffects } from './combat/HitEffects.js';
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

  const opponents = RIVALS.map((spec, i) => new AIRider(gfx.scene, physics, track, { ...spec, lat: i % 2 ? 3 : -3 }, bike, traffic));
  bike.name = 'YOU';
  const riders = [bike, ...opponents];
  const combat = new Combat(riders);
  for (const rider of riders) rider.combat = combat;
  const race = new Race(riders, bike, track, traffic);
  const finish = new FinishLine(gfx.scene, track, race.finishS);
  const hud = new HUD(bike, input, combat, race);
  const audio = new GameAudio(assets, bike, race);
  const hitEffects = new HitEffects(gfx.scene, riders, bike, document.getElementById('impact-flash'));

  let debug = null;
  if (location.search.includes('debug')) {
    const { default: CannonDebugger } = await import('cannon-es-debugger');
    debug = new CannonDebugger(gfx.scene, physics.world, { color: 0x00ff88 });
    window.dbg = { bike, riders, COMBAT, race, traffic, gfx }; // e.g. dbg.bike.melee.setWeapon('kick')
  }

  events.on('impact', ({ rider, speed }) => { if (rider === bike) chase.addShake(Math.min(1, speed / 30)); });
  events.on('hit', ({ attacker, target }) => {
    if (target === bike) chase.addShake(HIT_FX.playerShake);
    else if (attacker === bike) chase.addShake(HIT_FX.attackShake);
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
      if (!race.beforeStep(dt)) return;
      barriers.update(bike.s);
      traffic.fixedUpdate(dt, bike.s);

      riders.forEach((r) => r.fixedUpdate(dt));
      combat.fixedUpdate();
      physics.step(dt);
      riders.forEach((r) => r.postStep());
      traffic.postStep();
      race.postStep(dt);
    },
    update(alpha, dt) {
      if (race.state !== 'racing') { alpha = 1; dt = 0; }
      riders.forEach((r) => r.render(alpha, dt));
      traffic.render(alpha);
      road.update(bike.s, bike.position);
      props.update(bike.s);
      gfx.followSun(bike.position);
      chase.update(dt, bike);
      hitEffects.update(dt, gfx.camera);
      debug?.update();
      gfx.render();
      hud.update(dt);
      audio.update();
    },
  }).start();
}

boot().catch((error) => {
  console.error(error);
  document.getElementById('loading-title').textContent = 'COULD NOT START THE ENGINE';
  document.getElementById('loading-detail').innerHTML = 'Please <a href="">reload</a>. Check that WebGL is available in your browser.';
});