import { MAX_FILE_SIZE, type LoadedFile } from './types';

export class FileTooLargeError extends Error {
  constructor(
    public readonly size: number,
    public readonly max: number,
  ) {
    super(
      `File is too large (${formatBytes(size)}). Max supported size is ${formatBytes(max)}.`,
    );
    this.name = 'FileTooLargeError';
  }
}

export async function loadFile(file: File): Promise<LoadedFile> {
  if (file.size > MAX_FILE_SIZE) {
    throw new FileTooLargeError(file.size, MAX_FILE_SIZE);
  }
  const buffer = await file.arrayBuffer();
  return {
    name: file.name,
    size: file.size,
    bytes: new Uint8Array(buffer),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
