import * as THREE from 'three';
import { HUD } from './ui/HUD.js';
import { Game } from './core/Game.js';
import { Renderer } from './core/Renderer.js';
import { Input } from './core/Input.js';
import { AssetManager } from './core/AssetManager.js';
import { events } from './core/Events.js';
import manifest from './core/manifest.js';
import { COMBAT, RIVALS, HIT_FX, POLICE, PICKUPS } from './core/constants.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { Track } from './world/Track.js';
import { Road } from './world/Road.js';
import { Props } from './world/Props.js';
import { Pickups } from './world/Pickups.js';
import { Barriers } from './world/Barriers.js';
import { Traffic } from './entities/Traffic.js';
import { PlayerBike } from './entities/PlayerBike.js';
import { AIRider } from './ai/AIRider.js';
import { Police } from './ai/Police.js';
import { Race } from './race/Race.js';
import { FinishLine } from './world/FinishLine.js';
import { GameAudio } from './audio/GameAudio.js';
import { HitEffects } from './combat/HitEffects.js';
import { Combat } from './combat/Combat.js';
import { RiderCamera } from './camera/RiderCamera.js';
import { Particles } from './visuals/Particles.js';

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
  const pickups = new Pickups(gfx.scene, track);
  const barriers = new Barriers(gfx.scene, physics, track);
  const traffic = new Traffic(gfx.scene, physics, track, 8);
  const bike = new PlayerBike(gfx.scene, physics, track, input);
  const chase = new RiderCamera(gfx.camera);

  const opponents = RIVALS.map((spec, i) => new AIRider(gfx.scene, physics, track, { ...spec, lat: i % 2 ? 3 : -3 }, bike, traffic));
  bike.name = 'YOU';
  const riders = [bike, ...opponents];
  const combat = new Combat(riders);
  for (const rider of riders) rider.combat = combat;
  const police = new Police(gfx.scene, physics, track, bike, traffic, combat, null);
  const fighters = [...riders];
  police.addTo(fighters);
  combat.fighters = fighters;
  const race = new Race(riders, bike, track, traffic);
  police.race = race;
  const finish = new FinishLine(gfx.scene, track, race.finishS);
  const hud = new HUD(bike, input, combat, race, police, pickups);
  const audio = new GameAudio(assets, bike, race);
  const hitEffects = new HitEffects(gfx.scene, fighters, bike, document.getElementById('impact-flash'));
  const particles = new Particles(gfx.scene);

  events.on('impact', (e) => {
    if (e.rider === bike) chase.addShake(Math.min(1, e.speed / 30));
  });
  events.on('hit', ({ attacker, target }) => {
    if (target === bike) chase.addShake(HIT_FX.playerShake);
    else if (attacker === bike) chase.addShake(HIT_FX.attackShake);
  });

  let debug = null;
  if (location.search.includes('debug')) {
    const { default: CannonDebugger } = await import('cannon-es-debugger');
    debug = new CannonDebugger(gfx.scene, physics.world, { color: 0x00ff88 });
  }
  window.dbg = { bike, riders, COMBAT, race, traffic, gfx, police, pickups, particles,
    forcePolice(spawnNow = true) {
      police.takedownsTriggered = POLICE.takedownThreshold + 1;
      police.arm(); if (spawnNow) { police.spawnT = 0; police.trySpawn(); }
    },
    forcePickupAhead(weapon = null, metersAhead = 40) {
      const slot = pickups.slots[0];
      slot.idx = (pickups.start + Math.ceil(metersAhead / PICKUPS.spacing)) * 2;
      slot.seed = slot.idx + Math.floor(Math.random() * 9999);
      slot.weapon = weapon || (['pipe', 'chain', 'bat'][Math.floor(Math.random() * 3)]);
      slot.active = true;
      slot.cooldown = 0;
      slot.s = bike.s + metersAhead;
      slot.bob = 0;
    },
    sparkBurst(count = 60) {
      particles.emitSparks(count, new THREE.Vector3(bike.body.position.x, 0.4, bike.body.position.z), { x: 0, y: 2, z: 0 }, 2.2, 0.6);
    },
    smokeBurst(count = 30) {
      const pos = new THREE.Vector3(bike.body.position.x, 0.3, bike.body.position.z);
      for (let i = 0; i < count; i++) particles.emitSmoke(1, pos, { x: 0, y: 0.8, z: 0 }, 0.4, 0.3, 2.8, 1.3);
    },
  };
  addEventListener('keydown', (e) => {
    if (e.repeat || !location.search.includes('debug') || race.state !== 'racing') return;
    if (e.code === 'KeyP' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!police.active) { window.dbg.forcePolice(true); console.log('[cheat] POLICE CHASE ACTIVATED'); }
      else { police.disarm(); console.log('[cheat] POLICE DISARMED'); }
    } else if (e.code === 'KeyL') {
      const weapon = e.shiftKey ? 'pipe' : e.ctrlKey ? 'chain' : null;
      window.dbg.forcePickupAhead(weapon, 30);
      console.log(`[cheat] PICKUP SPAWNED AHEAD (30m)${weapon ? ` · weapon=${weapon}` : ''}`);
    } else if (e.code === 'KeyB') {
      window.dbg.sparkBurst(e.shiftKey ? 120 : 50);
      console.log('[cheat] SPARK BURST');
    } else if (e.code === 'KeyV') {
      window.dbg.smokeBurst(e.shiftKey ? 60 : 25);
      console.log('[cheat] SMOKE BURST');
    }
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
      pickups.update(dt, bike);
      riders.forEach((r) => r.fixedUpdate(dt));
      police.fixedUpdate(dt);
      combat.fixedUpdate();
      physics.step(dt);
      riders.forEach((r) => r.postStep());
      police.postStep();
      traffic.postStep();
      race.postStep(dt);
    },
    update(alpha, dt) {
      if (race.state !== 'racing') { alpha = 1; dt = 0; }
      riders.forEach((r) => r.render(alpha, dt));
      police.update(dt, alpha);
      traffic.render(alpha);
      road.update(bike.s, bike.position);
      props.update(bike.s);
      gfx.followSun(bike.position);
      chase.update(dt, bike);
      particles.update(dt, fighters, null, gfx.camera);
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