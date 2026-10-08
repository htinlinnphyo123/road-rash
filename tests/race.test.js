import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.js';
import { Track } from '../src/world/Track.js';
import { Traffic } from '../src/entities/Traffic.js';
import { Barriers } from '../src/world/Barriers.js';
import { Race } from '../src/race/Race.js';
import { Combat } from '../src/combat/Combat.js';
import { RACE, RIVALS, BIKE, COMBAT } from '../src/core/constants.js';
import { events } from '../src/core/Events.js';
globalThis.location = { search: '' };
const { PlayerBike } = await import('../src/entities/PlayerBike.js');
const { AIRider } = await import('../src/ai/AIRider.js');
function setup() {
  const scene = new THREE.Scene(), physics = new PhysicsWorld(), track = new Track(1337);
  const traffic = new Traffic(scene, physics, track, 8);
  const input = { throttle: 1, brake: 0, steer: 0, consume: () => false };
  const player = new PlayerBike(scene, physics, track, input);
  const opponents = RIVALS.map((spec, i) => new AIRider(scene, physics, track, { ...spec, lat: i % 2 ? 3 : -3 }, player, traffic));
  const riders = [player, ...opponents], combat = new Combat(riders);
  for (const rider of riders) rider.combat = combat;
  const race = new Race(riders, player, track, traffic);
  const barriers = new Barriers(scene, physics, track);
  const step = () => {
    if (!race.beforeStep(1 / 60)) return;
    barriers.update(player.s); traffic.fixedUpdate(1 / 60, player.s);
    for (const rider of riders) rider.fixedUpdate(1 / 60);
    combat.fixedUpdate(); physics.step(1 / 60);
    for (const rider of riders) rider.postStep();
    traffic.postStep(); race.postStep(1 / 60);
  };
  return { player, opponents, riders, race, traffic, track, input, combat, step, scene, physics };
}

test('countdown and timer pause, finish ordering and retry fully reset the race', () => {
  const { race, player, opponents, step } = setup();
  race.start();
  for (let i = 0; i < 60; i++) step();
  race.pause(); const remaining = race.remainingCountdown;
  for (let i = 0; i < 60; i++) step();
  assert.equal(race.remainingCountdown, remaining); assert.equal(race.elapsed, 0);
  race.resume();
  for (let i = 0; i < 125; i++) step();
  assert.equal(race.state, 'racing');
  race.pause(); const elapsed = race.elapsed;
  for (let i = 0; i < 60; i++) step();
  assert.equal(race.elapsed, elapsed); race.resume();
  player.placeAt(race.finishS - 0.2, 2, 10);
  opponents[0].placeAt(race.finishS - 0.8, -2, 10);
  race.entries[0].previousS = race.finishS - 0.2;
  race.entries[1].previousS = race.finishS - 0.8;
  player.placeAt(race.finishS + 0.8, 2, 10);
  opponents[0].placeAt(race.finishS + 0.2, -2, 10);
  race.postStep(1 / 60);
  assert.equal(race.state, 'results'); assert.equal(race.result.finished, true);
  assert.equal(race.rank, 1);
  const resultScore = race.score; race.postStep(1 / 60); assert.equal(race.score, resultScore);
  player.down = true; player.health = 0; player.impactCd = 2; player.staminaDelay = 2;
  race.start();
  assert.equal(race.state, 'countdown'); assert.equal(race.score, 0); assert.equal(race.result, null);
  assert.equal(player.health, BIKE.maxHealth); assert.equal(player.stamina, COMBAT.maxStamina);
  assert.equal(player.impactCd, 0); assert.equal(player.staminaDelay, 0); assert.equal(player.down, false);
  assert.equal(player.rideTime, 0); assert(race.entries.every(e => e.finishTime === null));
});

test('AI approaches, attacks, avoids traffic and steers toward its lane', () => {
  const { player, opponents, traffic } = setup(); const rival = opponents[0];
  player.placeAt(100, 0, 40); rival.placeAt(100, -1.8, 40);
  const command = rival.think(1 / 60);
  assert.equal(command.attackR, true); assert.equal(rival.brainState, 'swing');
  const cooldown = rival.attackCooldown; rival.think(1 / 60); assert(rival.attackCooldown < cooldown);
  traffic.cars[0].teleport(115, { lat: -1.8, dir: -1, speed: [20,20] });
  rival.think(1 / 60); assert.equal(rival.brainState, 'evade');
  traffic.cars[0].park(); player.placeAt(300, 0, 40); rival.placeAt(100, 4, 40);
  assert(rival.think(1 / 60).steer > 0);
});

test('near misses award once, and the time limit always ends a stalled race', () => {
  const { race, player, traffic } = setup(); race.start(); race.setState('racing');
  const car = traffic.cars[0]; player.placeAt(100, 0, 30);
  car.teleport(103, { lat: 1.7, dir: -1, speed: [20,20] });
  race.checkNearMisses(); car.s = 99; race.checkNearMisses(); race.checkNearMisses();
  assert.equal(race.nearMisses, 1); assert.equal(race.score, RACE.nearMissPoints);
  race.elapsed = RACE.maxTime; race.postStep(1 / 60);
  assert.equal(race.state, 'results'); assert.equal(race.result.finished, false);
});

test('a complete simulated race reaches results and reuses all scene objects on retry', () => {
  const { player, opponents, riders, race, input, step, scene } = setup();
  const count = scene.children.length;
  let attacks = 0;
  const off = events.on('swing', ({ rider }) => { if (opponents.includes(rider)) attacks++; });
  race.start();
  for (let i = 0; i < (RACE.maxTime + RACE.countdown + 1) * 60 && race.state !== 'results'; i++) {
    // Test driver follows the lane and holds full throttle; game physics remains unchanged.
    const desired = Math.max(-0.23, Math.min(0.23, Math.atan2(player.drift, Math.max(8, player.speed)) - (2.3 - player.lat) * 0.13));
    input.steer = Math.max(-1, Math.min(1, (desired - player.relYaw) * 8));
    step();
  }
  off();
  assert.equal(race.state, 'results'); assert(race.result.finished, 'test driver should reach the actual finish');
  assert(riders.every(r => Number.isFinite(r.s) && Number.isFinite(r.speed)));
  assert(opponents.every(r => r.s > 500));
  assert(attacks > 0, 'rivals must fight during a race');
  console.log(`Race simulation: ${race.result.time.toFixed(1)}s, place ${race.rank}, AI attacks ${attacks}`);
  race.start(); assert.equal(scene.children.length, count);
});

test('ten racers have unique grid slots and difficulty changes speed and attack cadence only between races', async () => {
  const { DIFFICULTIES } = await import('../src/core/constants.js');
  const { race, riders, player, opponents } = setup();
  assert.equal(riders.length, 10);
  assert.equal(new Set(riders.map(r => `${r.s}:${r.lat}`)).size, 10);
  assert.equal(race.rank, 5);
  assert(riders.every(r => r.s >= RACE.startS));
  const rival = opponents[0];
  player.placeAt(500, 0, 40); rival.placeAt(100, -2, 60);
  rival.difficulty = DIFFICULTIES.easy; const easyThrottle = rival.think(1 / 60).throttle;
  rival.difficulty = DIFFICULTIES.hard; assert(rival.think(1 / 60).throttle > easyThrottle);
  player.placeAt(100, 0, 40); rival.placeAt(100, -1.8, 40);
  rival.difficulty = DIFFICULTIES.easy; rival.attackCooldown = 0; rival.think(1 / 60); const easyCooldown = rival.attackCooldown;
  rival.difficulty = DIFFICULTIES.hard; rival.attackCooldown = 0; rival.think(1 / 60); assert(rival.attackCooldown < easyCooldown);
  assert.equal(race.setDifficulty('hard'), true); race.start();
  assert(opponents.every(r => r.difficulty === DIFFICULTIES.hard));
  assert.equal(race.setDifficulty('easy'), false);
  race.setState('results'); assert.equal(race.setDifficulty('easy'), true); race.start();
  assert(opponents.every(r => r.difficulty === DIFFICULTIES.easy));
});

test('landed hits recoil, reuse burst geometry, pause visually, and three quick blows dismount', async () => {
  const { HitEffects } = await import('../src/combat/HitEffects.js');
  const { scene, riders, player, opponents } = setup();
  const fx = new HitEffects(scene, riders, player), camera = new THREE.PerspectiveCamera();
  const target = opponents[0], count = scene.children.length;
  const blow = () => {
    assert(target.receiveHit({ nx: 1, nz: 0, ...COMBAT.weapons.bat, attacker: player }));
    events.emit('hit', { attacker: player, target, weapon: 'bat' });
  };
  blow(); fx.update(1 / 60, camera);
  assert(fx.effects[1].burst.visible); assert.notEqual(target.riderMesh.rotation.z, 0);
  const recoil = target.riderMesh.rotation.z; fx.update(0, camera); assert.equal(target.riderMesh.rotation.z, recoil);
  assert(target.knockX > 0); assert(target.stagger > 0);
  blow(); blow(); assert(target.down);
  fx.update(1, camera); assert.equal(fx.effects[1].burst.visible, false);
  fx.reset(); assert.equal(target.riderMesh.rotation.z, 0); assert.equal(scene.children.length, count);
});


test('police trigger naturally, participate in combat, pause, reward once and reuse pool on retry', async () => {
  const { Police } = await import('../src/ai/Police.js');
  const { POLICE } = await import('../src/core/constants.js');
  const { scene, physics, track, player, traffic, combat, race, riders } = setup();
  const police = new Police(scene, physics, track, player, traffic, combat, race);
  const fighters = [...riders]; police.addTo(fighters); combat.fighters = fighters;
  const objects = scene.children.length, bodies = physics.world.bodies.length;
  race.start(); race.setState('racing');
  police.fixedUpdate(POLICE.firstAlert + 0.01); assert(police.active);
  police.fixedUpdate(POLICE.spawnDelay + 0.01); assert.equal(police.count, 2);
  assert.equal(race.riders.length, 10); assert.equal(combat.fighters.length, 12);
  const cop = police.cops[0]; player.placeAt(120, 0, 30); cop.placeAt(120, 1.8, 30);
  assert.equal(combat.autoAttackSide(player), 1);
  player.melee.tryStart(1); player.melee.update(COMBAT.weapons.bat.windup + 0.1); combat.fixedUpdate();
  assert(cop.health < BIKE.maxHealth, 'police must receive real combat damage');
  race.pause(); const time = police.chaseTime; police.fixedUpdate(10); assert.equal(police.chaseTime, time);
  race.resume(); const score = race.score;
  police.fixedUpdate(POLICE.chaseDuration + 0.1);
  assert(!police.active); assert.equal(race.score, score + POLICE.escapePoints);
  police.fixedUpdate(0.1); assert.equal(race.score, score + POLICE.escapePoints);
  race.setState('results'); race.start();
  assert.equal(police.count, 0); assert(police.cops.every(c => c.down && c.body.collisionFilterMask === 0));
  assert.equal(scene.children.length, objects); assert.equal(physics.world.bodies.length, bodies);
});

test('sparks have visible geometry, respond to collisions and hits, and clear on retry', async () => {
  const { Particles } = await import('../src/visuals/Particles.js');
  const { scene, player, opponents } = setup();
  const particles = new Particles(scene), camera = new THREE.PerspectiveCamera();
  const count = scene.children.length;
  events.emit('impact', { rider: player, speed: 18, kind: 'traffic' });
  assert(particles.sparks.some(s => s.mesh.visible));
  particles.sparks[0].mesh.geometry.computeBoundingBox();
  assert(particles.sparks[0].mesh.geometry.boundingBox.max.x >= 0.5);
  const life = particles.sparks[0].p.life;
  particles.update(0, [player], null, camera); assert.equal(particles.sparks[0].p.life, life);
  events.emit('hit', { attacker: player, target: opponents[0], weapon: 'bat' });
  particles.update(2, [], null, camera); assert(particles.sparks.every(s => !s.mesh.visible));
  events.emit('raceReset', {}); assert(particles.smokes.every(s => !s.mesh.visible));
  assert.equal(scene.children.length, count);
});

test('patrol bikes advance through actual physics with finite interpolated transforms', async () => {
  const { Police } = await import('../src/ai/Police.js');
  const { scene, physics, track, player, traffic, combat, race, riders } = setup();
  const police = new Police(scene, physics, track, player, traffic, combat, race);
  const fighters = [...riders]; police.addTo(fighters); combat.fighters = fighters;
  race.start(); race.setState('racing'); player.placeAt(300, 0, 30);
  police.arm(); police.trySpawn(); const start = police.cops[0].s;
  for (let i = 0; i < 300; i++) {
    player.fixedUpdate(1 / 60); police.fixedUpdate(1 / 60); combat.fixedUpdate();
    physics.step(1 / 60); player.postStep(); police.postStep(); police.update(1 / 60, 0.5);
  }
  assert(police.cops[0].s > start + 50);
  for (const cop of police.cops) {
    assert(Number.isFinite(cop.mesh.position.x)); assert(Number.isFinite(cop.mesh.rotation.y));
  }
});


test('challenges lock during a race, pay once on finish and never pay on timeout', () => {
  const { race, player } = setup();
  assert(race.setChallenge('hits')); race.start(); race.setState('racing');
  assert.equal(race.setChallenge('podium'), false);
  race.hits = 5; player.placeAt(race.finishS + 1, 0, 30); race.postStep(1 / 60);
  assert(race.result.challengeWon); assert.equal(race.result.bonus, 500);
  const score = race.score; race.postStep(1 / 60); assert.equal(race.score, score);
  race.start(); race.setState('racing'); race.hits = 5; race.elapsed = RACE.maxTime; race.postStep(1 / 60);
  assert.equal(race.result.challengeWon, false); assert.equal(race.result.bonus, 0);
});

test('records survive reload, isolate difficulty and tolerate blocked/corrupt storage', async () => {
  const { Records } = await import('../src/race/Records.js');
  let data = null; const storage = { getItem: () => data, setItem: (_, value) => { data = value; } };
  const records = new Records(storage);
  assert.deepEqual(records.record('medium', { finished: true, time: 90, score: 500 }), { newScore: true, newTime: true });
  records.record('medium', { finished: true, time: 100, score: 700 });
  const restored = new Records(storage); assert.deepEqual(restored.data.medium, { time: 90, score: 700 });
  assert.equal(restored.data.hard, undefined);
  restored.record('hard', { finished: false, time: 240, score: 5000 }); assert.equal(restored.data.hard, undefined);
  data = '{broken'; assert.deepEqual(new Records(storage).data, {});
  const blocked = new Records({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  blocked.record('easy', { finished: true, time: 120, score: 400 }); assert.equal(blocked.saved, false);
});

test('rival wind-up is readable and animated arms restore after an interruption', () => {
  const { player, opponents } = setup(); const rival = opponents[0], m = rival.melee;
  assert(m.windup > player.melee.windup);
  m.tryStart(1); m.update(0.2); assert.equal(m.active, false); m.pose();
  assert.equal(rival.riderMesh.userData.ridingArms[1].visible, false);
  assert.equal(rival.riderMesh.userData.ridingArms[-1].visible, true);
  assert(m.arms[1].mesh.material.emissive.getHex() !== 0);
  m.update(m.windup); assert(m.active); m.cancel();
  assert.equal(rival.riderMesh.userData.ridingArms[1].visible, true);
  assert.equal(m.arms[1].arm.visible, false);
});
