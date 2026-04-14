import type { Visualizer } from '../types';

const SAMPLE_RATE = 8000; // Hz. Low rate = each byte lasts longer = more audible texture.

/**
 * Interprets bytes as unsigned 8-bit PCM and plays them as audio while
 * displaying a waveform drawn via min/max reduction per pixel column.
 */
class WaveformRenderer {
  private root!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private playBtn!: HTMLButtonElement;
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private samples!: Float32Array;
  private playing = false;
  private resizeObserver!: ResizeObserver;

  mount(container: HTMLElement, bytes: Uint8Array): void {
    this.root = document.createElement('div');
    this.root.className = 'viz-root';
    this.root.style.background = '#000';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'viz-canvas';
    this.root.appendChild(this.canvas);

    // Convert bytes -> Float32 samples in [-1, 1].
    this.samples = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      this.samples[i] = (bytes[i]! - 128) / 128;
    }

    const controls = document.createElement('div');
    controls.className = 'viz-controls';
    this.playBtn = document.createElement('button');
    this.playBtn.type = 'button';
    this.playBtn.textContent = 'Play';
    this.playBtn.addEventListener('click', () => {
      if (this.playing) this.stop();
      else void this.play();
    });
    controls.appendChild(this.playBtn);
    this.root.appendChild(controls);

    const duration = bytes.length / SAMPLE_RATE;
    const overlay = document.createElement('div');
    overlay.className = 'viz-overlay';
    overlay.textContent = `${formatDuration(duration)} @ ${SAMPLE_RATE} Hz · ${bytes.length.toLocaleString()} samples`;
    this.root.appendChild(overlay);

    container.appendChild(this.root);

    this.draw();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this.canvas);
  }

  unmount(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.ctx?.close().catch(() => { /* ignore */ });
    this.ctx = null;
    this.buffer = null;
    this.root?.remove();
  }

  private async play(): Promise<void> {
    if (!this.ctx) this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (!this.buffer) {
      this.buffer = this.ctx.createBuffer(1, this.samples.length, SAMPLE_RATE);
      // Copy via the channel's own view to avoid a TS ArrayBuffer-variance issue
      // with copyToChannel when Float32Array is backed by ArrayBufferLike.
      this.buffer.getChannelData(0).set(this.samples);
    }
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.ctx.destination);
    this.source.onended = () => {
      this.playing = false;
      this.playBtn.textContent = 'Play';
    };
    this.source.start();
    this.playing = true;
    this.playBtn.textContent = 'Stop';
  }

  private stop(): void {
    if (this.source) {
      try { this.source.stop(); } catch { /* already stopped */ }
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
    this.playBtn.textContent = 'Play';
  }

  private draw(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const n = this.samples.length;
    if (n === 0) return;

    const mid = height / 2;
    ctx.strokeStyle = 'rgba(122, 162, 247, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();

    ctx.strokeStyle = '#7aa2f7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Min/max reduction per pixel column for dense display.
    for (let x = 0; x < width; x++) {
      const start = Math.floor((x * n) / width);
      const end = Math.floor(((x + 1) * n) / width);
      let min = 1, max = -1;
      for (let i = start; i < end; i++) {
        const s = this.samples[i]!;
        if (s < min) min = s;
        if (s > max) max = s;
      }
      if (start === end) {
        const s = this.samples[start] ?? 0;
        min = s;
        max = s;
      }
      const y1 = mid - max * mid;
      const y2 = mid - min * mid;
      ctx.moveTo(x + 0.5, y1);
      ctx.lineTo(x + 0.5, y2);
    }
    ctx.stroke();
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export const waveformVisualizer: Visualizer = (() => {
  let renderer: WaveformRenderer | null = null;
  return {
    id: 'waveform',
    name: 'Audio waveform',
    description: 'Bytes as 8-bit PCM, playable',
    category: 'audio',
    mount(container, bytes) {
      renderer = new WaveformRenderer();
      renderer.mount(container, bytes);
    },
    unmount() {
      renderer?.unmount();
      renderer = null;
    },
  };
})();
