export const STEP = 2; // meters between centerline samples

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Heading h: forward = (-sin h, 0, -cos h), right = (cos h, 0, -sin h). +h = turning left.
export class Track {
  constructor(seed = 1337) {
    this.rand = mulberry32(seed);
    this.x = [0]; this.z = [0]; this.h = [0]; this.k = [0];
    this.kappa = 0;
    this.target = 0;
    this.segLeft = 120; // straight start
  }

  ensure(s) {
    const need = Math.ceil(s / STEP) + 2;
    while (this.x.length < need) this.step();
  }

  step() {
    const i = this.x.length - 1;
    if (this.segLeft <= 0) {
      let t = 0;
      if (this.rand() > 0.3) t = (this.rand() < 0.5 ? -1 : 1) * (0.004 + this.rand() * 0.009);
      // keep the road roughly heading "north" so it doesn't spiral
      if (Math.abs(this.h[i]) > 1.2 && t !== 0) t = -Math.sign(this.h[i]) * Math.abs(t);
      this.target = t;
      this.segLeft = 80 + this.rand() * 140;
    }
    const maxDk = 0.0004 * STEP; // curvature ramp rate keeps bends smooth
    this.kappa += clamp(this.target - this.kappa, -maxDk, maxDk);

    const h0 = this.h[i], h1 = h0 + this.kappa * STEP, hm = (h0 + h1) / 2;
    this.x.push(this.x[i] - Math.sin(hm) * STEP);
    this.z.push(this.z[i] - Math.cos(hm) * STEP);
    this.h.push(h1);
    this.k.push(this.kappa);
    this.segLeft -= STEP;
  }

  // Centerline at distance s -> out {x, z, h, k}
  at(s, out = {}) {
    s = Math.max(0, s);
    this.ensure(s + STEP * 2);
    const f = s / STEP, i = Math.floor(f), t = f - i;
    out.x = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
    out.z = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
    out.h = this.h[i] + (this.h[i + 1] - this.h[i]) * t;
    out.k = this.k[i + 1];
    return out;
  }

  // Track space -> world. lateral: +right
  pointAt(s, lateral, out) {
    const p = this.at(s, this._p || (this._p = {}));
    return out.set(p.x + Math.cos(p.h) * lateral, 0, p.z - Math.sin(p.h) * lateral);
  }

  // World -> track space. hintS makes it an O(1) local search.
  // out gets {s, lat, h, k, x, z}
  project(px, pz, hintS, out) {
    this.ensure(hintS + 60);
    const c = Math.floor(Math.max(0, hintS) / STEP);
    let best = Math.max(0, c - 8), bd = Infinity;
    for (let i = best; i <= c + 8; i++) {
      const dx = px - this.x[i], dz = pz - this.z[i];
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    const h = this.h[best];
    const along = (px - this.x[best]) * -Math.sin(h) + (pz - this.z[best]) * -Math.cos(h);
    const s = Math.max(0, best * STEP + clamp(along, -STEP, STEP));
    this.at(s, out);
    out.s = s;
    out.lat = (px - out.x) * Math.cos(out.h) + (pz - out.z) * -Math.sin(out.h);
    return out;
  }
}