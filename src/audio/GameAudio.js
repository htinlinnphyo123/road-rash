import { Howler } from 'howler';
import { AUDIO, BIKE } from '../core/constants.js';
import { events } from '../core/Events.js';

export class GameAudio {
  constructor(assets, bike, race) {
    this.bike = bike; this.race = race; this.sounds = assets.sounds;
    this.unlocked = false; this.muted = false; this.running = false;
    this.engineId = null; this.windId = null;
    this.lastRate = -1;
    const unlock = () => {
      if (Howler.ctx?.state === 'suspended') Howler.ctx.resume().catch(() => {});
      this.unlocked = true;
    };
    document.getElementById('ride').addEventListener('click', unlock, { capture: true });
    document.getElementById('retry').addEventListener('click', unlock, { capture: true });
    const mute = document.getElementById('sound');
    mute.addEventListener('click', () => {
      unlock(); this.muted = !this.muted; Howler.mute(this.muted);
      mute.textContent = this.muted ? 'SOUND OFF' : 'SOUND ON';
      mute.setAttribute('aria-pressed', String(this.muted));
    });
    events.on('swing', ({ rider }) => { if (this.audible(rider)) this.play('swing'); });
    events.on('hit', ({ attacker, target }) => { if (this.audible(attacker) || target === bike) this.play('hit'); });
    events.on('impact', ({ rider, crash }) => { if (rider === bike) this.play(crash ? 'crash' : 'hit'); });
    events.on('dismount', ({ rider }) => { if (this.audible(rider)) this.play('crash'); });
    events.on('countdown', () => this.play('countdown'));
    events.on('raceFinished', () => this.play('finish'));
    events.on('nearMiss', () => this.play('countdown'));
    events.on('raceState', ({ state }) => {
      if (state === 'paused' || state === 'menu' || state === 'results') {
        for (const sound of this.sounds.values()) sound.stop();
        this.running = false; this.engineId = this.windId = null;
      }
    });
  }
  audible(rider) { return Math.abs(rider.s - this.bike.s) < AUDIO.audibleRange; }
  play(name) {
    if (!this.unlocked || this.muted) return;
    const sound = this.sounds.get(name);
    sound.volume(AUDIO.effectVolume); sound.play();
  }
  update() {
    if (!this.unlocked || (this.race.state !== 'racing' && this.race.state !== 'countdown')) return;
    const engine = this.sounds.get('engine'), wind = this.sounds.get('wind');
    if (!this.running) {
      this.engineId = engine.play(); this.windId = wind.play(); this.running = true; this.lastRate = -1;
    }
    const speed = this.bike.speed / BIKE.maxSpeed;
    const rate = AUDIO.engineMinRate + speed * AUDIO.engineRateRange;
    if (Math.abs(rate - this.lastRate) > 0.015) {
      engine.rate(rate, this.engineId);
      engine.volume(AUDIO.engineVolume * (this.bike.down ? 0.2 : 0.5 + speed * 0.5), this.engineId);
      wind.volume(AUDIO.windVolume * speed, this.windId);
      this.lastRate = rate;
    }
  }
}
