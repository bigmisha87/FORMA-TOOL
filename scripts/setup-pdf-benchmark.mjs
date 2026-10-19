import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('tmp/pdf-research');mkdirSync(root,{recursive:true});
const optimizerCommit='bcca8aefc5e1b710b54e1047fbc9ddfdb0f4b29e';
const qpdfCommit='f79ba536a7520d38bb5b19fc918f85f5a19ce3d8';
const pdfjsCommit='98cfa3ec8781575f3aa9c698a53598dd498b4fb5';
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit',windowsHide:true});
// Invoke npm's Node CLI directly on Windows so paths with spaces stay literal.
const npmCli=resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const install=args=>process.platform==='win32'?run(process.execPath,[npmCli,...args]):run('npm',args);
writeFileSync(`${root}/package.json`,JSON.stringify({private:true,type:'module',dependencies:{mupdf:'1.28.1'}},null,2));
install(['install','--prefix',root]);
const repo=`${root}/pdf-optimizer`;
if(!existsSync(repo))run('git',['clone','https://github.com/mattdesl/pdf-optimizer.git',repo]);
run('git',['-C',repo,'checkout',optimizerCommit]);
install(['ci','--prefix',repo]);
const downloads=[
  [`https://raw.githubusercontent.com/le0pard/qpdf-wasm/${qpdfCommit}/src/lib/vendors/qpdf.js`,'qpdf.mjs'],
  [`https://raw.githubusercontent.com/le0pard/qpdf-wasm/${qpdfCommit}/src/lib/vendors/qpdf.wasm`,'qpdf.wasm'],
  [`https://raw.githubusercontent.com/mozilla/pdf.js/${pdfjsCommit}/test/pdfs/tracemonkey.pdf`,'input/tracemonkey.pdf'],
];
mkdirSync(`${root}/input`,{recursive:true});const assets=[];
for(const [url,path]of downloads){const response=await fetch(url);if(!response.ok)throw new Error(`${response.status}: ${url}`);const bytes=Buffer.from(await response.arrayBuffer());writeFileSync(`${root}/${path}`,bytes);assets.push({url,path,sha256:createHash('sha256').update(bytes).digest('hex')});}
writeFileSync(`${root}/provenance.json`,JSON.stringify({optimizerCommit,qpdfCommit,pdfjsCommit,assets},null,2)+'\n');
console.log('Research dependencies are isolated under tmp/pdf-research; production dependencies are untouched.');
