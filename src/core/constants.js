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
  maxBalance: 100, balanceRegen: 20, balancePerHit: 40, // 3 quick hits = knocked off
  respawnDelay: 2.4, invuln: 1.6, slideDecel: 14,
  pickupInvuln: 4.0, pickupFlash: 1.2,
  // Hitbox is expressed in the attacker's local frame (fwd = forward, side = outward from the bike).
  // The box sweeps from `back` to `front` while the swing is active.
  weapons: {
    bat:   { cost: 22, windup: 0.1, active: 0.22, recovery: 0.26, damage: 18, knock: 15, stagger: 0.65,
             inner: 0.25, reach: 2.4, halfLen: 1.0, back: -1.0, front: 1.2, length: 2.2 },
    kick:  { cost: 12, windup: 0.08, active: 0.10, recovery: 0.22, damage: 8, knock: 8, stagger: 0.35,
             inner: 0.25, reach: 1.3, halfLen: 0.6, back: -0.6, front: 0.8, length: 1.0 },
    pipe:  { cost: 30, windup: 0.16, active: 0.24, recovery: 0.36, damage: 28, knock: 22, stagger: 0.95,
             inner: 0.25, reach: 2.6, halfLen: 1.1, back: -1.1, front: 1.3, length: 2.4 },
    chain: { cost: 18, windup: 0.06, active: 0.28, recovery: 0.18, damage: 12, knock: 10, stagger: 0.45,
             inner: 0.25, reach: 3.1, halfLen: 0.8, back: -0.6, front: 1.0, length: 1.6 },
  },
};
export const PICKUPS = {
  spacing: 220, spawnAhead: 14, spawnBehind: 3, perSideChance: 0.42,
  halfRoadInset: 1.6, respawnCooldown: 120, triggerRadius: 1.8, bobAmp: 0.18, bobFreq: 2.4,
  weaponWeights: { bat: 2, pipe: 3, chain: 3 }, // bat default, pipe + chain are pickups (heavier weighted)
};
export const POLICE = {
  takedownThreshold: 2, maxCops: 2, spawnDelay: 4,
  firstAlert: 18, cooldown: 35, chaseDuration: 24, escapeDistance: 100, escapePoints: 400, spawnBehind: 35, spawnGap: 14,
  sirenVolume: 0.12,
  color: 0x2d72ff, shirt: 0x0b1f36, name: 'COP',
  cruise: 60, aggression: 1.3, style: 'ENFORCER',
  dismountPenalty: 3, huntRange: 120, ramChance: 0.6,
};
export const FX = {
  smokeMax: 100, smokeRate: 12, smokeLife: 1.1, smokeGrow: 2.4,
  sparkMax: 90, sparkRate: 35, sparkLife: 0.55, sparkSpeed: 7.5,
  slipThreshold: 0.45, slipSmokeMinSpeed: 9, railScrapeMinSpeed: 7,
};
export const UI = { messageDuration: 1.8, lowHealthPercent: 30, hitMarkerDuration: 0.22,
  wrongWayWarnTime: 0.6, wrongWayPenaltyTime: 1.8, wrongWayMinAngle: 1.1 };

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

export const RACE = {
  startS: 40, length: 4500, countdown: 3, maxTime: 240,
  gridGap: 7, gridLane: 2.3,
  takedownPoints: 250, hitPoints: 40, nearMissPoints: 75,
  finishPoints: 1000, positionPoints: 250,
  nearMissMin: 1.25, nearMissMax: 2.2, nearMissSpeed: 20,
};
export const AI = {
  laneLimit: 5.4, lookAhead: 35, lateralGain: 0.13, steerGain: 8,
  headingLimit: 0.23, response: 1.8, acceleration: 9,
  curveAcceleration: 19, minimumSpeed: 25, rubberBand: 0.07, maxCatchup: 7,
  approachRange: 32, attackOffset: 1.8, attackCooldown: 2.1,
  trafficHorizon: 1.5, trafficMargin: 9, trafficLaneGap: 2.3,
  sideswipeLeadMin: 1.5, sideswipeLeadMax: 4.5, sideswipeLatGap: 3.0,
  sideswipeAggression: 0.7, sideswipeSteerBias: 1.0, sideswipeDuration: 1.2,
};
export const RIVALS = [
  { name: 'RAVEN', style: 'BRAWLER', color: 0xb83bce, shirt: 0x322240, cruise: 53, aggression: 1 },
  { name: 'NOVA', style: 'SPRINTER', color: 0x43c5df, shirt: 0x173746, cruise: 57, aggression: 0.35 },
  { name: 'AXLE', style: 'BALANCED', color: 0xe7b53a, shirt: 0x44391e, cruise: 54, aggression: 0.7 },
  { name: 'GHOST', style: 'DEFENSIVE', color: 0xc9d5d7, shirt: 0x263d33, cruise: 52, aggression: 0.2 },
  { name: 'VIPER', style: 'BRAWLER', color: 0x77c744, shirt: 0x183c25, cruise: 56, aggression: 0.9 },
  { name: 'BLAZE', style: 'SPRINTER', color: 0xf07532, shirt: 0x613226, cruise: 59, aggression: 0.5 },
  { name: 'ONYX', style: 'BALANCED', color: 0x424958, shirt: 0x202635, cruise: 55, aggression: 0.8 },
  { name: 'STORM', style: 'BRAWLER', color: 0x447bec, shirt: 0x202e59, cruise: 56, aggression: 1.1 },
  { name: 'EMBER', style: 'SPRINTER', color: 0xe64567, shirt: 0x562737, cruise: 58, aggression: 0.6 },
];
export const AUDIO = {
  engineVolume: 0.16, windVolume: 0.1, effectVolume: 0.28,
  engineMinRate: 0.65, engineRateRange: 2.2, audibleRange: 35,
};

export const DIFFICULTIES = {
  easy: { label: 'Easy', description: 'Slower rivals · fewer attacks', speed: -5, acceleration: 8, aggression: 0.65, cooldown: 1.4, catchup: 4, curve: 0.85 },
  medium: { label: 'Medium', description: 'Fast pack · regular attacks', speed: 3, acceleration: 15, aggression: 1, cooldown: 1, catchup: 7, curve: 1 },
  hard: { label: 'Hard', description: 'Relentless pace · aggressive combat', speed: 9, acceleration: 23, aggression: 1.5, cooldown: 0.6, catchup: 10, curve: 1.2 },
};
export const HIT_FX = { duration: 0.38, recoilDuration: 0.5, recoilAngle: 0.38, flashDuration: 0.18, playerShake: 0.9, attackShake: 0.65 };
