// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as MuPDF from 'mupdf';
import { mozJpegPdf } from './codecs';

type Library = typeof MuPDF;
type Obj = MuPDF.PDFObject;
const options = 'garbage=4,compress=yes,compress-images=yes,compress-fonts=yes,objstms=yes';

function channels(object: Obj): number {
  const cs = object.get('ColorSpace');
  if (cs.isName()) return cs.asName() === 'DeviceRGB' ? 3 : cs.asName() === 'DeviceGray' ? 1 : 0;
  if (cs.isArray() && cs.get(0).isName() && cs.get(0).asName() === 'ICCBased') {
    const n = cs.get(1, 'N').asNumber(); return n === 1 || n === 3 ? n : 0;
  }
  return 0;
}

function snapshot(doc: MuPDF.PDFDocument) {
  const result: { text: string; bounds: number[] }[] = [];
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    try { const text = page.toStructuredText(''); try { result.push({ text: text.asText(), bounds: page.getBounds() }); } finally { text.destroy(); } }
    finally { page.destroy(); }
  }
  return JSON.stringify(result);
}

async function optimizeImage(doc: MuPDF.PDFDocument, image: Obj) {
  const w = image.get('Width').asNumber(), h = image.get('Height').asNumber(), n = channels(image);
  const filter = image.get('Filter');
  // Preserve unsupported/complex color encodings, JPEGs, masks and decode arrays.
  if (!n || !Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || w * h > 32_000_000 || image.get('BitsPerComponent').asNumber() !== 8) return;
  if (!image.get('Decode').isNull() || !image.get('Mask').isNull() || !image.get('ImageMask').isNull()) return;
  if (!filter.isNull() && (!filter.isName() || filter.asName() !== 'FlateDecode')) return;
  const raw = image.readRawStream(); let oldSize: number;
  try { oldSize = raw.length; } finally { raw.destroy(); }
  // Flat art and text scans stay lossless. Small assets are not worth recompressing.
  if (oldSize < 4096 || oldSize / (w * h) < .2) return;
  let decoded: MuPDF.Buffer;
  try { decoded = image.readStream(); } catch { return; }
  let samples: Uint8Array;
  try { if (decoded.length !== w * h * n) return; samples = decoded.asUint8Array().slice(); }
  finally { decoded.destroy(); }
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    rgba[j] = samples[i * n]; rgba[j + 1] = n === 1 ? samples[i] : samples[i * n + 1]; rgba[j + 2] = n === 1 ? samples[i] : samples[i * n + 2]; rgba[j + 3] = 255;
  }
  const jpeg = await mozJpegPdf(new ImageData(rgba, w, h), n === 1);
  if (jpeg.length >= oldSize) return;
  // Placement, ICC, soft mask, dimensions, content streams and text remain intact.
  image.put('Filter', doc.newName('DCTDecode')); image.delete('DecodeParms'); image.writeRawStream(jpeg);
}

export async function compressPreservingPdf(mupdf: Library, input: Uint8Array, highQuality: boolean, progress: (n: number) => void): Promise<Uint8Array> {
  const opened = mupdf.Document.openDocument(input, 'application/pdf');
  const doc = opened.asPDF();
  if (!doc) { opened.destroy(); throw new Error('invalidPdf'); }
  try {
    const before = snapshot(doc); progress(.08);
    const masks = new Set<number>(), images: number[] = [];
    for (let i = 1; i < doc.countObjects(); i++) {
      const obj = doc.newIndirect(i);
      try {
        if (!obj.get('ByteRange').isNull()) throw new Error('signedPdf');
        if (!obj.isStream()) continue;
        const mask = obj.get('SMask'); if (mask.isIndirect()) masks.add(mask.asIndirect());
        if (obj.get('Subtype').isName() && obj.get('Subtype').asName() === 'Image') images.push(i);
      } finally { obj.destroy(); }
    }
    if (highQuality) for (let i = 0; i < images.length; i++) {
      if (!masks.has(images[i])) {
        const image = doc.newIndirect(images[i]);
        try { await optimizeImage(doc, image); }
        finally { image.destroy(); }
      }
      progress(.1 + .7 * (i + 1) / images.length);
    }
    // Keep complete fonts in editable documents, including glyphs for future edits.
    if (doc.getTrailer().get('Root', 'AcroForm').isNull()) doc.subsetFonts();
    progress(.85);
    const buffer = doc.saveToBuffer(options); let bytes: Uint8Array;
    try { bytes = buffer.asUint8Array().slice(); } finally { buffer.destroy(); }
    if (bytes.length >= input.length) { progress(1); return input; }
    const output = mupdf.Document.openDocument(bytes, 'application/pdf').asPDF()!;
    try { if (snapshot(output) !== before) { progress(1); return input; } } finally { output.destroy(); }
    progress(1); return bytes;
  } finally { doc.destroy(); }
}
