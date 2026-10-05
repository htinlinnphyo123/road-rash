import { BIKE, COMBAT, UI } from '../core/constants.js';
import { events } from '../core/Events.js';

export class HUD {
  constructor(bike, input, combat) {
    this.bike = bike;
    this.combat = combat;
    this.hitTime = 0;
    this.input = input;
    this.paused = true;
    this.started = false;
    this.takedowns = 0;
    this.messageTime = 0;
    this.nodes = {};
    for (const id of ['speed', 'hpbar', 'stbar', 'health-value', 'stamina-value', 'distance', 'takedowns', 'weapon', 'speedbar', 'warning', 'msg', 'menu', 'ride', 'menu-copy', 'cruise-status', 'attack-action', 'attack-target', 'combat-tip', 'hit-marker']) this.nodes[id] = document.getElementById(id);
    this.portrait = matchMedia('(any-pointer: coarse) and (orientation: portrait), (max-width: 600px) and (orientation: portrait)');
    this.portrait.addEventListener('change', () => {
      if (this.portrait.matches) this.setPaused(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.setPaused(true);
    });
    this.setPaused(true);
    document.getElementById('pause').addEventListener('click', () => this.setPaused(true));
    this.nodes.ride.addEventListener('click', () => this.setPaused(false));
    addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && !event.repeat && this.started) this.setPaused(!this.paused);
    });
    addEventListener('blur', () => { if (this.started) this.setPaused(true); });
    events.on('dismount', ({ rider, attacker }) => {
      if (rider === bike) this.flash('WIPEOUT');
      else if (attacker === bike) { this.takedowns++; this.flash('TAKEDOWN'); }
    });
    events.on('respawn', ({ rider }) => { if (rider === bike) this.flash('BACK IN THE SADDLE'); });
    events.on('hit', ({ attacker, target, weapon }) => {
      if (attacker === bike) this.hitTime = UI.hitMarkerDuration;
      if (!bike.down && !target.down) {
        if (attacker === bike) this.flash(`HIT · ${COMBAT.weapons[weapon].damage} DAMAGE`);
        else if (target === bike) this.flash('UNDER ATTACK');
      }
    });
  }
  setPaused(paused) {
    if (!paused && this.portrait.matches) return;
    this.paused = paused;
    this.input.setEnabled(!paused);
    document.body.classList.toggle('is-paused', paused);
    if (!paused) this.started = true;
    this.nodes.menu.hidden = !paused;
    if (this.started) {
      this.nodes.ride.innerHTML = 'BACK TO THE ROAD <span>↗</span>';
      this.nodes['menu-copy'].textContent = 'Ride paused. Take a breath. The highway can wait.';
    }
  }
  flash(message) { this.nodes.msg.textContent = message; this.messageTime = UI.messageDuration; }
  update(dt) {
    const b = this.bike, n = this.nodes;
    this.hitTime = Math.max(0, this.hitTime - dt);
    n['hit-marker'].classList.toggle('landed', this.hitTime > 0);
    const ready = !b.down && b.melee.state === 'idle' && b.stamina >= b.melee.weapon.cost;
    const side = ready ? this.combat.autoAttackSide(b) : 0;
    n['attack-action'].classList.toggle('ready', side !== 0);
    n['attack-target'].textContent = side === -1 ? '← ENEMY' : side === 1 ? 'ENEMY →' : 'AUTO AIM';
    n['combat-tip'].textContent = b.down ? 'RECOVERING' : b.stamina < b.melee.weapon.cost ? 'LOW STAMINA' : b.melee.state !== 'idle' ? 'SWINGING' : side ? 'RIVAL IN REACH · HIT NOW' : 'PULL ALONGSIDE TO HIT';
    this.messageTime = Math.max(0, this.messageTime - dt);
    if (!this.messageTime && !b.down) n.msg.textContent = '';
    const hp = Math.round(100 * b.health / BIKE.maxHealth), stamina = Math.round(100 * b.stamina / COMBAT.maxStamina);
    n.speed.textContent = Math.round(b.speed * 3.6);
    n.hpbar.style.width = `${hp}%`; n.stbar.style.width = `${stamina}%`;
    n['health-value'].textContent = `${hp}%`; n['stamina-value'].textContent = `${stamina}%`;
    n.speedbar.style.width = `${100 * b.speed / BIKE.maxSpeed}%`;
    n.distance.innerHTML = `${(Math.max(0, b.s) / 1000).toFixed(2)} <small>KM</small>`;
    n.takedowns.textContent = String(this.takedowns).padStart(2, '0');
    n['cruise-status'].textContent = this.input.brake ? 'BRAKING' : this.input.throttle ? 'FULL THROTTLE' : `CRUISE TARGET ${Math.round(b.cruiseSpeed * 3.6)} KM/H`;
    n.weapon.textContent = b.melee.weaponName.toUpperCase();
    n.warning.textContent = b.down ? 'RECOVERING…' : hp < UI.lowHealthPercent ? 'LOW HEALTH · RIDE CAREFULLY' : b.offRoad ? 'OFF ROAD · RETURN TO ASPHALT' : '';
    document.body.classList.toggle('low-health', hp < UI.lowHealthPercent);
  }
}
