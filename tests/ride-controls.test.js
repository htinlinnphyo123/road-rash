import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AUTO_DRIVE, RIDER_CAMERA } from '../src/core/constants.js';
import { Input } from '../src/core/Input.js';
import { RiderCamera } from '../src/camera/RiderCamera.js';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.js';
import { Track } from '../src/world/Track.js';

globalThis.location = { search: '' };
const { PlayerBike } = await import('../src/entities/PlayerBike.js');

test('auto throttle starts gently, builds with simulation time, caps and yields to braking', () => {
  const input = { brake: 0, steer: 0, consume: () => false };
  const bike = new PlayerBike(new THREE.Scene(), new PhysicsWorld(), new Track(1337), input);
  const step = (seconds) => { for (let i = 0; i < seconds * 60; i++) bike.fixedUpdate(1 / 60); };
  step(1);
  assert(bike.speed > 3 && bike.speed <= AUTO_DRIVE.acceleration + 0.01);
  step(AUTO_DRIVE.warmup - 2);
  assert(Math.abs(bike.speed - AUTO_DRIVE.startSpeed) < 0.1);
  step(60);
  const middleSpeed = bike.speed;
  assert(middleSpeed > AUTO_DRIVE.startSpeed + 10);
  step(180);
  assert.equal(bike.cruiseSpeed, AUTO_DRIVE.maxSpeed);
  assert(Math.abs(bike.speed - AUTO_DRIVE.maxSpeed) < 0.1);
  input.brake = 1; step(2);
  assert.equal(bike.speed, 0);
  assert.equal(bike.think(1 / 60).throttle, 0);
  input.brake = 0; step(1);
  assert(bike.speed <= AUTO_DRIVE.acceleration + 0.01);
  bike.dismount();
  const time = bike.rideTime;
  step(1);
  assert.equal(bike.rideTime, time);
  assert.equal(bike.think(1 / 60).throttle, 0);
});

test('close chase camera keeps a stable follow distance and remains finite after crash', () => {
  const camera = new THREE.PerspectiveCamera();
  const view = new RiderCamera(camera);
  const bike = { position: new THREE.Vector3(400, 0.5, -1000), renderYaw: 0.7, speed: 58, lean: 0.5, down: false };
  view.update(1 / 60, bike);
  assert(Math.abs(camera.position.y - bike.position.y - RIDER_CAMERA.height) < 1e-8);
  assert(camera.position.distanceTo(bike.position) > 4 && camera.position.distanceTo(bike.position) < 5);
  assert(camera.fov > RIDER_CAMERA.baseFov);
  bike.position.z -= 100;
  view.update(1 / 60, bike);
  assert(camera.position.distanceTo(bike.position) > 4 && camera.position.distanceTo(bike.position) < 5);
  bike.down = true;
  view.addShake(1); view.update(1 / 60, bike);
  assert(camera.position.toArray().every(Number.isFinite));
});

test('touch supports steering plus combat, cancellation, braking, and clearing on pause', () => {
  const listeners = {};
  globalThis.addEventListener = (name, callback) => { listeners[name] = callback; };
  function button(code) {
    return { dataset: { driveKey: code }, handlers: {}, classList: { add() {}, remove() {}, toggle() {} },
      setPointerCapture() {}, addEventListener(name, callback) { this.handlers[name] = callback; } };
  }
  const left = button('KeyA'), right = button('KeyD'), hit = button('Space'), brake = button('KeyS');
  globalThis.document = { querySelectorAll: () => [left, right, hit, brake] };
  const canvas = { addEventListener(name, fn) { this[name] = fn; } };
  const input = new Input(canvas);
  listeners.keydown({ code: 'ArrowUp', repeat: false, preventDefault() {} });
  assert.equal(input.throttle, 1);
  listeners.keyup({ code: 'ArrowUp' });
  assert.equal(input.throttle, 0);
  for (const code of ['Space']) {
    let prevented = false;
    listeners.keydown({ code, repeat: false, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(input.consume(code), true);
    listeners.keydown({ code, repeat: true, preventDefault() {} });
    assert.equal(input.consume(code), false);
    listeners.keyup({ code });
  }
  canvas.pointerdown({ pointerType: 'mouse', button: 0, preventDefault() {} });
  assert.equal(input.consume('Space'), true);
  canvas.pointerdown({ pointerType: 'mouse', button: 2, preventDefault() {} });
  assert.equal(input.consume('Space'), false);
  listeners.keydown({ code: 'Enter', repeat: false, preventDefault() {} });
  assert.equal(input.consume('Enter'), false);
  const event = (pointerId) => ({ pointerId, preventDefault() {} });
  left.handlers.pointerdown(event(1)); hit.handlers.pointerdown(event(2));
  assert.equal(input.steer, 1);
  assert.equal(input.consume('Space'), true);
  assert.equal(input.consume('Space'), false);
  hit.handlers.pointerup(event(2));
  assert.equal(input.steer, 1);
  left.handlers.pointercancel(event(1));
  assert.equal(input.steer, 0);
  right.handlers.pointerdown(event(3)); brake.handlers.pointerdown(event(4));
  assert.equal(input.steer, -1); assert.equal(input.brake, 1);
  input.setEnabled(false);
  canvas.pointerdown({ pointerType: 'mouse', button: 0, preventDefault() {} });
  assert.equal(input.consume('Space'), false);
  assert.equal(input.steer, 0); assert.equal(input.brake, 0);
  hit.handlers.pointerdown(event(5)); assert.equal(input.consume('Space'), false);
  input.setEnabled(true);
  left.handlers.pointerdown(event(6)); listeners.blur();
  assert.equal(input.steer, 0);
});

test('pause clears input, updates the menu, and refuses resume in portrait', async () => {
  const { HUD } = await import('../src/ui/HUD.js');
  globalThis.document = { body: { classList: { toggle() {} } } };
  const hud = Object.create(HUD.prototype);
  hud.portrait = { matches: false };
  hud.started = false;
  hud.input = { enabled: false, setEnabled(enabled) { this.enabled = enabled; } };
  hud.nodes = { menu: {}, ride: {}, 'menu-copy': { textContent: 'Initial instructions' }, 'cruise-status': { textContent: 'Cruise target' } };
  hud.setPaused(false);
  assert.equal(hud.input.enabled, true);
  assert.equal(hud.nodes.menu.hidden, true);
  hud.setPaused(true);
  assert.equal(hud.input.enabled, false);
  assert.equal(hud.nodes.menu.hidden, false);
  assert.match(hud.nodes['menu-copy'].textContent, /Ride paused/);
  assert.equal(hud.nodes['cruise-status'].textContent, 'Cruise target');
  hud.portrait.matches = true;
  hud.setPaused(false);
  assert.equal(hud.paused, true);
  hud.portrait.matches = false;
  assert.equal(hud.paused, true);
  hud.setPaused(false);
  assert.equal(hud.paused, false);
});

test('the full motorcycle fits the close camera in phone landscape and car variants fit traffic bounds', async () => {
  const { makeCar } = await import('../src/visuals/Vehicles.js');
  const bike = new PlayerBike(new THREE.Scene(), new PhysicsWorld(), new Track(1337), { brake: 0, steer: 0, consume: () => false });
  bike.render(1, 0);
  const camera = new THREE.PerspectiveCamera(64, 844 / 390, 0.1, 600);
  new RiderCamera(camera).update(0, bike);
  camera.updateMatrixWorld();
  bike.mesh.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  bike.mesh.traverseVisible((part) => {
    if (!part.isMesh) return;
    part.geometry.computeBoundingBox();
    bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
  });
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const screen = new THREE.Vector3(x, y, z).project(camera);
    assert(Math.abs(screen.x) < 0.95 && Math.abs(screen.y) < 0.95, 'whole motorcycle remains inside the frame');
  }
  assert(bike.riderMesh.children.every((part) => camera.layers.test(part.layers)));
  for (let variant = 0; variant < 3; variant++) {
    const car = makeCar(0xff2222, variant);
    const size = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
    assert(size.x < 2 && size.y <= 1.5 && size.z < 4.3);
    car.traverse((part) => {
      if (part.isMesh) assert(Array.from(part.geometry.attributes.position.array).every(Number.isFinite));
    });
  }
});

test('manual throttle overtakes cruise, returns to auto on release, and brake wins', () => {
  const input = { throttle: 1, brake: 0, steer: 0, consume: () => false };
  const bike = new PlayerBike(new THREE.Scene(), new PhysicsWorld(), new Track(1337), input);
  for (let i = 0; i < 120; i++) bike.fixedUpdate(1 / 60);
  assert(bike.speed > AUTO_DRIVE.startSpeed + 15);
  assert.equal(bike.think(1 / 60).throttle, 1);
  input.throttle = 0;
  assert.equal(bike.think(1 / 60).throttle, 0);
  input.throttle = 1; input.brake = 1;
  assert.equal(bike.think(1 / 60).throttle, 0);
});

test('combat respects side, yaw, range, invulnerability and one hit per swing', async () => {
  const { Rider } = await import('../src/entities/Rider.js');
  const { Combat } = await import('../src/combat/Combat.js');
  const scene = new THREE.Scene(), physics = new PhysicsWorld(), track = new Track(1337);
  const attacker = new Rider(scene, physics, track), target = new Rider(scene, physics, track);
  const combat = new Combat([attacker, target]);
  target.body.position.set(2.5, 0.6, 0);
  assert.equal(combat.targetOnSide(attacker, 1), target);
  assert.equal(combat.targetOnSide(attacker, -1), null);
  attacker.melee.tryStart(1); attacker.melee.update(attacker.melee.windup + 0.1);
  const hp = target.health;
  combat.fixedUpdate(); combat.fixedUpdate();
  assert.equal(target.health, hp - attacker.melee.weapon.damage);
  attacker.melee.cancel(); attacker.melee.tryStart(-1); attacker.melee.update(attacker.melee.windup + 0.1);
  combat.fixedUpdate(); assert.equal(target.health, hp - attacker.melee.weapon.damage);
  attacker.yaw = Math.PI / 2; target.body.position.set(0, 0.6, -2.5);
  assert.equal(combat.targetOnSide(attacker, 1), target);
  target.invuln = 1; assert.equal(combat.targetOnSide(attacker, 1), null);
  target.invuln = 0; target.body.position.z = -4;
  assert.equal(combat.targetOnSide(attacker, 1), null);
});

test('late recovery inputs buffer once and cancellation prevents a delayed swing', async () => {
  const { Rider } = await import('../src/entities/Rider.js');
  const rider = new Rider(new THREE.Scene(), new PhysicsWorld(), new Track(1337));
  const m = rider.melee;
  m.tryStart(1); m.update(m.windup + m.weapon.active + 0.15);
  assert.equal(m.state, 'recovery');
  const stamina = rider.stamina;
  m.tryStart(-1); m.update(0.12);
  assert.equal(m.state, 'windup'); assert.equal(m.side, -1);
  assert.equal(rider.stamina, stamina - m.weapon.cost);
  m.update(m.windup + m.weapon.active + 0.15);
  m.tryStart(1); m.cancel(); m.update(0.15);
  assert.equal(m.state, 'idle'); assert.equal(m.bufferSide, 0);
});

test('one attack action chooses the nearest eligible side; no target costs no stamina', async () => {
  const { Rider } = await import('../src/entities/Rider.js');
  const { Combat } = await import('../src/combat/Combat.js');
  const scene = new THREE.Scene(), physics = new PhysicsWorld(), track = new Track(1337);
  let pressed = false;
  const input = { brake: 0, steer: 0, consume(code) { const hit = pressed && code === 'Space'; pressed = false; return hit; } };
  const player = new PlayerBike(scene, physics, track, input);
  const left = new Rider(scene, physics, track), right = new Rider(scene, physics, track);
  player.combat = new Combat([player, left, right]);
  left.body.position.set(-2, 0.6, 0); right.body.position.set(2.5, 0.6, 0);
  pressed = true; player.fixedUpdate(1 / 60);
  assert.equal(player.melee.side, -1); assert.equal(player.melee.state, 'windup');
  player.melee.update(0.12); player.combat.fixedUpdate();
  assert(left.health < right.health);
  player.melee.cancel(); left.down = true;
  pressed = true; player.fixedUpdate(1 / 60);
  assert.equal(player.melee.side, 1);
  player.melee.cancel(); right.invuln = 1;
  const stamina = player.stamina;
  pressed = true; player.fixedUpdate(1 / 60);
  assert.equal(player.melee.state, 'idle'); assert.equal(player.stamina, stamina);
  right.invuln = 0; player.yaw = Math.PI / 2;
  right.body.position.set(0, 0.6, -2);
  assert.equal(player.combat.autoAttackSide(player), 1);
  right.body.position.z = 2;
  assert.equal(player.combat.autoAttackSide(player), -1);
  right.body.position.z = 20;
  assert.equal(player.combat.autoAttackSide(player), 0);
});
