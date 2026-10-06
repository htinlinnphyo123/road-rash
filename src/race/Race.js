import { RACE, DIFFICULTIES } from '../core/constants.js';
import { events } from '../core/Events.js';

export class Race {
  constructor(riders, player, track, traffic) {
    this.riders = riders; this.player = player; this.track = track; this.traffic = traffic;
    this.entries = riders.map((rider, index) => ({ rider, index, previousS: 0, finishTime: null }));
    this.standings = this.entries.slice();
    this.difficulty = 'medium';
    this.state = 'menu'; this.resumeState = 'racing'; this.elapsed = 0;
    this.remainingCountdown = RACE.countdown; this.lastCount = RACE.countdown;
    this.finishS = RACE.startS + RACE.length;
    this.rank = riders.length; this.score = 0; this.hits = 0; this.takedowns = 0; this.nearMisses = 0;
    this.topSpeed = 0; this.result = null; this.projection = {};
    this.nearCars = new Map();
    for (const car of traffic.cars) this.nearCars.set(car, { previous: 0, armed: false, closest: Infinity });
    events.on('hit', ({ attacker }) => { if (this.state === 'racing' && attacker === player) { this.hits++; this.score += RACE.hitPoints; } });
    events.on('dismount', ({ attacker }) => { if (this.state === 'racing' && attacker === player) { this.takedowns++; this.score += RACE.takedownPoints; } });
    this.reset();
  }
  setDifficulty(key) {
    if (!Object.hasOwn(DIFFICULTIES, key) || (this.state !== 'menu' && this.state !== 'results')) return false;
    this.difficulty = key;
    return true;
  }
  setState(state) { this.state = state; events.emit('raceState', { state }); }
  reset() {
    this.elapsed = this.score = this.hits = this.takedowns = this.nearMisses = this.topSpeed = 0;
    this.remainingCountdown = RACE.countdown; this.lastCount = RACE.countdown; this.result = null;
    for (const entry of this.entries) {
      // Player starts mid-pack; every slot remains on positive track space.
      const playerSlot = Math.floor(this.riders.length / 2);
      const slot = entry.index === 0 ? playerSlot : entry.index <= playerSlot ? entry.index - 1 : entry.index;
      const row = Math.floor(slot / 2);
      const s = RACE.startS + (Math.ceil(this.riders.length / 2) - 1 - row) * RACE.gridGap;
      const lat = slot % 2 ? -RACE.gridLane : RACE.gridLane;
      if (entry.rider !== this.player) entry.rider.difficulty = DIFFICULTIES[this.difficulty];
      entry.rider.resetRace(s, lat);
      entry.previousS = s; entry.finishTime = null;
    }
    for (const car of this.traffic.cars) car.park();
    for (const state of this.nearCars.values()) { state.armed = false; state.closest = Infinity; state.previous = 0; }
    this.updateRank();
    events.emit('raceReset', {});
  }
  start() {
    if (this.state !== 'menu' && this.state !== 'results') return;
    this.reset(); this.setState('countdown');
    events.emit('countdown', { count: RACE.countdown });
  }
  pause() {
    if (this.state !== 'racing' && this.state !== 'countdown') return;
    this.resumeState = this.state; this.setState('paused');
  }
  resume() { if (this.state === 'paused') this.setState(this.resumeState); }
  beforeStep(dt) {
    if (this.state === 'countdown') {
      this.remainingCountdown = Math.max(0, this.remainingCountdown - dt);
      const count = Math.ceil(this.remainingCountdown);
      if (count !== this.lastCount) { this.lastCount = count; events.emit('countdown', { count }); }
      if (this.remainingCountdown === 0) this.setState('racing');
      return false;
    }
    return this.state === 'racing';
  }
  updateRank() {
    this.standings.sort((a, b) => {
      if (a.finishTime !== null || b.finishTime !== null) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity) || a.index - b.index;
      return b.rider.s - a.rider.s || a.index - b.index;
    });
    this.rank = this.standings.findIndex((entry) => entry.rider === this.player) + 1;
  }
  postStep(dt) {
    if (this.state !== 'racing') return;
    this.elapsed += dt;
    for (const entry of this.entries) {
      const rider = entry.rider;
      this.track.project(rider.body.position.x, rider.body.position.z, rider.s, this.projection);
      rider.s = this.projection.s; rider.lat = this.projection.lat;
      if (entry.finishTime === null && rider.s >= this.finishS) {
        const fraction = Math.max(0, Math.min(1, (this.finishS - entry.previousS) / Math.max(0.001, rider.s - entry.previousS)));
        entry.finishTime = this.elapsed - dt + dt * fraction;
      }
      entry.previousS = rider.s;
    }
    this.topSpeed = Math.max(this.topSpeed, this.player.speed);
    this.updateRank(); this.checkNearMisses();
    const playerEntry = this.entries[0];
    if (playerEntry.finishTime !== null || this.elapsed >= RACE.maxTime) {
      const finished = playerEntry.finishTime !== null;
      if (finished) this.score += RACE.finishPoints + (this.riders.length - this.rank) * RACE.positionPoints;
      this.result = { finished, rank: this.rank, time: playerEntry.finishTime ?? this.elapsed,
        score: this.score, takedowns: this.takedowns, nearMisses: this.nearMisses, topSpeed: this.topSpeed };
      this.setState('results'); events.emit('raceFinished', this.result);
    }
  }
  checkNearMisses() {
    const p = this.player;
    for (const car of this.traffic.cars) {
      const state = this.nearCars.get(car), gap = car.s - p.s;
      if (!car.active || Math.abs(gap) > 15) { state.armed = false; state.closest = Infinity; state.previous = gap; continue; }
      if (!state.armed && gap > 0) state.armed = true;
      if (Math.abs(gap) < 5) state.closest = Math.min(state.closest, Math.abs(car.lat - p.lat));
      if (state.armed && state.previous >= 0 && gap < 0) {
        state.armed = false;
        if (!p.down && p.impactCd <= 0 && p.speed >= RACE.nearMissSpeed && state.closest >= RACE.nearMissMin && state.closest <= RACE.nearMissMax) {
          this.nearMisses++; this.score += RACE.nearMissPoints;
          events.emit('nearMiss', { points: RACE.nearMissPoints });
        }
      }
      state.previous = gap;
    }
  }
}
