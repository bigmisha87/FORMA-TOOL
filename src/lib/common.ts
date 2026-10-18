export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_PIXELS = 32_000_000;

export function fail(code: string): never { throw new Error(code); }
export function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
export function stem(name: string) { return name.replace(/\.[^.]+$/, ''); }
export function outputName(name: string, ext: string, suffix = 'forma') { return `${stem(name)}-${suffix}.${ext}`; }
export function fit(w: number, h: number, maxW: number, maxH: number, keep = true, upscale = false) {
  if (![w, h, maxW, maxH].every(n => Number.isFinite(n) && n > 0)) fail('invalidDimensions');
  if (!keep) return { width: Math.round(upscale ? maxW : Math.min(w, maxW)), height: Math.round(upscale ? maxH : Math.min(h, maxH)) };
  const scale = Math.min(maxW / w, maxH / h, upscale ? Infinity : 1);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
export function checkPixels(w: number, h: number) { if (w * h > MAX_PIXELS || w > 16384 || h > 16384) fail('tooManyPixels'); }
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function zipFiles(files: { name: string; blob: Blob }[]) {
  const { zip } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    let name = file.name; let n = 2;
    while (name in entries) { name = `${stem(file.name)} (${n++}).${file.name.split('.').pop()}`; }
    entries[name] = new Uint8Array(await file.blob.arrayBuffer());
  }
  return new Promise<Blob>((resolve, reject) => zip(entries, { level: 0 }, (e, data) => e ? reject(e) : resolve(new Blob([data as BlobPart], { type: 'application/zip' }))));
}
export const tick = () => new Promise(resolve => setTimeout(resolve, 0));
export function parseRange(value: string, count: number): number[] {
  if (!value.trim()) return Array.from({ length: count }, (_, i) => i);
  const result: number[] = [];
  for (const segment of value.split(',')) {
    const match = segment.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) fail('invalidRange');
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > count) fail('invalidRange');
    for (let i = start - 1; i < end; i++) if (!result.includes(i)) result.push(i);
  }
  return result;
}
