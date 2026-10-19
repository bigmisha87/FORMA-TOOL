// Network-accessible corresponding source for the AGPL application.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,statSync,mkdirSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const files={};
for(const path of paths) {
  if(path.startsWith('public/')||/\.(zip|tar\.gz|tar\.lz)$/.test(path))continue;
  if(statSync(path).isFile())files[path]=new Uint8Array(readFileSync(path));
}
files['SOURCE_ARCHIVES.txt']=strToU8('FORMA application source and build instructions are included. Native codec source archives are distributed separately at the same website under third_party/gifsicle/ and third_party/mupdf/. See their README.md files and THIRD_PARTY_NOTICES.md. Complete repository: https://github.com/bigmisha87/FORMA-TOOL\n');
mkdirSync('public',{recursive:true});writeFileSync('public/forma-source.zip',zipSync(files,{level:6}));
