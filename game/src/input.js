// Input: keyboard + mouse. Tracks held keys and edge-triggered presses.

const Input = {
  keys: {},
  pressed: {},   // edge-triggered: true for one frame after keydown
  mouseX: 0, mouseY: 0,
  mouseDown: false,
  mouseClicked: false, // edge-triggered
  pointerLocked: false,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('click', () => {
      if (SOL.state === 'playing' && !this.pointerLocked) {
        canvas.requestPointerLock && canvas.requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
  },

  // Called at the end of each frame to clear edge triggers.
  endFrame() {
    this.pressed = {};
    this.mouseClicked = false;
  },

  get up() { return !!(this.keys.KeyW || this.keys.ArrowUp); },
  get down() { return !!(this.keys.KeyS || this.keys.ArrowDown); },
  get left() { return !!(this.keys.KeyA || this.keys.ArrowLeft); },
  get right() { return !!(this.keys.KeyD || this.keys.ArrowRight); },
  get run() { return !!this.keys.ShiftLeft || !!this.keys.ShiftRight; },
  get enterCar() { return !!this.pressed.KeyE; },
  get punch() { return !!this.pressed.KeyF; },
  get pause() { return !!this.pressed.KeyP || !!this.pressed.Escape; },
  get mute() { return !!this.pressed.KeyM; },
  get anyKey() { return Object.keys(this.pressed).length > 0 || this.mouseClicked; },
};
