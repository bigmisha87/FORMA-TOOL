import { processImage } from './image';
import type { ImageResult, ImageSettings, Progress } from './image';
export function runImage(file: File, settings: ImageSettings, progress: Progress): Promise<ImageResult> {
  if (typeof OffscreenCanvas === 'undefined' || !OffscreenCanvas.prototype.convertToBlob) return processImage(file,settings,progress);
  return new Promise((resolve,reject) => {
    const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type:'module' });
    worker.onmessage = ({data}:{ data:{progress?: number; result?: ImageResult; error?: string} }) => {
      if (typeof data.progress === 'number') progress(data.progress);
      if (data.result) { worker.terminate(); resolve(data.result); }
      if (data.error) { worker.terminate(); reject(new Error(data.error)); }
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('genericError')); };
    worker.postMessage({file,settings,baseURL:new URL(import.meta.env.BASE_URL,document.baseURI).href});
  });
}
