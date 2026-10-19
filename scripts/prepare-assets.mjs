import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import gifsicle from 'gifsicle-wasm-browser';
import { createHash } from 'node:crypto';
for (const [name,version] of [['mupdf','1.28.1'],['@jsquash/jpeg','1.6.0'],['@jsquash/oxipng','2.3.0'],['gifsicle-wasm-browser','1.5.19']]) {
  if (JSON.parse(readFileSync(resolve('node_modules',name,'package.json'),'utf8')).version !== version) throw new Error(`Update matching source archives before changing ${name}.`);
}
if (createHash('sha256').update(readFileSync('third_party/mupdf/mupdf-1.28.1-source.tar.gz')).digest('hex') !== 'dc94c60b2537e2ac9a2d379dd3801545f84a3a302d15c9da358362a1270707c3') throw new Error('MuPDF source archive checksum mismatch');
mkdirSync('public/codecs', { recursive: true });
cpSync('node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm', 'public/codecs/mozjpeg_enc.wasm');
cpSync('node_modules/@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm', 'public/codecs/oxipng_bg.wasm');
cpSync('node_modules/mupdf/dist/mupdf-wasm.wasm', 'public/codecs/mupdf-wasm.wasm');
writeFileSync('public/codecs/gifsicle.worker.js', '/* Gifsicle 1.92: GPL-2.0-or-later. Browser wrapper: MIT. See THIRD_PARTY_NOTICES.md and third_party/gifsicle/. */\n' + gifsicle.tool.workerLocalUrl);
mkdirSync('public/pdfjs', { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) cpSync(resolve('node_modules/pdfjs-dist', folder), resolve('public/pdfjs', folder), { recursive: true });
const packages = ['react','react-dom','scheduler','lucide-react','pdf-lib','@pdf-lib/standard-fonts','@pdf-lib/upng','pdfjs-dist','pako','gifuct-js','js-binary-schema-parser','gifenc','fflate','@fontsource/heebo','tslib','@jsquash/jpeg','@jsquash/oxipng','gifsicle-wasm-browser','mupdf'];
let licenses = '# Third-party notices\n\nFORMA uses the following open-source packages. Library authors retain their copyrights.\n\n';
for (const name of packages) {
  const dir = resolve('node_modules', name);
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  licenses += `## ${name} ${pkg.version}\n\nLicense: ${pkg.license}\n\n`;
  const file = readdirSync(dir).find(f => /^(licen[cs]e|ofl)(\.|$)/i.test(f));
  if (file) licenses += '```text\n' + readFileSync(resolve(dir, file), 'utf8') + '\n```\n\n';
}
for (const name of ['@jsquash/jpeg','@jsquash/oxipng']) {
  licenses += `## ${name} native codec license\n\n` + readFileSync(resolve('node_modules',name,'codec/LICENSE.codec.md'),'utf8') + '\n\n';
}
licenses += '## Gifsicle engine (GPL-2.0-or-later)\n\n' + readFileSync('third_party/gifsicle/README.md','utf8') + '\n\n```text\n' + readFileSync('third_party/gifsicle/COPYING','utf8') + '\n```\n\n';
licenses += '## MozJPEG / IJG\n\nThis software is based in part on the work of the Independent JPEG Group.\n\n' + readFileSync('third_party/README.ijg','utf8') + '\n';
writeFileSync('THIRD_PARTY_NOTICES.md', licenses.trimEnd() + '\n');
cpSync('third_party','public/third_party',{recursive:true});
cpSync('THIRD_PARTY_NOTICES.md','public/THIRD_PARTY_NOTICES.md');
cpSync('LICENSE','public/LICENSE.txt');
