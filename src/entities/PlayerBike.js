import { Rider } from './Rider.js';
import { BIKE, AUTO_DRIVE } from '../core/constants.js';

export class PlayerBike extends Rider {
  constructor(scene, physics, track, input) {
    super(scene, physics, track, { color: 0xe33229, shirt: 0x1d2228 });
    this.isPlayer = true;
    this.input = input;
    this.combat = null;
    this.rideTime = 0;
    this.cruiseSpeed = AUTO_DRIVE.startSpeed;
  }

  think(dt) {
    const i = this.input, c = this._inp;
    if (!this.down) this.rideTime += dt;
    this.cruiseSpeed = Math.min(AUTO_DRIVE.maxSpeed,
      AUTO_DRIVE.startSpeed + Math.max(0, this.rideTime - AUTO_DRIVE.warmup) * AUTO_DRIVE.speedRise);
    c.brake = i.brake;
    // Feed forward road drag while preserving the shared Rider physics and off-road penalty.
    const acceleration = Math.min(AUTO_DRIVE.acceleration,
      (this.cruiseSpeed - this.speed) * AUTO_DRIVE.response);
    const resistance = this.speed > 0 ? BIKE.drag * this.speed + BIKE.rolling : 0;
    c.throttle = c.brake || this.down ? 0 : Math.max(0, Math.min(1,
      (acceleration + resistance) / BIKE.accel));
    if (i.throttle && !c.brake && !this.down) c.throttle = 1;
    c.steer = i.steer;
    // Select once per request in the fixed step, before the swing begins.
    const side = i.consume('Space') ? (this.combat?.autoAttackSide(this) ?? 0) : 0;
    c.attackL = side === -1;
    c.attackR = side === 1;
    return c;
  }
}