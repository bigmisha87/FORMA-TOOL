import UPNG from '@pdf-lib/upng';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { checkPixels, fail, fit, MAX_IMAGE_BYTES, outputName, tick } from './common';
import { mozJpeg, oxipng, gifsicle } from './codecs';

export type ImageFormat = 'original' | 'jpeg' | 'png' | 'webp' | 'gif';
export type ImageTask = 'compress' | 'resize' | 'convert' | 'inspect';
export type ImageSettings = {
  task: ImageTask; format: ImageFormat; mode: 'recommended' | 'target'; reduction: number;
  targetKB: number; width: number; height: number; keep: boolean; upscale: boolean; colors: number;
};
export const defaultImageSettings: ImageSettings = { task: 'compress', format: 'original', mode: 'recommended', reduction: 40, targetKB: 200, width: 1920, height: 1080, keep: true, upscale: false, colors: 0 };
export type ImageInfo = { width: number; height: number; format: string; frames: number };
export type ImageResult = ImageInfo & { blob: Blob; name: string; originalSize: number; targetMet: boolean; keptOriginal: boolean; flattened: boolean };
export type Progress = (fraction: number) => void;

type Canvas = HTMLCanvasElement | OffscreenCanvas;
function canvas(w: number, h: number): Canvas {
  checkPixels(w, h);
  if (typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}
function context(c: Canvas) { const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null; if (!ctx) fail('canvasError'); return ctx; }
export async function toBlob(c: Canvas, mime: string, quality = .85): Promise<Blob> {
  if ('convertToBlob' in c) {
    const blob = await c.convertToBlob({ type: mime, quality });
    if (blob.type !== mime) fail('unsupportedOutput');
    return blob;
  }
  return new Promise((resolve, reject) => c.toBlob(b => b && b.type === mime ? resolve(b) : reject(new Error('unsupportedOutput')), mime, quality));
}

export async function inspectImage(file: File): Promise<ImageInfo> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) fail('imageTooLarge');
  const buf = await file.arrayBuffer(); const b = new Uint8Array(buf);
  let format = '';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) format = 'jpeg';
  if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) format = 'png';
  if (String.fromCharCode(...b.slice(0, 6)).match(/^GIF8[79]a$/)) format = 'gif';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') format = 'webp';
  if (!format) fail('unsupportedImage');
  if (format === 'png') {
    const view = new DataView(buf);
    if (b.length < 24) fail('unsupportedImage');
    checkPixels(view.getUint32(16), view.getUint32(20));
    let pos = 8;
    while (pos + 12 <= b.length) {
      if (String.fromCharCode(...b.slice(pos + 4, pos + 8)) === 'acTL') fail('animatedPng');
      pos += view.getUint32(pos) + 12;
    }
  }
  if (format === 'webp') {
    // Reject animated WebP rather than silently dropping its animation.
    let pos = 12;
    while (pos + 8 <= b.length) {
      if (String.fromCharCode(...b.slice(pos, pos + 4)) === 'ANIM') fail('animatedWebp');
      const len = new DataView(buf).getUint32(pos + 4, true); pos += 8 + len + (len % 2);
    }
  }
  if (format === 'gif') {
    const parsed = parseGIF(buf); const frames = parsed.frames.filter(f => 'image' in f).length;
    checkPixels(parsed.lsd.width, parsed.lsd.height);
    if (frames > 300 || parsed.lsd.width * parsed.lsd.height * frames > 80_000_000) fail('gifTooLarge');
    return { width: parsed.lsd.width, height: parsed.lsd.height, format, frames };
  }
  const bitmap = await createImageBitmap(file);
  const info = { width: bitmap.width, height: bitmap.height, format, frames: 1 }; bitmap.close(); checkPixels(info.width, info.height);
  return info;
}

function loopCount(bytes: Uint8Array) {
  const marker = new TextEncoder().encode('NETSCAPE2.0');
  for (let i = 0; i < bytes.length - 16; i++) {
    if (marker.every((v, j) => bytes[i + j] === v) && bytes[i + 11] === 3 && bytes[i + 12] === 1) return bytes[i + 13] + 256 * bytes[i + 14];
  }
  return -1;
}

async function encodeGif(file: File, info: ImageInfo, w: number, h: number, colors: number, progress: Progress) {
  const original = new Uint8Array(await file.arrayBuffer());
  const parsed = parseGIF(original.buffer);
  const frames = decompressFrames(parsed, true);
  const source = canvas(info.width, info.height), ctx = context(source);
  const target = canvas(w, h), tc = context(target);
  const patch = canvas(info.width, info.height), pc = context(patch);
  const gif = GIFEncoder();
  const rawFrames = parsed.frames.filter(f => 'image' in f);
  const bg = parsed.gct?.[parsed.lsd.backgroundColorIndex] || [0, 0, 0];
  const fillBackground = (x: number, y: number, w: number, h: number) => { ctx.fillStyle = `rgb(${bg.join(',')})`; ctx.fillRect(x, y, w, h); };
  if (frames[0].transparentIndex === undefined) fillBackground(0, 0, info.width, info.height);
  let previous: typeof frames[number] | undefined; let restore: ImageData | undefined;
  for (let i = 0; i < frames.length; i++) {
    if (previous?.disposalType === 2) {
      const d = previous.dims;
      if (previous.transparentIndex !== undefined) ctx.clearRect(d.left, d.top, d.width, d.height);
      else fillBackground(d.left, d.top, d.width, d.height);
    }
    if (previous?.disposalType === 3 && restore) ctx.putImageData(restore, 0, 0);
    const frame = frames[i];
    restore = frame.disposalType === 3 ? ctx.getImageData(0, 0, info.width, info.height) : undefined;
    patch.width = frame.dims.width; patch.height = frame.dims.height;
    pc.putImageData(new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height), 0, 0);
    ctx.drawImage(patch, frame.dims.left, frame.dims.top);
    tc.clearRect(0, 0, w, h); tc.drawImage(source, 0, 0, w, h);
    const rgba = tc.getImageData(0, 0, w, h).data;
    const palette = quantize(rgba, colors, { format: 'rgba4444', oneBitAlpha: true });
    const indices = applyPalette(rgba, palette, 'rgba4444');
    const transparentIndex = palette.findIndex((p: number[]) => p[3] === 0);
    // Full composited frames + disposal 2 preserve transparency and avoid ghosting.
    const raw = rawFrames[i]; const delay = 'gce' in raw && raw.gce ? raw.gce.delay * 10 : 100;
    gif.writeFrame(indices, w, h, { palette, delay, repeat: loopCount(original), dispose: 2, transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex) });
    previous = frame; progress((i + 1) / frames.length); await tick();
  }
  gif.finish(); return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}

export async function processImage(file: File, settings: ImageSettings, progress: Progress = () => {}): Promise<ImageResult> {
  const info = await inspectImage(file);
  const format = settings.format === 'original' ? info.format : settings.format;
  let { width, height } = info;
  if (settings.task === 'resize') ({ width, height } = fit(width, height, settings.width, settings.height, settings.keep, settings.upscale));
  const result = (blob: Blob, targetMet = true, keptOriginal = false): ImageResult => ({ ...info, width, height, frames: format === 'gif' ? info.frames : 1, format, blob, name: outputName(file.name, format === 'jpeg' ? 'jpg' : format), originalSize: file.size, targetMet, keptOriginal, flattened: info.frames > 1 && format !== 'gif' });
  if (format === 'gif' && info.format === 'gif') {
    const blob = settings.task === 'compress'
      ? await gifsicle(file, settings.colors)
      : await gifsicle(await encodeGif(file, info, width, height, 256, progress));
    progress(1);
    if (settings.task === 'compress' && blob.size >= file.size) return result(file, true, true);
    return { ...result(blob), frames: (await inspectImage(new File([blob], file.name))).frames };
  }
  let bitmap: ImageBitmap;
  if (info.format === 'gif') {
    // Explicit still-frame conversion: decode the first frame, supported in every browser.
    const parsed = parseGIF(await file.arrayBuffer()); const f = decompressFrames(parsed, true)[0];
    const first = canvas(info.width, info.height), ctx = context(first);
    const p = canvas(f.dims.width, f.dims.height); context(p).putImageData(new ImageData(new Uint8ClampedArray(f.patch), f.dims.width, f.dims.height), 0, 0);
    ctx.drawImage(p, f.dims.left, f.dims.top); bitmap = await createImageBitmap(first);
  } else bitmap = await createImageBitmap(file);
  let c = canvas(width, height);
  const draw = () => { const ctx = context(c); if (format === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); } ctx.drawImage(bitmap, 0, 0, width, height); };
  try {
    draw(); progress(.15); await tick();
    let blob: Blob;
    let target = Infinity;
    if (settings.task === 'compress' && ['jpeg', 'webp'].includes(format)) {
      target = settings.mode === 'target' ? settings.targetKB * 1024 : file.size * (1 - settings.reduction / 100);
      if (!Number.isFinite(target) || target <= 0 || (settings.mode === 'target' && target < 1024)) fail('invalidTarget');
      let best: Blob | undefined;
      for (let shrink = 0; shrink < 12; shrink++) {
        let lo = .08, hi = .96;
        const pixels = format === 'jpeg' ? context(c).getImageData(0, 0, width, height) : undefined;
        const encode = (q: number) => pixels ? mozJpeg(pixels,q) : toBlob(c, `image/${format}`, q);
        const smallest = await encode(lo);
        if (smallest.size <= target) {
          best = smallest;
          for (let i = 0; i < 8; i++) { const q = (lo + hi) / 2; const b = await encode(q); if (b.size <= target) { best = b; lo = q; } else hi = q; }
          break;
        }
        best = smallest;
        if (width <= 32 || height <= 32) break;
        const scale = Math.min(.85, Math.sqrt(target / smallest.size) * .9);
        width = Math.max(1, Math.floor(width * scale)); height = Math.max(1, Math.floor(height * scale));
        c = canvas(width, height); draw(); progress(.2 + shrink / 20); await tick();
      }
      blob = best!;
    } else if (format === 'png') {
      if (settings.task === 'compress' && info.format === 'png' && !settings.colors) {
        blob = await oxipng(await file.arrayBuffer());
      } else {
        const rgba = context(c).getImageData(0, 0, width, height);
        const png = UPNG.encode([rgba.data.buffer as ArrayBuffer], width, height, settings.task === 'compress' ? settings.colors : 0);
        blob = await oxipng(png);
      }
    } else if (format === 'gif') {
      const rgba = context(c).getImageData(0, 0, width, height).data;
      const palette = quantize(rgba, 256, { format: 'rgba4444', oneBitAlpha: true });
      const indices = applyPalette(rgba, palette, 'rgba4444'); const gif = GIFEncoder();
      const ti = palette.findIndex((p: number[]) => p[3] === 0);
      gif.writeFrame(indices, width, height, { palette, transparent: ti >= 0, transparentIndex: Math.max(0, ti), repeat: -1 }); gif.finish();
      blob = new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
    } else blob = format === 'jpeg' ? await mozJpeg(context(c).getImageData(0,0,width,height),.9) : await toBlob(c, `image/${format}`, .9);
    progress(1);
    if (settings.task === 'compress' && format === info.format && blob.size >= file.size && width === info.width && height === info.height) return result(file, file.size <= target, true);
    return result(blob, blob.size <= target);
  } finally { bitmap.close(); c.width = 0; c.height = 0; }
}
