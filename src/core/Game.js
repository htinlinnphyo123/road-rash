import { FIXED_DT } from './constants.js';

export class Game {
  constructor({ fixedUpdate, update }) {
    this.fixedUpdate = fixedUpdate;
    this.update = update;
    this.acc = 0;
    this.last = 0;
  }

  start() {
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  frame = (now) => {
    requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.last) / 1000, 0.1); // clamp to avoid spiral of death
    this.last = now;
    this.acc += dt;

    while (this.acc >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.acc -= FIXED_DT;
    }
    this.update(this.acc / FIXED_DT, dt); // alpha for render interpolation
  };
}