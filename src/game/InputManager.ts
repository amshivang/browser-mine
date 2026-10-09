export class InputManager {
  bindings: Record<string, string> = { forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sprint: 'ShiftLeft', crouch: 'ControlLeft', inventory: 'KeyE', eat: 'KeyF', drop: 'KeyQ' };
  readonly keys = new Set<string>();
  mouseDown = { left: false, right: false };
  justPressed = new Set<string>();
  pointerLocked = false;
  onMouseMove?: (dx: number, dy: number) => void;
  onClick?: (button: number) => void;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener('keydown', (event) => {
      if (!this.keys.has(event.code)) this.justPressed.add(event.code);
      this.keys.add(event.code);
      if (event.target instanceof HTMLInputElement) return;
      if (['Space', 'Tab', 'F3', 'F5'].includes(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    document.addEventListener('mousemove', (event) => { if (this.pointerLocked) this.onMouseMove?.(event.movementX, event.movementY); });
    document.addEventListener('mousedown', (event) => {
      if (event.button === 0) this.mouseDown.left = true;
      if (event.button === 2) this.mouseDown.right = true;
      this.onClick?.(event.button);
    });
    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown.left = false;
      if (event.button === 2) this.mouseDown.right = false;
    });
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === this.element; });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown.left = this.mouseDown.right = false; });
  }

  requestLock(): void { if (document.pointerLockElement !== this.element) { const result = this.element.requestPointerLock(); if (result) void result.catch(() => undefined); } }
  down(action: string): boolean { return this.keys.has(this.bindings[action]); }
  consume(code: string): boolean { const result = this.justPressed.has(code); this.justPressed.delete(code); return result; }
  endFrame(): void { this.justPressed.clear(); }
}
