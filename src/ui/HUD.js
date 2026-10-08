import { BIKE, COMBAT, UI, RACE, DIFFICULTIES, POLICE, CHALLENGES } from '../core/constants.js';
import { events } from '../core/Events.js';

export class HUD {
  constructor(bike, input, combat, race, police = null, pickups = null) {
    this.bike = bike;
    this.race = race;
    this.combat = combat;
    this.police = police;
    this.pickups = pickups;
    this.hitTime = 0;
    this.input = input;
    this.paused = true;
    this.started = false;
    this.takedowns = 0;
    this.messageTime = 0;
    this.nodes = {};
    for (const id of ['speed', 'hpbar', 'stbar', 'health-value', 'stamina-value', 'distance', 'takedowns', 'weapon', 'speedbar', 'warning', 'msg', 'menu', 'ride', 'menu-copy', 'cruise-status', 'attack-action', 'attack-target', 'combat-tip', 'hit-marker', 'race-position', 'race-time', 'race-remaining', 'race-progress', 'race-score', 'results', 'result-title', 'result-stats', 'result-order']) this.nodes[id] = document.getElementById(id);
    this.portrait = matchMedia('(any-pointer: coarse) and (orientation: portrait), (max-width: 600px) and (orientation: portrait)');
    this.portrait.addEventListener('change', () => {
      if (this.portrait.matches) this.setPaused(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.setPaused(true);
    });
    if (race) {
      this.levelPickers = [document.getElementById('difficulty'), document.getElementById('retry-difficulty')];
      for (const picker of this.levelPickers) {
        for (const [key, level] of Object.entries(DIFFICULTIES)) {
          const option = document.createElement('option'); option.value = key; option.textContent = level.label; picker.appendChild(option);
        }
        picker.value = race.difficulty;
        picker.addEventListener('change', () => {
          race.setDifficulty(picker.value);
          this.syncDifficulty();
        });
      }
      this.challengePickers = [document.getElementById('challenge'), document.getElementById('retry-challenge')];
      for (const picker of this.challengePickers) {
        for (const [key, goal] of Object.entries(CHALLENGES)) {
          const option = document.createElement('option'); option.value = key;
          option.textContent = `${goal.goal} · +${goal.bonus}`; picker.appendChild(option);
        }
        picker.addEventListener('change', () => { race.setChallenge(picker.value); this.syncDifficulty(); });
      }
      this.syncDifficulty();
      events.on('raceState', () => this.syncRace());
      events.on('countdown', ({ count }) => this.flash(count ? String(count) : 'GO!'));
      events.on('raceReset', () => { this.takedowns = 0; this.hitTime = this.messageTime = 0; this.nodes.msg.textContent = ''; });
      events.on('nearMiss', ({ points }) => this.flash(`CLOSE CALL +${points}`));
      events.on('pickup', ({ weapon, refill }) => this.flash(refill ? `${weapon.toUpperCase()} +STAMINA REFILL` : `${weapon.toUpperCase()} EQUIPPED`));
      events.on('policeAlert', ({ active }) => { if (active) this.flash('POLICE INCOMING · KEEP MOVING'); });
      events.on('policeEscape', ({ points }) => this.flash(points ? `PURSUIT SURVIVED +${points}` : 'PURSUIT ENDED'));
      events.on('raceFinished', (result) => this.showResults(result));
      document.getElementById('retry').addEventListener('click', () => this.setPaused(false));
      this.syncRace();
    } else this.setPaused(true);
    document.getElementById('pause').addEventListener('click', () => this.setPaused(true));
    this.nodes.ride.addEventListener('click', () => this.setPaused(false));
    addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && !event.repeat && this.started) this.setPaused(!this.paused);
    });
    addEventListener('blur', () => { if (this.started) this.setPaused(true); });
    events.on('dismount', ({ rider, attacker }) => {
      if (rider === bike) this.flash('WIPEOUT');
      else if (attacker === bike) { this.takedowns++; this.flash(this.police?.cops.includes(rider) ? 'PATROL TAKEN DOWN' : 'TAKEDOWN'); }
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
  syncDifficulty() {
    for (const picker of this.levelPickers) {
      picker.value = this.race.difficulty;
      picker.disabled = this.race.state !== 'menu' && this.race.state !== 'results';
    }
    for (const picker of this.challengePickers || []) {
      picker.value = this.race.challenge; picker.disabled = this.race.state !== 'menu' && this.race.state !== 'results';
    }
    const best = this.race.records.data[this.race.difficulty];
    document.getElementById('personal-best').textContent = best ? `PERSONAL BEST · ${this.formatTime(best.time)} · ${best.score} PTS` : 'Finish a race to set your first personal best.';
    document.getElementById('difficulty-hint').textContent = DIFFICULTIES[this.race.difficulty].description;
  }
  syncRace() {
    this.syncDifficulty();
    const state = this.race.state;
    this.paused = state === 'menu' || state === 'paused' || state === 'results';
    this.started = state !== 'menu';
    this.input.setEnabled(state === 'racing');
    document.body.classList.toggle('is-paused', this.paused);
    this.nodes.menu.hidden = state !== 'menu' && state !== 'paused';
    this.nodes.results.hidden = state !== 'results';
    if (state === 'paused') {
      this.nodes.ride.innerHTML = 'RESUME RACE <span>↗</span>';
      this.nodes['menu-copy'].textContent = 'Race paused. Your timer and rivals are paused too.';
    }
  }
  showResults(result) {
    this.nodes.msg.textContent = '';
    this.nodes['result-title'].textContent = result.finished ? result.rank === 1 ? 'VICTORY!' : `FINISHED #${result.rank}` : 'TIME UP';
    this.nodes['result-stats'].textContent = `${this.formatTime(result.time)} · ${result.score} POINTS · ${result.takedowns} TAKEDOWNS · ${result.nearMisses} CLOSE CALLS`;
    document.getElementById('result-challenge').textContent = result.challengeWon ? `CHALLENGE COMPLETE · +${result.bonus} POINTS` : `${CHALLENGES[result.challenge].goal} · ${result.finished ? 'Try this challenge again' : 'Finish the race to claim the bonus'}`;
    document.getElementById('result-records').textContent = `${result.records.newTime ? 'NEW BEST TIME! ' : ''}${result.records.newScore ? 'NEW HIGH SCORE! ' : ''}${!result.finished ? 'Finish a race to set a personal best.' : this.race.records.saved ? 'Records saved on this device.' : 'Records available for this session only.'}`;
    this.nodes['result-order'].replaceChildren();
    for (let i = 0; i < this.race.standings.length; i++) {
      const entry = this.race.standings[i], row = document.createElement('li');
      row.textContent = `${i + 1}. ${entry.rider.name} — ${entry.finishTime === null ? 'Not finished' : this.formatTime(entry.finishTime)}`;
      if (entry.rider === this.bike) row.className = 'you';
      this.nodes['result-order'].appendChild(row);
    }
  }
  formatTime(seconds) { return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`; }
  setPaused(paused) {
    if (!paused && this.portrait.matches) return;
    if (this.race) {
      if (paused) this.race.pause();
      else if (this.race.state === 'paused') this.race.resume();
      else this.race.start();
      return;
    }
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
    if (this.race) {
      n['race-position'].textContent = `${this.race.rank} / ${this.race.riders.length}`;
      n['race-time'].textContent = this.formatTime(this.race.elapsed);
      n['race-remaining'].textContent = `${(Math.max(0, this.race.finishS - b.s) / 1000).toFixed(2)} KM LEFT`;
      n['race-progress'].style.width = `${Math.max(0, Math.min(100, (b.s - RACE.startS) / RACE.length * 100))}%`;
      n['race-score'].textContent = `${this.race.score} PTS`;
      const goal = CHALLENGES[this.race.challenge];
      document.getElementById('race-challenge').textContent = this.race.challenge === 'podium' ? `GOAL · TOP 3 FINISH · +${goal.bonus}` : `${goal.goal.toUpperCase()} · ${Math.min(goal.target, this.race[goal.stat])}/${goal.target} · ${this.race.challengeComplete() ? 'FINISH TO CLAIM' : '+' + goal.bonus}`;
      let threat = null;
      for (const fighter of this.combat.fighters) {
        if (fighter.melee.state === 'windup' && this.combat.inRange(fighter, b, fighter.melee.side)) { threat = fighter; break; }
      }
      const warning = document.getElementById('attack-warning');
      warning.textContent = threat ? (threat.lat < b.lat ? '← ATTACK FROM LEFT · MOVE RIGHT' : 'ATTACK FROM RIGHT · MOVE LEFT →') : '';
    }
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
    document.body.classList.toggle('wrong-way', !!(b.wrongWay && b.wrongWayT <= UI.wrongWayPenaltyTime));
    document.body.classList.toggle('wrong-way-penalty', !!(b.wrongWay && b.wrongWayT > UI.wrongWayPenaltyTime));
    const copsActive = !!(this.police && this.police.active && this.police.count > 0);
    const copsIncoming = !!(this.police && this.police.active && this.police.spawnT > 0);
    document.body.classList.toggle('police-active', copsActive);
    if (b.wrongWay && b.wrongWayT > UI.wrongWayPenaltyTime) n.warning.textContent = '⚠ WRONG WAY · SLOWING DOWN';
    else if (b.wrongWay) n.warning.textContent = '⚠ TURN AROUND — WRONG WAY';
    else if (copsIncoming) n.warning.textContent = `🚨 POLICE INCOMING IN ${Math.ceil(this.police.spawnT)}s`;
    else if (copsActive) n.warning.textContent = `🚨 PURSUIT · ${this.police.count} UNIT${this.police.count > 1 ? 'S' : ''} · OUTRUN OR SURVIVE ${Math.ceil(POLICE.chaseDuration - this.police.chaseTime)}s`;
    else n.warning.textContent = b.down ? 'RECOVERING…' : hp < UI.lowHealthPercent ? 'LOW HEALTH · RIDE CAREFULLY' : b.offRoad ? 'OFF ROAD · RETURN TO ASPHALT' : '';
    document.body.classList.toggle('low-health', hp < UI.lowHealthPercent);
  }
}
