// Research benchmark only: the production application is not modified.
import { readFileSync,writeFileSync,mkdirSync,readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
import {chromium} from '@playwright/test';
import * as mupdf from '../tmp/pdf-research/node_modules/mupdf/dist/mupdf.js';
import createQpdf from '../tmp/pdf-research/qpdf.mjs';
import { optimize } from '../tmp/pdf-research/pdf-optimizer/src/index.js';

const ROOT='tmp/pdf-research';
const OUT=`${ROOT}/output`;mkdirSync(OUT,{recursive:true});
const qpdf=await createQpdf({wasmBinary:readFileSync(`${ROOT}/qpdf.wasm`)});
const base='http://127.0.0.1:5178/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5178','--strictPort'],{stdio:'pipe',windowsHide:true});
let exited=false;server.on('exit',()=>{exited=true;});
let browser;
const rows=[];
const hybridOnly=process.argv.includes('--hybrid-only');
const refine=process.argv.includes('--refine')||hybridOnly;
const previous=refine?JSON.parse(readFileSync(`${ROOT}/sizes.json`,'utf8')):[];
try {
  let ready=false;for(let i=0;i<75;i++) {if(exited)throw new Error('Benchmark server exited.');try{if((await fetch(base)).ok){ready=true;break;}}catch{}await setTimeout(200);}
  if(!ready)throw new Error('Benchmark server not ready');
  browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();await page.goto(base);
  for(const name of readdirSync(`${ROOT}/input`).filter(n=>n.endsWith('.pdf')).sort()) {
    const input=readFileSync(`${ROOT}/input/${name}`);const row=refine?previous.find(r=>r.name===name.slice(0,-4)):{name:name.slice(0,-4),originalBytes:input.length,engines:{}};
    const baseline=refine?{}:await page.evaluate(async data=>{
      const {loadPdf,compressPdf}=await import('/tests/pdf-benchmark/baseline.ts');
      const file=new File([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],'input.pdf',{type:'application/pdf'});const source=await loadPdf(file);
      const outputs={};
      try {for(const [name,strong] of [['current-gentle',false],['current-strong',true]]) {
        const start=performance.now();const result=await compressPdf(source,strong,120,()=>{});const bytes=new Uint8Array(await result.arrayBuffer());let s='';for(const b of bytes)s+=String.fromCharCode(b);
        outputs[name]={data:btoa(s),bytes:bytes.length,ms:Math.round(performance.now()-start),keptOriginal:result===file};
      }}finally{await source.close();}return outputs;
    },input.toString('base64'));
    for(const [engine,{data,...meta}]of Object.entries(baseline)) {writeFileSync(`${OUT}/${row.name}-${engine}.pdf`,Buffer.from(data,'base64'));row.engines[engine]=meta;}
    const record=(engine,bytes,start,extra={})=>{
      const size=bytes.length,keptOriginal=size>=input.length;
      writeFileSync(`${OUT}/${row.name}-${engine}.pdf`,keptOriginal?input:bytes);
      row.engines[engine]={bytes:keptOriginal?input.length:size,rawBytes:size,keptOriginal,ms:Math.round(performance.now()-start),...extra};
    };
    const hybrid=()=>{
      const start=performance.now();const high=readFileSync(`${OUT}/${row.name}-image-selective-high.pdf`);const d=mupdf.PDFDocument.openDocument(high,'application/pdf');
      try {d.subsetFonts();const b=d.saveToBuffer('garbage=4,compress=yes,compress-images=yes,compress-fonts=yes,objstms=yes');record('hybrid-high',b.asUint8Array(),start,{precedingImageMs:row.engines['image-selective-high'].ms});b.destroy();}finally{d.destroy();}
    };
    if(hybridOnly){hybrid();rows.push(row);console.log(row.name,row.engines['hybrid-high']);continue;}
    for(const [engine,extra]of refine?[]:[['qpdf-lossless',[]],['qpdf-images',['--optimize-images','--jpeg-quality=85']]]) {
      const start=performance.now();qpdf.FS.writeFile('/input.pdf',input);
      const status=qpdf.callMain(['/input.pdf','--object-streams=generate','--compress-streams=y','--recompress-flate','--compression-level=9',...extra,'/output.pdf']);
      if(status!==0&&status!==3)throw new Error(`QPDF exit ${status}`);
      record(engine,qpdf.FS.readFile('/output.pdf'),start);qpdf.FS.unlink('/input.pdf');qpdf.FS.unlink('/output.pdf');
    }
    let start=performance.now();const doc=mupdf.PDFDocument.openDocument(input,'application/pdf');
    try {doc.subsetFonts();const bytes=doc.saveToBuffer('garbage=4,compress=yes,compress-images=yes,compress-fonts=yes,objstms=yes');record('mupdf-lossless',bytes.asUint8Array(),start);bytes.destroy();} finally {doc.destroy();}
    for(const quality of refine?[97]:[85,97]) {
      start=performance.now();const result=await optimize(input,{quality,subsampling:'4:4:4',dpi:0,blankOffPage:false});record(quality===97?'image-selective-high':'image-selective',result.bytes,start,{imageStats:result.stats});
    }
    hybrid();
    rows.push(row);console.log(JSON.stringify(row));
  }
  writeFileSync(`${ROOT}/sizes.json`,JSON.stringify(rows,null,2)+'\n');
} finally {await browser?.close();server.kill();}
