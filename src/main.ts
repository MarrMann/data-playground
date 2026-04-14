import { Sidebar } from './ui/sidebar';
import { Stage } from './ui/stage';
import { visualizers, getVisualizer } from './registry';
import { loadFile, formatBytes, FileTooLargeError } from './fileLoader';
import { MAX_FILE_SIZE, type LoadedFile } from './types';

const stage = new Stage();
let sidebar: Sidebar;
let currentFile: LoadedFile | null = null;

function setFileInfo(text: string, isError = false): void {
  const el = document.getElementById('file-info');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function handleVisualizerSelect(id: string): void {
  if (!currentFile) return;
  const viz = getVisualizer(id);
  if (!viz) {
    stage.showError(new Error(`Unknown visualizer: ${id}`));
    return;
  }
  stage.mount(viz, currentFile.bytes);
}

async function handleFile(file: File): Promise<void> {
  try {
    const loaded = await loadFile(file);
    currentFile = loaded;
    setFileInfo(`${loaded.name} — ${formatBytes(loaded.size)}`);
    sidebar.setEnabled(true);

    // Default to the first visualizer (hex) on new file, or keep current
    // selection if the user already picked one.
    const activeId = sidebar.getActive() ?? visualizers[0]?.id ?? null;
    if (activeId) {
      sidebar.setActive(activeId);
      handleVisualizerSelect(activeId);
    }
  } catch (err) {
    currentFile = null;
    sidebar.setEnabled(false);
    if (err instanceof FileTooLargeError) {
      setFileInfo(err.message, true);
    } else {
      setFileInfo(err instanceof Error ? err.message : 'Failed to load file', true);
    }
    stage.clear();
    stage.showDropZone();
  }
}

function wireFileInput(): void {
  const button = document.getElementById('pick-file');
  const input = document.getElementById('file-input');
  if (!(button instanceof HTMLButtonElement) || !(input instanceof HTMLInputElement)) {
    throw new Error('main: file picker elements missing');
  }
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void handleFile(file);
    // Reset so selecting the same file again re-triggers change.
    input.value = '';
  });
}

function wireDropZone(): void {
  const app = document.getElementById('app');
  const dropZone = document.getElementById('drop-zone');
  if (!(app instanceof HTMLElement) || !(dropZone instanceof HTMLElement)) {
    throw new Error('main: drop zone elements missing');
  }

  let dragDepth = 0;
  const showDragging = () => dropZone.classList.add('dragging');
  const hideDragging = () => dropZone.classList.remove('dragging');

  // Track drag over the whole app so the drop zone overlay appears even when
  // the stage content is covering it (e.g., while a visualizer is active).
  app.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    showDragging();
  });
  app.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  app.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) hideDragging();
  });
  app.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    hideDragging();
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  });
}

function hasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  // Works in all modern browsers; Safari uses 'Files' as well.
  return Array.from(types).includes('Files');
}

function init(): void {
  sidebar = new Sidebar(visualizers, { onSelect: handleVisualizerSelect });
  sidebar.setEnabled(false);
  wireFileInput();
  wireDropZone();

  const maxLabel = document.getElementById('max-size-label');
  if (maxLabel) maxLabel.textContent = formatBytes(MAX_FILE_SIZE);
}

init();
