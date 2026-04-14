import type { Visualizer } from '../types';

/**
 * The stage owns the lifecycle of the currently mounted visualizer. It ensures
 * that unmount() is called before mounting a new one so that AudioContexts,
 * rAF loops, WebGL contexts, and event listeners don't leak.
 */
export class Stage {
  private container: HTMLElement;
  private dropZone: HTMLElement;
  private current: Visualizer | null = null;

  constructor() {
    const container = document.getElementById('stage-content');
    const dropZone = document.getElementById('drop-zone');
    if (!(container instanceof HTMLElement) || !(dropZone instanceof HTMLElement)) {
      throw new Error('stage: required DOM nodes not found');
    }
    this.container = container;
    this.dropZone = dropZone;
  }

  mount(visualizer: Visualizer, bytes: Uint8Array): void {
    this.clear();
    this.hideDropZone();
    try {
      visualizer.mount(this.container, bytes);
      this.current = visualizer;
    } catch (err) {
      this.showError(err);
    }
  }

  clear(): void {
    if (this.current) {
      try {
        this.current.unmount();
      } catch (err) {
        console.error('visualizer unmount error', err);
      }
      this.current = null;
    }
    this.container.innerHTML = '';
  }

  showError(err: unknown): void {
    this.clear();
    this.hideDropZone();
    const div = document.createElement('div');
    div.className = 'viz-error';
    div.textContent = err instanceof Error ? err.message : String(err);
    this.container.appendChild(div);
  }

  showDropZone(): void {
    this.dropZone.classList.remove('hidden');
  }

  hideDropZone(): void {
    this.dropZone.classList.add('hidden');
  }
}
