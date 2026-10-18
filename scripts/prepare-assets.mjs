import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('public/pdfjs', { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) cpSync(resolve('node_modules/pdfjs-dist', folder), resolve('public/pdfjs', folder), { recursive: true });
const packages = ['react','react-dom','scheduler','lucide-react','pdf-lib','@pdf-lib/standard-fonts','@pdf-lib/upng','pdfjs-dist','pako','gifuct-js','js-binary-schema-parser','gifenc','fflate','@fontsource/heebo','tslib'];
let licenses = '# Third-party notices\n\nFORMA uses the following open-source packages. Library authors retain their copyrights.\n\n';
for (const name of packages) {
  const dir = resolve('node_modules', name);
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  licenses += `## ${name} ${pkg.version}\n\nLicense: ${pkg.license}\n\n`;
  const file = readdirSync(dir).find(f => /^(licen[cs]e|ofl)(\.|$)/i.test(f));
  if (file) licenses += '```text\n' + readFileSync(resolve(dir, file), 'utf8') + '\n```\n\n';
}
writeFileSync('THIRD_PARTY_NOTICES.md', licenses.trimEnd() + '\n');
