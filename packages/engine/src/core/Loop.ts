export class Loop {
  private frameId = 0;
  private lastTime = 0;
  private running = false;
  private minFrameMs = 0;

  /** Caps the frame rate; pass 0 for uncapped. */
  setMaxFps(fps: number): void {
    this.minFrameMs = fps > 0 ? 1000 / fps : 0;
  }

  constructor(
    private readonly update: (deltaSeconds: number, elapsedSeconds: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  private readonly tick = (time: number) => {
    if (!this.running) return;
    this.frameId = requestAnimationFrame(this.tick);
    // Frame cap: skip this rAF entirely until enough time has passed.
    if (this.minFrameMs > 0 && time - this.lastTime < this.minFrameMs - 0.5) return;
    const deltaSeconds = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.update(deltaSeconds, time / 1000);
    this.render();
  };
}
