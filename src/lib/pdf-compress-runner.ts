// SPDX-License-Identifier: AGPL-3.0-or-later
export function runPdfCompression(bytes: Uint8Array, highQuality: boolean, progress: (n: number) => void): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf-compress.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => { finish(); reject(new Error('compressionTimeout')); }, 180_000);
    worker.onmessage = ({ data }: MessageEvent<{ progress?: number; bytes?: Uint8Array; error?: string }>) => {
      if (typeof data.progress === 'number') progress(data.progress);
      if (data.bytes) { finish(); resolve(data.bytes); }
      if (data.error) { finish(); reject(new Error(data.error)); }
    };
    worker.onerror = () => { finish(); reject(new Error('pdfCompressionError')); };
    const copy = bytes.slice();
    worker.postMessage({ bytes: copy, highQuality, baseURL: new URL(import.meta.env.BASE_URL, document.baseURI).href }, [copy.buffer]);
  });
}
