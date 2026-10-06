import { Rider } from '../entities/Rider.js';
import { AI, BIKE, DIFFICULTIES } from '../core/constants.js';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class AIRider extends Rider {
  constructor(scene, physics, track, spec, player, traffic) {
    super(scene, physics, track, spec);
    this.name = spec.name;
    this.style = spec.style;
    this.cruise = spec.cruise;
    this.aggression = spec.aggression;
    this.laneLat = spec.lat;
    this.player = player;
    this.traffic = traffic;
    this.combat = null;
    this.look = {};
    this.attackCooldown = 0;
    this.brainState = 'race';
    this.difficulty = DIFFICULTIES.medium;
    this.sideswipeT = 0;
    this.sideswipeSide = 0;
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
    this.brainState = 'race';
    let targetSpeed = cruise + clamp(gap * AI.rubberBand, -level.catchup, level.catchup);

    const alongside = this.sideswipeT > 0 || (
      !this.player.down && aggression > AI.sideswipeAggression &&
      gap >= -AI.sideswipeLeadMax && gap <= -AI.sideswipeLeadMin &&
      Math.abs(this.lat - this.player.lat) < AI.sideswipeLatGap &&
      this.speed > 28 && Math.random() < dt * 0.25 * aggression * aggression
    );
    if (alongside) {
      if (this.sideswipeT <= 0) {
        this.sideswipeSide = this.lat < this.player.lat ? 1 : -1;
        this.sideswipeT = AI.sideswipeDuration;
      }
      lane = this.player.lat + this.sideswipeSide * 0.9;
      targetSpeed = Math.max(targetSpeed, this.speed + 4);
      this.brainState = 'sideswipe';
    } else if (!this.player.down && aggression > 0.3 && Math.abs(gap) < AI.approachRange) {
      const side = this.lat < this.player.lat ? -1 : 1;
      lane = this.player.lat + side * AI.attackOffset;
      targetSpeed = clamp(this.player.speed + gap * aggression, AI.minimumSpeed, cruise + level.catchup);
      this.brainState = 'approach';
    }
    // Traffic avoidance overrides combat positioning, in road-relative coordinates.
    for (const car of this.traffic.cars) {
      if (!car.active) continue;
      const ahead = car.s - this.s;
      const closingSpeed = Math.max(0, this.speed - car.dir * car.speed);
      if (ahead > -AI.trafficMargin && ahead < AI.trafficMargin + closingSpeed * AI.trafficHorizon && Math.abs(car.lat - lane) < AI.trafficLaneGap) {
        lane = car.lat >= 0 ? -AI.trafficLaneGap : AI.trafficLaneGap;
        this.brainState = 'evade';
        if (ahead > 0 && ahead < AI.trafficMargin && Math.abs(car.lat - this.lat) < AI.trafficLaneGap) targetSpeed = AI.minimumSpeed;
      }
    }
    lane = clamp(lane, -AI.laneLimit, AI.laneLimit);
    this.track.at(this.s + AI.lookAhead, this.look);
    targetSpeed = Math.min(targetSpeed, Math.sqrt(AI.curveAcceleration * level.curve / Math.max(0.001, Math.abs(this.look.k))));
    const lateralKick = this.brainState === 'sideswipe' ? AI.lateralGain * (1 + AI.sideswipeSteerBias) : AI.lateralGain;
    const headingLimit = this.brainState === 'sideswipe' ? AI.headingLimit * 1.3 : AI.headingLimit;
    const desiredYaw = clamp(Math.atan2(this.drift, Math.max(8, this.speed)) - (lane - this.lat) * lateralKick, -headingLimit, headingLimit);
    const steerBoost = this.brainState === 'sideswipe' ? 1.5 : 1;
    c.steer = clamp((desiredYaw - this.relYaw) * AI.steerGain * steerBoost, -1, 1);
    c.brake = this.speed > targetSpeed + 4 ? 0.3 : 0;
    c.throttle = clamp((Math.min(level.acceleration, (targetSpeed - this.speed) * AI.response) + BIKE.drag * this.speed + BIKE.rolling) / BIKE.accel, 0, 1);
    if (this.brainState !== 'evade' && this.attackCooldown <= 0 && !this.down && this.melee.state === 'idle' && this.brainState !== 'sideswipe') {
      const side = this.combat?.autoAttackSide(this) ?? 0;
      if (side && this.stamina >= this.melee.weapon.cost) {
        c.attackL = side === -1; c.attackR = side === 1;
        this.attackCooldown = AI.attackCooldown * level.cooldown / aggression;
        this.brainState = 'swing';
      }
    }
    return c;
  }
}
