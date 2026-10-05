import { Rider } from './Rider.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class DummyRider extends Rider {
  constructor(scene, physics, track, { s, lat, cruise, color, shirt }) {
    super(scene, physics, track, { color, shirt });
    this.laneLat = lat;
    this.cruise = cruise;
    this.placeAt(s, lat, cruise);
  }

  think() {
    const c = this._inp;
    c.throttle = this.speed < this.cruise ? 1 : 0;
    c.brake = this.speed > this.cruise + 5 ? 1 : 0;
    // +lat is right, +steer turns left: to move right we need a negative relative heading
    const targetRel = -clamp((this.laneLat - this.lat) * 0.1, -0.2, 0.2);
    c.steer = clamp((targetRel - this.relYaw) * 6, -1, 1);
    c.attackL = c.attackR = false;
    return c;
  }
}