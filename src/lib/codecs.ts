import encodeJpeg, { init as initJpeg } from '@jsquash/jpeg/encode.js';
import initPng, { optimise } from '@jsquash/oxipng/codec/pkg/squoosh_oxipng.js';

let baseURL = '';
let jpegReady: Promise<void> | undefined;
let pngReady: ReturnType<typeof initPng> | undefined;

export function configureCodecs(url: string) { baseURL = url; }
function asset(name: string) {
  const base = baseURL || new URL(import.meta.env.BASE_URL, document.baseURI).href;
  return new URL(`codecs/${name}`, base).href;
}

export async function mozJpeg(data: ImageData, quality: number): Promise<Blob> {
  jpegReady ??= initJpeg({ locateFile: () => asset('mozjpeg_enc.wasm') });
  await jpegReady;
  // Standard quantization + fixed 4:2:0 avoided quality regressions on the
  // photo/detail benchmark versus the codec's automatic sampling/table defaults.
  const bytes = await encodeJpeg(data, { quality: Math.round(quality * 100), progressive: true, optimize_coding: true, auto_subsample: false, chroma_subsample: 2, quant_table: 0 });
  return new Blob([bytes], { type: 'image/jpeg' });
}

// PDF image samples stay in their existing color space; retain all chroma detail.
export async function mozJpegPdf(data: ImageData, grayscale: boolean): Promise<Uint8Array> {
  jpegReady ??= initJpeg({ locateFile: () => asset('mozjpeg_enc.wasm') });
  await jpegReady;
  const bytes = await encodeJpeg(data, { quality: 97, auto_subsample: false, chroma_subsample: 1, color_space: grayscale ? 1 : 3, progressive: true, optimize_coding: true });
  return new Uint8Array(bytes);
}

export async function oxipng(bytes: ArrayBuffer): Promise<Blob> {
  pngReady ??= initPng(asset('oxipng_bg.wasm'));
  await pngReady;
  // Do not modify fully transparent RGB values or quantize the palette.
  const output = optimise(new Uint8Array(bytes), 2, false, false);
  return new Blob([output as BlobPart], { type: 'image/png' });
}

export async function gifsicle(file: Blob, colors = 0): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(asset('gifsicle.worker.js'));
    const finish = () => { clearTimeout(timeout); worker.terminate(); };
    const timeout = setTimeout(() => { finish(); reject(new Error('compressionTimeout')); }, 120_000);
    worker.onerror = () => { finish(); reject(new Error('codecError')); };
    worker.onmessage = ({data}: MessageEvent<unknown>) => {
      finish();
      if (!Array.isArray(data) || !data[0]?.file) { reject(new Error('codecError')); return; }
      resolve(new Blob([data[0].file], { type: 'image/gif' }));
    };
    const palette = colors ? ` --colors=${colors} --color-method=diversity` : '';
    worker.postMessage({ data: [{ name: 'input.gif', file: buffer }], command: [`-O2 --careful${palette} input.gif -o /out/output.gif`], folder: [], isStrict: false }, [buffer]);
  });
}


