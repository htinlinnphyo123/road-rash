import { COMBAT } from '../core/constants.js';
import { events } from '../core/Events.js';

export class Combat {
  constructor(fighters) { this.fighters = fighters; }

  // Also used by the HUD, so readiness hints match the actual weapon geometry.
  inRange(a, t, side, progress = null) {
    if (a === t || a.down || t.down || t.invuln > 0) return false;
    const w = a.melee.weapon;
    const dx = t.body.position.x - a.body.position.x;
    const dz = t.body.position.z - a.body.position.z;
    const lateral = (dx * Math.cos(a.yaw) - dz * Math.sin(a.yaw)) * side;
    const forward = -dx * Math.sin(a.yaw) - dz * Math.cos(a.yaw);
    if (lateral < w.inner || lateral > w.reach + COMBAT.targetHalfWidth) return false;
    const padding = w.halfLen + COMBAT.targetHalfLength;
    if (progress === null) return forward >= w.back - padding && forward <= w.front + padding;
    return Math.abs(forward - (w.back + (w.front - w.back) * progress)) <= padding;
  }

  targetOnSide(attacker, side) {
    for (const target of this.fighters) if (this.inRange(attacker, target, side)) return target;
    return null;
  }

  autoAttackSide(attacker) {
    let side = 0, nearest = Infinity;
    for (const target of this.fighters) {
      const dx = target.body.position.x - attacker.body.position.x;
      const dz = target.body.position.z - attacker.body.position.z;
      const targetSide = dx * Math.cos(attacker.yaw) - dz * Math.sin(attacker.yaw) < 0 ? -1 : 1;
      if (!this.inRange(attacker, target, targetSide)) continue;
      const distance = dx * dx + dz * dz;
      if (distance < nearest) { nearest = distance; side = targetSide; }
    }
    return side;
  }

  fixedUpdate() {
    for (const a of this.fighters) {
      const m = a.melee;
      if (!m.active) continue;

      const w = m.weapon;
      const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw); // forward
      const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);  // right
      for (const t of this.fighters) {
        if (m.hit.has(t) || !this.inRange(a, t, m.side, m.progress)) continue;

        m.hit.add(t);

        // Knock outward from the attacking side, with a little forward shove
        let nx = rx * m.side * 0.9 + fx * 0.25, nz = rz * m.side * 0.9 + fz * 0.25;
        const len = Math.hypot(nx, nz);
        nx /= len; nz /= len;

        const landed = t.receiveHit({
          nx, nz, damage: w.damage, knock: w.knock, stagger: w.stagger, attacker: a,
        });
        if (landed) events.emit('hit', { attacker: a, target: t, weapon: m.weaponName });
      }
    }
  }
}