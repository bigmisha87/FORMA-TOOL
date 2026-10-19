// Browser feasibility, isolated from the production app and its dependencies.
import {createServer} from 'vite';
import {readFileSync,writeFileSync,mkdirSync,existsSync,createReadStream} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,firefox,webkit} from '@playwright/test';
const root=resolve('.'),folder='tmp/pdf-research';mkdirSync(`${folder}/browser-output`,{recursive:true});
writeFileSync(`${folder}/benchmark.html`,'<!doctype html><link rel="icon" href="data:,"><title>Local PDF engine research</title>');
const server=await createServer({configFile:false,root,server:{host:'127.0.0.1',port:5179,strictPort:true},optimizeDeps:{exclude:['mupdf','@jsquash/jpeg','@jsquash/resize']},worker:{format:'es'},plugins:[{name:'research-wasm',configureServer(s){s.middlewares.use((req,res,next)=>{
  const url=(req.url||'').split('?')[0];if(!url.endsWith('.wasm'))return next();
  const path=resolve(root,'.'+decodeURIComponent(url));if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))return next();
  if(!existsSync(path))return next();res.setHeader('Content-Type','application/wasm');createReadStream(path).pipe(res);
});}}]});
await server.listen();const results=[];
try {
  for(const [name,driver,opts]of [['chrome',chromium,{channel:'chrome'}],['firefox',firefox,{}],['webkit',webkit,{}]]) {
    const browser=await driver.launch(opts);
    try {
      const page=await browser.newPage();page.on('console',m=>{if(m.type()==='error')console.error(name,m.text());});
      await page.goto('http://127.0.0.1:5179/tmp/pdf-research/benchmark.html');
      for(const fixture of ['photo-flate','hebrew-form']) {
        const data=readFileSync(`${folder}/input/${fixture}.pdf`).toString('base64');
        for(const engine of ['qpdf','mupdf','selective','selective-high','hybrid']) {
          try {
            const result=await page.evaluate(async({data,engine})=>{
              const input=Uint8Array.from(atob(data),c=>c.charCodeAt(0));let bytes;const start=performance.now();
              if(engine==='qpdf') {
                const {default:create}=await import('/tmp/pdf-research/qpdf.mjs');const q=await create({locateFile:()=>'/tmp/pdf-research/qpdf.wasm'});
                q.FS.writeFile('/in.pdf',input);const status=q.callMain(['/in.pdf','--object-streams=generate','--recompress-flate','--compression-level=9','/out.pdf']);if(status!==0)throw new Error(`qpdf ${status}`);bytes=q.FS.readFile('/out.pdf');
              } else if(engine==='mupdf') {
                const m=await import('/tmp/pdf-research/node_modules/mupdf/dist/mupdf.js');const d=m.PDFDocument.openDocument(input,'application/pdf');d.subsetFonts();const b=d.saveToBuffer('garbage=4,compress=yes,compress-images=yes,compress-fonts=yes,objstms=yes');bytes=b.asUint8Array().slice();b.destroy();d.destroy();
              } else {
                const {optimize}=await import('/tmp/pdf-research/pdf-optimizer/src/browser.js');const result=await optimize(input,{quality:engine==='selective'?85:97,subsampling:'4:4:4',dpi:0,blankOffPage:false});bytes=result.bytes.slice();
                if(engine==='hybrid') {
                  const m=await import('/tmp/pdf-research/node_modules/mupdf/dist/mupdf.js');const d=m.PDFDocument.openDocument(bytes,'application/pdf');d.subsetFonts();const b=d.saveToBuffer('garbage=4,compress=yes,compress-images=yes,compress-fonts=yes,objstms=yes');bytes=b.asUint8Array().slice();b.destroy();d.destroy();
                }
              }
              const {loadPdf}=await import('/src/lib/pdf.ts');
              const text=async(data)=>{const pdf=await loadPdf(new File([data],'test.pdf',{type:'application/pdf'}));const pages=[];try{for(let i=1;i<=pdf.preview.numPages;i++){const p=await pdf.preview.getPage(i);pages.push((await p.getTextContent()).items.map(x=>'str' in x?x.str:'').join('').replace(/\s/g,''));}return pages;}finally{await pdf.close();}};
              const sourceText=await text(input),resultText=await text(bytes);const textExact=JSON.stringify(sourceText)===JSON.stringify(resultText);if(!textExact)throw new Error('Selectable PDF.js text changed');
              let s='';for(const b of bytes)s+=String.fromCharCode(b);return {data:btoa(s),bytes:bytes.length,ms:Math.round(performance.now()-start),pdfjsTextExact:textExact,textCharacters:resultText.join('').length};
            },{data,engine});
            const {data:out,...metrics}=result;writeFileSync(`${folder}/browser-output/${fixture}-${engine}-${name}.pdf`,Buffer.from(out,'base64'));results.push({browser:name,fixture,engine,...metrics});console.log(results.at(-1));
          } catch(e) {results.push({browser:name,fixture,engine,error:String(e).slice(0,300)});console.error(results.at(-1));}
        }
      }
    } finally {await browser.close();}
  }
}finally{await server.close();writeFileSync('docs/pdf-candidate-browsers.json',JSON.stringify(results,null,2)+'\n');}
