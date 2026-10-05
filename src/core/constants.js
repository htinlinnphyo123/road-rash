export const FIXED_DT = 1 / 60;

export const ROAD = { width: 14, period: 16 };

export const BIKE = {
  mass: 200,
  maxSpeed: 70,
  accel: 28,
  brake: 55,
  drag: 0.4,
  rolling: 0.6,
  offRoadDrag: 1.2,   // extra drag on grass
  turnRate: 1.2,      // rad/s of heading change relative to the track
  yawRecover: 2.5,    // self-centering toward track tangent
  maxYaw: 0.25,       // max heading offset from the track (rad)
  maxLean: 0.7,
  curveDrift: 0.25,   // centrifugal push in bends
  grip: 2.0,          // how fast that push is killed
  maxHealth: 100,
  crashSpeed: 28,   // impact speed (m/s) that causes a wipeout
  stunTime: 1.4,
};

// Collision groups (bit flags)
export const GROUP = { WORLD: 1, BIKE: 2, TRAFFIC: 4 };

// Guardrail: inner face sits `shoulder` meters beyond the road edge
export const WALL = { shoulder: 2.0, scrape: 14 }; // scrape = m/s² decel while grinding the rail

export const COMBAT = {
  inputBuffer: 0.2, targetHalfWidth: 0.3, targetHalfLength: 0.9,
  maxStamina: 100, staminaRegen: 22, regenDelay: 0.7,
  maxBalance: 100, balanceRegen: 20, balancePerHit: 34, // 3 quick hits = knocked off
  respawnDelay: 2.4, invuln: 1.6, slideDecel: 14,
  // Hitbox is expressed in the attacker's local frame (fwd = forward, side = outward from the bike).
  // The box sweeps from `back` to `front` while the swing is active.
  weapons: {
    bat:  { cost: 22, windup: 0.1, active: 0.22, recovery: 0.26, damage: 14, knock: 12, stagger: 0.5,
            inner: 0.25, reach: 2.4, halfLen: 1.0, back: -1.0, front: 1.2, length: 2.2 },
    kick: { cost: 12, windup: 0.08, active: 0.10, recovery: 0.22, damage: 8, knock: 8, stagger: 0.35,
            inner: 0.25, reach: 1.3, halfLen: 0.6, back: -0.6, front: 0.8, length: 1.0 },
  },
};
export const UI = { messageDuration: 1.8, lowHealthPercent: 30, hitMarkerDuration: 0.22 };

// Auto-throttle uses elapsed simulation time, never wall-clock time.
export const AUTO_DRIVE = {
  startSpeed: 18, maxSpeed: 58, warmup: 8, speedRise: 0.4,
  acceleration: 6, response: 1.5,
};

export const RIDER_CAMERA = {
  height: 2.0, distance: 4.2, lookAhead: 4, targetHeight: 0.6,
  baseFov: 64, speedFov: 8, leanAmount: 0.06,
  shakeScale: 0.035, shakeDecay: 8,
};
