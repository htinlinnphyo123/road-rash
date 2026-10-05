const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space',
]);
const ACTION_KEYS = new Set(['Space']);

export class Input {
  constructor(canvas = null) {
    this.keys = new Set();
    this.pressed = new Set();
    this.pointers = new Map();
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat && ACTION_KEYS.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    // Bind only the game canvas: menu and touch-control clicks must not attack.
    canvas?.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.pointerType !== 'mouse' || e.button !== 0) return;
      e.preventDefault();
      this.pressed.add('Space');
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.clear());
    for (const button of document.querySelectorAll('[data-drive-key]')) {
      button.addEventListener('contextmenu', (e) => e.preventDefault());
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!this.enabled) return;
        const code = button.dataset.driveKey;
        button.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { code, button });
        if (ACTION_KEYS.has(code)) this.pressed.add(code);
        button.classList.add('held');
      });
      const release = (e) => {
        const pointer = this.pointers.get(e.pointerId);
        if (!pointer) return;
        this.pointers.delete(e.pointerId);
        let held = false;
        for (const other of this.pointers.values()) if (other.button === button) held = true;
        button.classList.toggle('held', held);
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    }
  }

  clear() {
    this.keys.clear(); this.pressed.clear();
    for (const pointer of this.pointers.values()) pointer.button.classList.remove('held');
    this.pointers.clear();
  }
  setEnabled(enabled) { this.enabled = enabled; this.clear(); }
  down(...codes) {
    if (codes.some((code) => this.keys.has(code))) return true;
    for (const pointer of this.pointers.values()) if (codes.includes(pointer.code)) return true;
    return false;
  }
  consume(code) { return this.pressed.delete(code); }
  get throttle() { return this.down('KeyW', 'ArrowUp') ? 1 : 0; }
  get brake() { return this.down('KeyS', 'ArrowDown') ? 1 : 0; }
  get steer() {
    return (this.down('KeyA', 'ArrowLeft') ? 1 : 0) - (this.down('KeyD', 'ArrowRight') ? 1 : 0);
  }
}
