import type { Visualizer } from '../types';

export interface SidebarHooks {
  onSelect(id: string): void;
}

export class Sidebar {
  private list: HTMLUListElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private activeId: string | null = null;
  private enabled = false;

  constructor(
    private readonly visualizers: Visualizer[],
    private readonly hooks: SidebarHooks,
  ) {
    const list = document.getElementById('visualizer-list');
    if (!(list instanceof HTMLUListElement)) {
      throw new Error('sidebar: #visualizer-list not found');
    }
    this.list = list;
    this.render();
  }

  private render(): void {
    this.list.innerHTML = '';
    for (const v of this.visualizers) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'viz-item';
      btn.disabled = true;
      btn.innerHTML = `
        <span class="viz-name"></span>
        <span class="viz-desc"></span>
      `;
      const nameEl = btn.querySelector('.viz-name')!;
      const descEl = btn.querySelector('.viz-desc')!;
      nameEl.textContent = v.name;
      descEl.textContent = v.description;
      btn.addEventListener('click', () => {
        if (!this.enabled) return;
        this.setActive(v.id);
        this.hooks.onSelect(v.id);
      });
      this.buttons.set(v.id, btn);
      li.appendChild(btn);
      this.list.appendChild(li);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const btn of this.buttons.values()) {
      btn.disabled = !enabled;
    }
  }

  setActive(id: string | null): void {
    this.activeId = id;
    for (const [vizId, btn] of this.buttons) {
      btn.classList.toggle('active', vizId === id);
    }
  }

  getActive(): string | null {
    return this.activeId;
  }

  /**
   * Move selection to the next (direction=1) or previous (direction=-1)
   * visualizer, wrapping at the ends. If nothing is active yet, direction=1
   * picks the first item and direction=-1 picks the last. No-op if disabled.
   */
  cycle(direction: 1 | -1): void {
    if (!this.enabled || this.visualizers.length === 0) return;
    const n = this.visualizers.length;
    const currentIdx = this.activeId
      ? this.visualizers.findIndex((v) => v.id === this.activeId)
      : -1;
    const nextIdx =
      currentIdx === -1
        ? direction === 1
          ? 0
          : n - 1
        : (currentIdx + direction + n) % n;
    const next = this.visualizers[nextIdx];
    this.setActive(next.id);
    this.hooks.onSelect(next.id);
  }
}
