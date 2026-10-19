// SPDX-License-Identifier: AGPL-3.0-or-later
import { configureCodecs } from './codecs';
import { compressPreservingPdf } from './pdf-compress';
self.onmessage = async ({ data }: MessageEvent<{ bytes: Uint8Array; highQuality: boolean; baseURL: string }>) => {
  try {
    configureCodecs(data.baseURL);
    Object.assign(globalThis, { $libmupdf_wasm_Module: { locateFile: () => new URL('codecs/mupdf-wasm.wasm', data.baseURL).href } });
    const mupdf = await import('mupdf');
    const bytes = await compressPreservingPdf(mupdf, data.bytes, data.highQuality, progress => self.postMessage({ progress }));
    self.postMessage({ bytes }, { transfer: [bytes.buffer as ArrayBuffer] });
  } catch (error) { self.postMessage({ error: error instanceof Error && error.message === 'signedPdf' ? 'signedPdf' : 'pdfCompressionError' }); }
};
