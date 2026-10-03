// A short burst of confetti when somebody wins. It draws nothing at all for a player who has asked for
// reduced motion, caps its particles, and removes its canvas when it ends. The logic takes everything it
// touches (canvas, clock, frame loop, random numbers) as arguments, so it is tested without a browser.

export const MAX_PARTICLES = 140;
export const DURATION_MS = 2600;

const GRAVITY = 0.0004; // pixels per ms, per ms
const COLOURS = [0, 45, 120, 200, 280, 330];

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  hue: number;
}

/** Up to MAX_PARTICLES pieces, just above the top edge, spread across `width`. `random` returns [0, 1). */
export function createParticles(count: number, random: () => number, width: number): Particle[] {
  const n = Math.max(0, Math.min(count, MAX_PARTICLES));
  return Array.from({ length: n }, () => ({
    x: random() * width,
    y: -random() * 60,
    vx: (random() - 0.5) * 0.15,
    vy: 0.1 + random() * 0.15,
    size: 6 + random() * 6,
    angle: random() * Math.PI * 2,
    spin: (random() - 0.5) * 0.01,
    hue: COLOURS[Math.floor(random() * COLOURS.length) % COLOURS.length]!,
  }));
}

/** Move everything on by `dt` milliseconds, and drop what has fallen below `height`. */
export function stepParticles(particles: Particle[], dt: number, height = Infinity): Particle[] {
  return particles
    .map((p) => {
      const vy = p.vy + GRAVITY * dt;
      return { ...p, vy, x: p.x + p.vx * dt, y: p.y + vy * dt, angle: p.angle + p.spin * dt };
    })
    .filter((p) => p.y <= height + 20);
}

export interface ConfettiDeps {
  reducedMotion: boolean;
  createCanvas(): HTMLCanvasElement;
  attach(canvas: HTMLCanvasElement): void;
  detach(canvas: HTMLCanvasElement): void;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
  now(): number;
  random(): number;
  size(): { width: number; height: number };
}

export interface ConfettiRun {
  stop(): void;
}

/** Start the burst. Returns null (and creates nothing) when reduced motion is requested. */
export function startConfetti(deps: ConfettiDeps): ConfettiRun | null {
  if (deps.reducedMotion) return null;
  const canvas = deps.createCanvas();
  const { width, height } = deps.size();
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  deps.attach(canvas);

  let particles = createParticles(MAX_PARTICLES, deps.random, width);
  const started = deps.now();
  let last = started;
  let frame = 0;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    deps.cancelFrame(frame);
    deps.detach(canvas);
  };

  const loop = () => {
    if (stopped) return;
    const now = deps.now();
    const dt = Math.min(50, now - last);
    last = now;
    particles = stepParticles(particles, dt, height);
    if (now - started > DURATION_MS || particles.length === 0) {
      stop();
      return;
    }
    if (context) {
      context.clearRect(0, 0, width, height);
      for (const p of particles) {
        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.angle);
        context.fillStyle = `hsl(${p.hue} 85% 55%)`;
        context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        context.restore();
      }
    }
    frame = deps.requestFrame(loop);
  };
  frame = deps.requestFrame(loop);
  return { stop };
}

/** Confetti over the page, unless the player prefers reduced motion. */
export function celebrate(): ConfettiRun | null {
  return startConfetti({
    reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
    createCanvas: () => {
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
      return canvas;
    },
    attach: (canvas) => document.body.append(canvas),
    detach: (canvas) => canvas.remove(),
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (id) => cancelAnimationFrame(id),
    now: () => performance.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32,
    size: () => ({ width: innerWidth, height: innerHeight }),
  });
}
