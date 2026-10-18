import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { fail, MAX_PDF_BYTES, outputName, tick, zipFiles } from './common';
import { toBlob } from './image';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export type PdfSource = { id: string; file: File; bytes: Uint8Array; doc: PDFDocument; preview: pdfjs.PDFDocumentProxy; close: () => Promise<void> };
export type PdfPage = { id: string; source: string; index: number; rotation: number; selected: boolean; thumbnail: string };
export type PdfMode = 'organize' | 'compress' | 'split' | 'images';

export async function loadPdf(file: File): Promise<PdfSource> {
  if (!file.size || file.size > MAX_PDF_BYTES) fail('pdfTooLarge');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) fail('invalidPdf');
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch (e) { if (String(e).toLowerCase().includes('encrypt')) fail('encryptedPdf'); fail('invalidPdf'); }
  if (doc.getPageCount() > 200) fail('pdfTooManyPages');
  if (doc.getPageCount() < 1) fail('invalidPdf');
  // Keep a separate buffer: PDF.js transfers its input into the rendering worker.
  const loadingTask = pdfjs.getDocument({ data: bytes.slice(),
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
  });
  try {
    const preview = await loadingTask.promise;
    return { id: crypto.randomUUID(), file, bytes, doc, preview, close: () => loadingTask.destroy() };
  } catch (e) { await loadingTask.destroy(); throw e; }
}

export async function renderPage(source: PdfSource, index: number, scale = .3, rotation = 0, maxPixels = 12_000_000) {
  const page = await source.preview.getPage(index + 1);
  const raw = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
  const adjusted = Math.min(scale, Math.sqrt(maxPixels / (raw.width * raw.height)), 8000 / Math.max(raw.width, raw.height));
  const viewport = page.getViewport({ scale: adjusted, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport, background: 'rgb(255,255,255)' }).promise;
  return canvas;
}

export async function makePages(source: PdfSource, progress: (n: number) => void) {
  const pages: PdfPage[] = [];
  for (let index = 0; index < source.doc.getPageCount(); index++) {
    const canvas = await renderPage(source, index, .26, 0, 120_000);
    pages.push({ id: crypto.randomUUID(), source: source.id, index, rotation: 0, selected: true, thumbnail: canvas.toDataURL('image/jpeg', .7) });
    canvas.width = 0; progress((index + 1) / source.doc.getPageCount()); await tick();
  }
  return pages;
}

export async function organizePdf(sources: PdfSource[], pages: PdfPage[]) {
  if (!pages.length) fail('noPages');
  const out = await PDFDocument.create();
  for (const item of pages) {
    const source = sources.find(s => s.id === item.source)!;
    const [p] = await out.copyPages(source.doc, [item.index]);
    p.setRotation(degrees((p.getRotation().angle + item.rotation) % 360)); out.addPage(p);
  }
  return new Blob([await out.save({ useObjectStreams: true }) as BlobPart], { type: 'application/pdf' });
}

export async function compressPdf(source: PdfSource, strong: boolean, dpi: number, progress: (n: number) => void) {
  if (!strong) {
    const doc = await PDFDocument.load(source.bytes, { updateMetadata: false });
    const result = new Blob([await doc.save({ useObjectStreams: true, addDefaultPage: false }) as BlobPart], { type: 'application/pdf' });
    progress(1); return result.size < source.file.size ? result : source.file;
  }
  const doc = await PDFDocument.create();
  for (let i = 0; i < source.doc.getPageCount(); i++) {
    const canvas = await renderPage(source, i, dpi / 72);
    const jpeg = await toBlob(canvas, 'image/jpeg', .68);
    const image = await doc.embedJpg(await jpeg.arrayBuffer());
    const page = await source.preview.getPage(i + 1); const viewport = page.getViewport({ scale: 1 });
    const output = doc.addPage([viewport.width, viewport.height]);
    output.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    canvas.width = 0; progress((i + 1) / source.doc.getPageCount()); await tick();
  }
  const result = new Blob([await doc.save() as BlobPart], { type: 'application/pdf' });
  return result.size < source.file.size ? result : source.file;
}

export async function splitPdf(sources: PdfSource[], pages: PdfPage[], progress: (n: number) => void) {
  const outputs: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]; const source = sources.find(s => s.id === p.source)!;
    outputs.push({ name: outputName(source.file.name, 'pdf', `page-${p.index + 1}-${i + 1}`), blob: await organizePdf(sources, [p]) });
    progress((i + 1) / pages.length); await tick();
  }
  return zipFiles(outputs);
}

export async function pdfToImages(sources: PdfSource[], pages: PdfPage[], progress: (n: number) => void) {
  const outputs: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]; const source = sources.find(s => s.id === p.source)!;
    const canvas = await renderPage(source, p.index, 150 / 72, p.rotation);
    outputs.push({ name: outputName(source.file.name, 'jpg', `page-${p.index + 1}-${i + 1}`), blob: await toBlob(canvas, 'image/jpeg', .9) });
    canvas.width = 0; progress((i + 1) / pages.length); await tick();
  }
  return zipFiles(outputs);
}

export async function imagesToPdf(files: { blob: Blob; width: number; height: number }[]) {
  const doc = await PDFDocument.create();
  for (const file of files) {
    const bitmap = await createImageBitmap(file.blob);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const image = await doc.embedJpg(await (await toBlob(canvas, 'image/jpeg', .92)).arrayBuffer());
    const w = Math.min(file.width * .75, 14400), h = w * file.height / file.width;
    doc.addPage([w, h]).drawImage(image, { x: 0, y: 0, width: w, height: h }); canvas.width = 0;
  }
  return new Blob([await doc.save() as BlobPart], { type: 'application/pdf' });
}
