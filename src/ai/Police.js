import * as THREE from 'three';
import { POLICE, AI, BIKE, DIFFICULTIES } from '../core/constants.js';
import { Rider } from '../entities/Rider.js';
import { dressPoliceBike } from '../visuals/PoliceBike.js';
import { events } from '../core/Events.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

class CopRider extends Rider {
  constructor(scene, physics, track, slotIndex, player, traffic, combat) {
    super(scene, physics, track, { color: POLICE.color, shirt: POLICE.shirt });
    this.name = `${POLICE.name}-${slotIndex + 1}`;
    this.style = POLICE.style;
    this.cruise = POLICE.cruise;
    this.aggression = POLICE.aggression;
    this.laneLat = 0;
    this.player = player;
    this.traffic = traffic;
    this.combat = combat;
    this.look = {};
    this.attackCooldown = 0;
    this.brainState = 'hunt';
    this.difficulty = DIFFICULTIES.hard;
    this.sideswipeT = 0;
    this.sideswipeSide = 0;
    this._inp = { throttle: 0, brake: 0, steer: 0, attackL: false, attackR: false };
    this._stag = { throttle: 0, brake: 0, steer: 0 };
    this.lightPhase = Math.random() * Math.PI * 2;

    const siren1 = new THREE.PointLight(0x3da2ff, 5.5, 30, 1.4);
    siren1.position.set(-0.25, 1.55, -0.15);
    const siren2 = new THREE.PointLight(0xff3b3b, 5.5, 30, 1.4);
    siren2.position.set(0.25, 1.55, -0.15);
    this.leanGroup.add(siren1, siren2);
    this.sirens = [siren1, siren2];
    const g1 = new THREE.MeshStandardMaterial({ color: 0x3da2ff, emissive: 0x1f6bff, emissiveIntensity: 1.6, roughness: 0.3 });
    const g2 = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff1e1e, emissiveIntensity: 1.6, roughness: 0.3 });
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.4), g1);
    bar1.position.set(-0.2, 1.38, -0.18);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.4), g2);
    bar2.position.set(0.2, 1.38, -0.18);
    this.leanGroup.add(bar1, bar2);
    this.sirenMeshes = [bar1, bar2];
    this.sirenMats = [g1, g2];
    dressPoliceBike(this.leanGroup);
    this.active = false;
  }

  think(dt) {
    const c = this._inp, level = this.difficulty;
    const cruise = Math.min(BIKE.maxSpeed, this.cruise + level.speed);
    const aggression = this.aggression * level.aggression;
    c.attackL = c.attackR = false;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.sideswipeT = Math.max(0, this.sideswipeT - dt);

    let lane = this.laneLat;
    const gap = this.player.s - this.s;
    this.brainState = Math.abs(gap) > POLICE.huntRange ? 'race' : 'hunt';

    const within = Math.abs(gap) < POLICE.huntRange && !this.player.down;
    let targetSpeed = cruise + clamp(gap * AI.rubberBand * 1.4, -level.catchup, level.catchup + 4);
    if (within) {
      targetSpeed = clamp(this.player.speed + gap * 1.3 * aggression, 28, cruise + 12);
      const alongside = this.sideswipeT > 0 || (
        aggression > 0.5 &&
        gap >= -5.5 && gap <= -1.5 &&
        Math.abs(this.lat - this.player.lat) < 3.5 &&
        this.speed > 28 && Math.random() < dt * 0.6 * aggression * POLICE.ramChance
      );
      if (alongside) {
        if (this.sideswipeT <= 0) {
          this.sideswipeSide = this.lat < this.player.lat ? 1 : -1;
          this.sideswipeT = 1.5;
        }
        lane = this.player.lat + this.sideswipeSide * 1.1;
        targetSpeed = Math.max(targetSpeed, this.speed + 5);
        this.brainState = 'sideswipe';
      } else if (Math.abs(gap) < AI.approachRange) {
        const side = this.lat < this.player.lat ? -1 : 1;
        lane = this.player.lat + side * 1.4;
        this.brainState = 'approach';
      } else {
        lane = this.player.lat + (this.sideswipeSide || (this.laneLat < 0 ? -1 : 1)) * 2;
      }
    }

    for (const car of this.traffic.cars) {
      if (!car.active) continue;
      const ahead = car.s - this.s;
      const closingSpeed = Math.max(0, this.speed - car.dir * car.speed);
      if (ahead > -AI.trafficMargin && ahead < AI.trafficMargin + closingSpeed * AI.trafficHorizon && Math.abs(car.lat - lane) < AI.trafficLaneGap) {
        lane = car.lat >= 0 ? -AI.trafficLaneGap : AI.trafficLaneGap;
        if (this.brainState !== 'sideswipe') this.brainState = 'evade';
        if (ahead > 0 && ahead < AI.trafficMargin && Math.abs(car.lat - this.lat) < AI.trafficLaneGap) targetSpeed = AI.minimumSpeed;
      }
    }

    lane = clamp(lane, -AI.laneLimit, AI.laneLimit);
    this.track.at(this.s + AI.lookAhead, this.look);
    targetSpeed = Math.min(targetSpeed, Math.sqrt(AI.curveAcceleration * level.curve / Math.max(0.001, Math.abs(this.look.k))));
    const aggressive = this.brainState === 'sideswipe' || this.brainState === 'approach';
    const lateralKick = AI.lateralGain * (aggressive ? 1.9 : 1);
    const headingLimit = AI.headingLimit * (aggressive ? 1.35 : 1);
    const desiredYaw = clamp(Math.atan2(this.drift, Math.max(8, this.speed)) - (lane - this.lat) * lateralKick, -headingLimit, headingLimit);
    const steerBoost = aggressive ? 1.6 : 1;
    c.steer = clamp((desiredYaw - this.relYaw) * AI.steerGain * steerBoost, -1, 1);
    c.brake = this.speed > targetSpeed + 5 ? 0.4 : 0;
    c.throttle = clamp((Math.min(level.acceleration + 4, (targetSpeed - this.speed) * AI.response * 1.25) + BIKE.drag * this.speed + BIKE.rolling) / BIKE.accel, 0, 1);

    if (this.brainState !== 'evade' && this.attackCooldown <= 0 && !this.down && this.melee.state === 'idle' && this.brainState !== 'sideswipe') {
      const side = this.combat?.autoAttackSide(this) ?? 0;
      if (side && this.stamina >= this.melee.weapon.cost) {
        c.attackL = side === -1; c.attackR = side === 1;
        this.attackCooldown = AI.attackCooldown * 0.55 / aggression;
        this.brainState = 'swing';
      }
    }
    return c;
  }
}

export class Police {
  constructor(scene, physics, track, player, traffic, combat, race) {
    this.player = player; this.traffic = traffic; this.race = race;
    this.cops = [];
    for (let i = 0; i < POLICE.maxCops; i++) this.cops.push(new CopRider(scene, physics, track, i, player, traffic, combat));
    this.active = false; this.spawnT = 0; this.chaseTime = 0;
    this.takedownsTriggered = 0; this.nextAlert = POLICE.firstAlert;
    this.disarm();
    events.on('dismount', ({ attacker, rider }) => {
      if (this.race?.state !== 'racing' || attacker !== player || rider === player) return;
      if (++this.takedownsTriggered >= POLICE.takedownThreshold && !this.active) this.arm();
    });
    events.on('raceReset', () => { this.disarm(); this.nextAlert = POLICE.firstAlert; });
    events.on('raceState', ({ state }) => { if (state === 'results') this.disarm(); });
  }
  get count() { let n = 0; for (const cop of this.cops) if (cop.active) n++; return n; }
  arm() {
    if (this.active || this.race?.state !== 'racing') return;
    this.active = true; this.spawnT = POLICE.spawnDelay; this.chaseTime = 0;
    events.emit('policeAlert', { active: true });
  }
  disarm() {
    this.active = false; this.spawnT = 0; this.chaseTime = 0; this.takedownsTriggered = 0;
    for (const cop of this.cops) {
      cop.active = false; cop.down = true; cop.mesh.visible = false;
      cop.melee.cancel(); cop.ragdoll.hide();
      cop.body.collisionFilterMask = 0; cop.body.velocity.setZero();
      cop.body.position.set(0, -50, 0); cop.body.aabbNeedsUpdate = true;
      for (const light of cop.sirens) light.intensity = 0;
    }
    events.emit('policeAlert', { active: false });
  }
  fixedUpdate(dt) {
    if (this.race?.state !== 'racing') return;
    if (!this.active) {
      this.nextAlert -= dt;
      if (this.nextAlert <= 0) this.arm();
      return;
    }
    if (this.spawnT > 0) {
      this.spawnT = Math.max(0, this.spawnT - dt);
      if (this.spawnT === 0) this.trySpawn();
      return;
    }
    this.chaseTime += dt;
    let escaped = this.count > 0;
    for (const cop of this.cops) {
      if (!cop.active) continue;
      cop.fixedUpdate(dt);
      if (!cop.down && this.player.s - cop.s < POLICE.escapeDistance) escaped = false;
    }
    if ((!this.player.down && escaped) || this.chaseTime >= POLICE.chaseDuration) {
      const points = this.player.down ? 0 : POLICE.escapePoints;
      this.disarm(); this.nextAlert = POLICE.cooldown;
      events.emit('policeEscape', { points });
    }
  }
  trySpawn() {
    if (!this.active || this.race?.state !== 'racing' || this.count) return;
    for (let i = 0; i < this.cops.length; i++) {
      const cop = this.cops[i];
      const s = Math.max(0, this.player.s - POLICE.spawnBehind - i * POLICE.spawnGap);
      const lat = i % 2 ? -3.8 : 3.8;
      cop.resetRace(s, lat); cop.placeAt(s, lat, Math.max(20, this.player.speed));
      cop.laneLat = lat; cop.sideswipeT = 0; cop.sideswipeSide = i % 2 ? -1 : 1;
      cop.difficulty = DIFFICULTIES[this.race.difficulty];
      cop.body.collisionFilterMask = this.player.body.collisionFilterMask;
      cop.active = cop.mesh.visible = true;
    }
    this.spawnT = 0;
  }
  postStep() { for (const cop of this.cops) if (cop.active) cop.postStep(); }
  update(dt, alpha) {
    for (const cop of this.cops) {
      if (!cop.active) continue;
      cop.lightPhase += dt * 10;
      const blink = Math.sin(cop.lightPhase) > 0 ? 1 : 0;
      cop.sirens[0].intensity = 3 * (1 - blink); cop.sirens[1].intensity = 3 * blink;
      cop.sirenMats[0].emissiveIntensity = 3 * (1 - blink); cop.sirenMats[1].emissiveIntensity = 3 * blink;
      cop.render(alpha, dt);
    }
  }
  addTo(list) { for (const cop of this.cops) if (!list.includes(cop)) list.push(cop); }
}
