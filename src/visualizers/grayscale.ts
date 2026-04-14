import type { Visualizer } from '../types';

/**
 * Renders the file as a square grayscale image: each byte becomes one pixel
 * whose intensity is its value. Image is drawn at the native byte resolution
 * then scaled to fit the stage via CSS `image-rendering: pixelated`.
 */
export const grayscaleVisualizer: Visualizer = (() => {
  let root: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  return {
    id: 'grayscale',
    name: 'Grayscale image',
    description: 'Bytes as pixel intensities in a square grid',
    category: 'image',
    mount(container, bytes) {
      root = document.createElement('div');
      root.className = 'viz-root';
      root.style.display = 'flex';
      root.style.alignItems = 'center';
      root.style.justifyContent = 'center';
      root.style.background = '#000';

      const byteCount = bytes.length;
      const side = Math.max(1, Math.ceil(Math.sqrt(byteCount)));

      const canvas = document.createElement('canvas');
      canvas.className = 'viz-canvas';
      canvas.width = side;
      canvas.height = side;
      canvas.style.width = 'auto';
      canvas.style.height = 'auto';
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
      canvas.style.imageRendering = 'pixelated';

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');

      const image = ctx.createImageData(side, side);
      const data = image.data;
      const totalPixels = side * side;
      for (let i = 0; i < totalPixels; i++) {
        const v = i < byteCount ? bytes[i]! : 0;
        const o = i * 4;
        data[o] = v;
        data[o + 1] = v;
        data[o + 2] = v;
        data[o + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);

      root.appendChild(canvas);

      // Keep the image pixel-aligned as the container resizes. We let CSS
      // handle the scaling; the ResizeObserver exists purely so we can adjust
      // the overlay label with the current pixel dimensions.
      const overlay = document.createElement('div');
      overlay.className = 'viz-overlay';
      overlay.textContent = `${side} × ${side} px (${byteCount.toLocaleString()} bytes)`;
      root.appendChild(overlay);

      container.appendChild(root);

      resizeObserver = new ResizeObserver(() => { /* no-op; CSS handles layout */ });
      resizeObserver.observe(container);
    },
    unmount() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      root?.remove();
      root = null;
    },
  };
})();
