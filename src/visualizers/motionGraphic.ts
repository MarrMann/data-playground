import type { Visualizer } from '../types';

/**
 * Generative motion graphic: the file is mapped into a flow field. Particles
 * drift along the field, drawing glowing trails. An offset into the file
 * shifts slowly over time, so the field itself morphs — the whole file is
 * "played" as an animation.
 */

const GRID_SIZE = 80;          // flow-field resolution (GRID_SIZE × GRID_SIZE cells)
const PARTICLE_COUNT = 1200;
const STEP = 1.2;              // particle speed (px per frame)
const FADE = 0.06;             // higher = shorter trails
const OFFSET_SPEED = 1;        // bytes per frame that the field window advances

class MotionRenderer {
  private root!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private bytes!: Uint8Array;
  private particles!: Float32Array; // [x, y, hueByte] triplets
  private frameId = 0;
  private offset = 0;
  private resizeObserver!: ResizeObserver;
  private overlay!: HTMLDivElement;

  mount(container: HTMLElement, bytes: Uint8Array): void {
    this.bytes = bytes.length > 0 ? bytes : new Uint8Array([0]);
    this.root = document.createElement('div');
    this.root.className = 'viz-root';
    this.root.style.background = '#0a0a12';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'viz-canvas';
    this.root.appendChild(this.canvas);

    this.overlay = document.createElement('div');
    this.overlay.className = 'viz-overlay';
    this.root.appendChild(this.overlay);

    container.appendChild(this.root);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;

    this.resize();
    this.seedParticles();

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.seedParticles();
    });
    this.resizeObserver.observe(container);

    this.animate();
  }

  unmount(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.root?.remove();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.ctx.fillStyle = '#0a0a12';
    this.ctx.fillRect(0, 0, width, height);
  }

  private seedParticles(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.particles = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles[i * 3] = Math.random() * w;
      this.particles[i * 3 + 1] = Math.random() * h;
      this.particles[i * 3 + 2] = 0;
    }
  }

  /** Look up the byte that defines the flow at grid cell (gx, gy). */
  private byteAt(gx: number, gy: number): number {
    const idx = (gy * GRID_SIZE + gx + this.offset) % this.bytes.length;
    return this.bytes[idx]!;
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    // Fade the previous frame slightly to create trails.
    ctx.fillStyle = `rgba(10, 10, 18, ${FADE})`;
    ctx.fillRect(0, 0, w, h);

    const cellW = w / GRID_SIZE;
    const cellH = h / GRID_SIZE;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const base = i * 3;
      let x = this.particles[base]!;
      let y = this.particles[base + 1]!;

      const gx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(x / cellW)));
      const gy = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(y / cellH)));
      const b = this.byteAt(gx, gy);
      const angle = (b / 255) * Math.PI * 2;

      const nx = x + Math.cos(angle) * STEP * (window.devicePixelRatio || 1);
      const ny = y + Math.sin(angle) * STEP * (window.devicePixelRatio || 1);

      // Color shifts with both byte and position.
      const hue = (b + this.particles[base + 2]!) % 360;
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
        // Respawn off-screen particles somewhere random.
        this.particles[base] = Math.random() * w;
        this.particles[base + 1] = Math.random() * h;
        this.particles[base + 2] = Math.floor(Math.random() * 360);
      } else {
        this.particles[base] = nx;
        this.particles[base + 1] = ny;
      }
    }

    this.offset = (this.offset + OFFSET_SPEED) % this.bytes.length;
    const pct = ((this.offset / this.bytes.length) * 100).toFixed(1);
    this.overlay.textContent = `flow-field from byte offset ${this.offset.toLocaleString()} (${pct}%)`;
  };
}

export const motionGraphicVisualizer: Visualizer = (() => {
  let renderer: MotionRenderer | null = null;
  return {
    id: 'motion',
    name: 'Motion graphic',
    description: 'Bytes as a flow field driving particle trails',
    category: 'motion',
    mount(container, bytes) {
      renderer = new MotionRenderer();
      renderer.mount(container, bytes);
    },
    unmount() {
      renderer?.unmount();
      renderer = null;
    },
  };
})();
