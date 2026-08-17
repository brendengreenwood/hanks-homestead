import * as THREE from 'three';
import type { EmoteKind } from '../ecs/emote/emoteTypes';

type PointerState = {
  active: boolean;
  id: number | null;
  centerX: number;
  centerY: number;
  radius: number;
};

export type InputDevice = 'keyboard' | 'gamepad';
export type MenuNav = 'up' | 'down' | 'left' | 'right';

const STICK_DEADZONE = 0.15;
const LOOK_DEADZONE = 0.2;
const RUN_THRESHOLD = 0.9;
const ORIGIN = new THREE.Vector2(0, 0);

// Standard gamepad mapping button indices.
const BTN_A = 0;
const BTN_B = 1;
const BTN_X = 2;
const BTN_Y = 3;
const BTN_START = 9;
const BTN_DPAD_UP = 12;
const BTN_DPAD_DOWN = 13;
const BTN_DPAD_LEFT = 14;
const BTN_DPAD_RIGHT = 15;
const NAV_STICK_THRESHOLD = 0.6;

// WASD-to-emote mapping for keyboard selection while the wheel is open, matching
// the wheel's screen directions: W=up=wave, D=right=cheer, S=down=bow, A=left=spin.
const EMOTE_KEYS: Record<string, EmoteKind> = {
  KeyW: 'wave',
  KeyD: 'cheer',
  KeyS: 'bow',
  KeyA: 'spin',
};

/**
 * Typing guard: true while a text field (e.g. the chat input) owns the
 * keyboard, so WASD typed into it doesn't steer the player. Range/checkbox
 * inputs (pause-menu sliders) are excluded — they don't capture typing.
 */
function isTextEntryFocused(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return true;
  return (
    el instanceof HTMLInputElement &&
    el.type !== 'range' &&
    el.type !== 'checkbox' &&
    el.type !== 'radio' &&
    el.type !== 'button'
  );
}

export class InputController {
  private readonly keys = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private readonly consumedThisFrame = new Set<string>();
  private readonly pointer = new THREE.Vector2();
  private readonly keyVector = new THREE.Vector2();
  private readonly pointerState: PointerState = {
    active: false,
    id: null,
    centerX: 0,
    centerY: 0,
    radius: 1,
  };

  private runDown = false;
  private interactQueued = false;
  private jumpQueued = false;
  private menuQueued = false;
  private cancelQueued = false;
  private questLogQueued = false;
  private inventoryQueued = false;
  private abilitiesQueued = false;
  private navQueued: MenuNav | null = null;
  private prevNavX = 0;
  private prevNavY = 0;

  private readonly gamepadVector = new THREE.Vector2();
  private readonly gamepadLook = new THREE.Vector2();
  private gamepadRun = false;
  private prevButtons: boolean[] = [];
  private device: InputDevice = 'keyboard';

  private rmbHeld = false;
  private mouseLookX = 0;
  private mouseLookY = 0;
  private wheelDelta = 0;

  private emoteKeyDown = false;
  private emoteButtonDown = false;
  private mouseX = 0;
  private mouseY = 0;

  // Emote-wheel selection state. The mouse path is driven by movement since the
  // wheel opened (delta from a snapshotted origin) so nothing is pre-selected on
  // open. `emoteKeySelection` is a latched WASD pick that toggles per key.
  private emoteOriginX = 0;
  private emoteOriginY = 0;
  private emoteOriginPending = false;
  private pointerMoveSeen = false;
  private emoteKeySelection: EmoteKind | null = null;

  /** Camera yaw applied to movement input so controls stay camera-relative. */
  cameraYaw = 0;

  /** Fired when the active input device changes (keyboard <-> gamepad). */
  onDeviceChange: ((device: InputDevice) => void) | null = null;
  /** Fired once when a gamepad first connects. */
  onGamepadConnected: ((id: string) => void) | null = null;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (isTextEntryFocused()) return;
    this.keys.add(event.code);
    if (!event.repeat) this.pressedThisFrame.add(event.code);
    this.setDevice('keyboard');
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.runDown = true;
    }
    if (event.code === 'KeyE' && !event.repeat) {
      this.interactQueued = true;
    }
    if (event.code === 'Space' && !event.repeat) {
      this.jumpQueued = true;
    }
    if (event.code === 'Escape' && !event.repeat) {
      this.menuQueued = true;
    }
    if (event.code === 'KeyC') {
      this.emoteKeyDown = true;
    }
    // While the emote wheel is held open, WASD selects the emote at that screen
    // position as a latched toggle (same key again clears it). Gated on
    // !event.repeat so a held key never oscillates the latch, and only active
    // while the wheel is open so normal WASD movement is untouched elsewhere.
    if (this.emoteKeyDown && !event.repeat && event.code in EMOTE_KEYS) {
      const kind = EMOTE_KEYS[event.code];
      this.emoteKeySelection = this.emoteKeySelection === kind ? null : kind;
    }
    if (event.code === 'KeyJ' && !event.repeat) {
      this.questLogQueued = true;
    }
    if (event.code === 'KeyI' && !event.repeat) {
      this.inventoryQueued = true;
    }
    if (event.code === 'KeyK' && !event.repeat) {
      this.abilitiesQueued = true;
    }
  };

  // Key-up is NOT typing-guarded on purpose: it only clears state, and a key
  // held while focus moves into the chat input must still release cleanly
  // (otherwise W held across Enter would run the player forever).
  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.runDown = false;
    }
    if (event.code === 'KeyC') {
      this.emoteKeyDown = false;
    }
  };

  private readonly onWindowPointerMove = (event: PointerEvent) => {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
    this.pointerMoveSeen = true;
    // First-open guard: if the wheel opened before any pointermove this session
    // (cursor still at the 0,0 init), re-snapshot the origin here so this move
    // establishes the baseline instead of counting as a huge selection delta.
    if (this.emoteOriginPending) {
      this.emoteOriginX = event.clientX;
      this.emoteOriginY = event.clientY;
      this.emoteOriginPending = false;
    }
  };

  private readonly onGamepadConnect = (event: GamepadEvent) => {
    this.onGamepadConnected?.(event.gamepad.id);
  };

  private readonly onStickDown = (event: PointerEvent) => {
    event.preventDefault();
    const rect = this.stick.getBoundingClientRect();
    this.pointerState.active = true;
    this.pointerState.id = event.pointerId;
    this.pointerState.centerX = rect.left + rect.width / 2;
    this.pointerState.centerY = rect.top + rect.height / 2;
    this.pointerState.radius = rect.width * 0.42;
    try {
      this.stick.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic test events do not always have a capturable pointer id.
    }
    this.updatePointer(event.clientX, event.clientY);
  };

  private readonly onStickMove = (event: PointerEvent) => {
    if (!this.pointerState.active || event.pointerId !== this.pointerState.id) return;
    event.preventDefault();
    this.updatePointer(event.clientX, event.clientY);
  };

  private readonly onStickUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerState.id) return;
    event.preventDefault();
    this.pointerState.active = false;
    this.pointerState.id = null;
    this.pointer.set(0, 0);
    this.updateKnob();
  };

  private readonly onTalkDown = (event: PointerEvent) => {
    event.preventDefault();
    this.interactQueued = true;
  };

  private readonly onJumpDown = (event: PointerEvent) => {
    event.preventDefault();
    this.jumpQueued = true;
  };

  private readonly onContextMenu = (event: Event) => {
    event.preventDefault();
  };

  private readonly onCanvasPointerDown = (event: PointerEvent) => {
    if (event.button !== this.orbitButton) return;
    event.preventDefault();
    this.rmbHeld = true;
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic test events do not always have a capturable pointer id.
    }
  };

  private readonly onCanvasPointerMove = (event: PointerEvent) => {
    if (!this.rmbHeld) return;
    this.mouseLookX += event.movementX;
    this.mouseLookY += event.movementY;
  };

  private readonly onCanvasPointerUp = (event: PointerEvent) => {
    if (event.button !== this.orbitButton) return;
    this.rmbHeld = false;
  };

  private readonly onWheel = (event: WheelEvent) => {
    // Zoom works any time, not only while orbiting with RMB held.
    event.preventDefault();
    this.wheelDelta += event.deltaY;
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stick: HTMLElement,
    private readonly knob: HTMLElement,
    private readonly talkButton: HTMLElement,
    private readonly jumpButton: HTMLElement,
    /** Mouse button that holds-to-orbit the camera. Default 2 (right button);
     *  pass 1 (middle button) for a middle-drag orbit scheme. */
    private readonly orbitButton = 2,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('gamepadconnected', this.onGamepadConnect);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    this.canvas.addEventListener('pointercancel', this.onCanvasPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.stick.addEventListener('pointerdown', this.onStickDown);
    this.stick.addEventListener('pointermove', this.onStickMove);
    this.stick.addEventListener('pointerup', this.onStickUp);
    this.stick.addEventListener('pointercancel', this.onStickUp);
    this.talkButton.addEventListener('pointerdown', this.onTalkDown);
    this.jumpButton.addEventListener('pointerdown', this.onJumpDown);
  }

  /** Polls connected gamepads. Call once per frame before reading input. */
  poll(): void {
    const pads = navigator.getGamepads?.() ?? [];
    let pad: Gamepad | null = null;
    for (const candidate of pads) {
      if (candidate && candidate.connected) {
        pad = candidate;
        break;
      }
    }

    if (!pad) {
      this.gamepadVector.set(0, 0);
      this.gamepadLook.set(0, 0);
      this.gamepadRun = false;
      this.emoteButtonDown = false;
      this.prevButtons = [];
      return;
    }

    applyRadialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, STICK_DEADZONE, this.gamepadVector);
    applyRadialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, LOOK_DEADZONE, this.gamepadLook);
    this.gamepadRun = Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > RUN_THRESHOLD;
    this.emoteButtonDown = pad.buttons[BTN_Y]?.pressed ?? false;

    let anyPressed = false;
    for (let i = 0; i < pad.buttons.length; i += 1) {
      const pressed = pad.buttons[i]?.pressed ?? false;
      const wasPressed = this.prevButtons[i] ?? false;
      if (pressed && !wasPressed) {
        anyPressed = true;
        if (i === BTN_A) this.interactQueued = true;
        if (i === BTN_X) this.jumpQueued = true;
        if (i === BTN_B) this.cancelQueued = true;
        if (i === BTN_START) this.menuQueued = true;
        if (i === BTN_DPAD_UP) this.navQueued = 'up';
        if (i === BTN_DPAD_DOWN) this.navQueued = 'down';
        if (i === BTN_DPAD_LEFT) this.navQueued = 'left';
        if (i === BTN_DPAD_RIGHT) this.navQueued = 'right';
      }
      this.prevButtons[i] = pressed;
    }

    // Left-stick edge detection for menu navigation (one step per flick).
    const rawX = pad.axes[0] ?? 0;
    const rawY = pad.axes[1] ?? 0;
    if (rawY < -NAV_STICK_THRESHOLD && this.prevNavY >= -NAV_STICK_THRESHOLD) this.navQueued = 'up';
    if (rawY > NAV_STICK_THRESHOLD && this.prevNavY <= NAV_STICK_THRESHOLD) this.navQueued = 'down';
    if (rawX < -NAV_STICK_THRESHOLD && this.prevNavX >= -NAV_STICK_THRESHOLD) this.navQueued = 'left';
    if (rawX > NAV_STICK_THRESHOLD && this.prevNavX <= NAV_STICK_THRESHOLD) this.navQueued = 'right';
    this.prevNavX = rawX;
    this.prevNavY = rawY;

    if (anyPressed || this.gamepadVector.lengthSq() > 0 || this.gamepadLook.lengthSq() > 0) {
      this.setDevice('gamepad');
    }
  }

  get activeDevice(): InputDevice {
    return this.device;
  }

  readMovement(target: THREE.Vector2): THREE.Vector2 {
    this.keyVector.set(0, 0);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.keyVector.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.keyVector.x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.keyVector.y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.keyVector.y += 1;

    target.copy(this.keyVector).add(this.pointer).add(this.gamepadVector);
    if (target.lengthSq() > 1) target.normalize();
    return target.rotateAround(ORIGIN, -this.cameraYaw);
  }

  /** Right-stick look vector (already deadzoned), for camera free look. */
  readLook(target: THREE.Vector2): THREE.Vector2 {
    return target.copy(this.gamepadLook);
  }

  /** True while the camera should be in free-look mode (RMB held / right stick deflected). */
  isFreeLookHeld(): boolean {
    return this.rmbHeld || this.gamepadLook.lengthSq() > 0;
  }

  /** Accumulated RMB-drag mouse deltas (pixels) since the last call. */
  consumeMouseLook(target: THREE.Vector2): THREE.Vector2 {
    target.set(this.mouseLookX, this.mouseLookY);
    this.mouseLookX = 0;
    this.mouseLookY = 0;
    return target;
  }

  /** Accumulated wheel delta since the last call. */
  consumeZoom(): number {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }

  isRunHeld(): boolean {
    return this.runDown || this.gamepadRun;
  }

  /** True while the emote wheel input is held (C key / Y button). */
  isEmoteHeld(): boolean {
    return this.emoteKeyDown || this.emoteButtonDown;
  }

  /**
   * Snapshots the mouse-selection baseline and clears the latched keyboard pick.
   * Called when the emote wheel opens so nothing is pre-selected: the mouse path
   * measures movement since this origin, and at open the delta is zero.
   * On the session's very first open (before any pointermove, cursor still at
   * the 0,0 init), the origin is deferred to the next pointermove instead.
   */
  beginEmoteSelect(): void {
    this.emoteKeySelection = null;
    if (this.pointerMoveSeen) {
      this.emoteOriginX = this.mouseX;
      this.emoteOriginY = this.mouseY;
      this.emoteOriginPending = false;
    } else {
      this.emoteOriginPending = true;
    }
  }

  /** The latched WASD emote selection while the wheel is open, or null. */
  getEmoteKeySelection(): EmoteKind | null {
    return this.emoteKeySelection;
  }

  /** Clears the latched WASD emote selection (used when the mouse takes over). */
  clearEmoteKeySelection(): void {
    this.emoteKeySelection = null;
  }

  /**
   * Screen-space selection vector for the emote wheel (x right, y down).
   * Gamepad: raw left stick (rests at zero). Mouse: movement since the wheel
   * opened (current cursor minus the snapshotted origin), so at open the vector
   * is zero and nothing is highlighted until the cursor actually moves.
   */
  readEmoteSelect(target: THREE.Vector2): THREE.Vector2 {
    if (this.device === 'gamepad') {
      return target.copy(this.gamepadVector);
    }
    const scale = Math.min(window.innerWidth, window.innerHeight) * 0.2;
    target.set(
      (this.mouseX - this.emoteOriginX) / scale,
      (this.mouseY - this.emoteOriginY) / scale,
    );
    if (target.lengthSq() > 1) target.normalize();
    return target;
  }

  /** Current raw cursor position (viewport pixels), for per-frame move detection. */
  getMousePosition(target: THREE.Vector2): THREE.Vector2 {
    return target.set(this.mouseX, this.mouseY);
  }

  /** Returns true once per E press / A button / talk button tap. */
  consumeInteract(): boolean {
    const pressed = this.interactQueued;
    this.interactQueued = false;
    return pressed;
  }

  /** Returns true once per Space press / X or B button. */
  consumeJump(): boolean {
    const pressed = this.jumpQueued;
    this.jumpQueued = false;
    return pressed;
  }

  /** Returns true once per Escape press / Start button. */
  consumeMenu(): boolean {
    const pressed = this.menuQueued;
    this.menuQueued = false;
    return pressed;
  }

  /** Returns one queued gamepad menu-nav step (dpad or left-stick flick). */
  consumeNav(): MenuNav | null {
    const nav = this.navQueued;
    this.navQueued = null;
    return nav;
  }

  /** Returns true once per J press (keyboard only — gamepad reaches the log via the pause menu). */
  consumeQuestLog(): boolean {
    const pressed = this.questLogQueued;
    this.questLogQueued = false;
    return pressed;
  }

  /** Returns true once per I press (keyboard only — no touch/gamepad affordance yet). */
  consumeInventory(): boolean {
    const pressed = this.inventoryQueued;
    this.inventoryQueued = false;
    return pressed;
  }

  /** Returns true once per K press (keyboard only — no touch/gamepad affordance yet). */
  consumeAbilities(): boolean {
    const pressed = this.abilitiesQueued;
    this.abilitiesQueued = false;
    return pressed;
  }

  /** Returns true once per B button press (cancel/back). */
  consumeCancel(): boolean {
    const pressed = this.cancelQueued;
    this.cancelQueued = false;
    return pressed;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    window.removeEventListener('gamepadconnected', this.onGamepadConnect);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onCanvasPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.stick.removeEventListener('pointerdown', this.onStickDown);
    this.stick.removeEventListener('pointermove', this.onStickMove);
    this.stick.removeEventListener('pointerup', this.onStickUp);
    this.stick.removeEventListener('pointercancel', this.onStickUp);
    this.talkButton.removeEventListener('pointerdown', this.onTalkDown);
    this.jumpButton.removeEventListener('pointerdown', this.onJumpDown);
  }

  // --- InputRegistry support ---

  /** Returns true if the given key code is currently held down. */
  hasKey(code: string): boolean {
    return this.keys.has(code);
  }

  /** Returns true if the given key code was pressed this frame (not yet consumed). */
  hasPressedThisFrame(code: string): boolean {
    return this.pressedThisFrame.has(code) && !this.consumedThisFrame.has(code);
  }

  /** Returns true once per press — clears the queued state so subsequent calls return false. */
  consumeKey(code: string): boolean {
    if (!this.pressedThisFrame.has(code) || this.consumedThisFrame.has(code)) return false;
    this.consumedThisFrame.add(code);
    return true;
  }

  /** Clears per-frame state. Call at the end of the update loop after all features have consumed. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.consumedThisFrame.clear();
  }

  private setDevice(device: InputDevice): void {
    if (this.device === device) return;
    this.device = device;
    this.onDeviceChange?.(device);
  }

  private updatePointer(clientX: number, clientY: number): void {
    const dx = clientX - this.pointerState.centerX;
    const dy = clientY - this.pointerState.centerY;
    this.pointer.set(dx / this.pointerState.radius, dy / this.pointerState.radius);
    if (this.pointer.lengthSq() > 1) this.pointer.normalize();
    this.updateKnob();
  }

  private updateKnob(): void {
    const distance = 38;
    this.knob.style.transform = `translate(calc(-50% + ${this.pointer.x * distance}px), calc(-50% + ${this.pointer.y * distance}px))`;
  }
}

/** Scales stick input so magnitude ramps smoothly from 0 at the deadzone edge to 1. */
function applyRadialDeadzone(x: number, y: number, deadzone: number, target: THREE.Vector2): void {
  const magnitude = Math.hypot(x, y);
  if (magnitude < deadzone) {
    target.set(0, 0);
    return;
  }
  const scaled = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  target.set((x / magnitude) * scaled, (y / magnitude) * scaled);
}
