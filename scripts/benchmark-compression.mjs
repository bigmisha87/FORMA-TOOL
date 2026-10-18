import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import gifenc from 'gifenc';

// All inputs are local and deterministic. No uploads or external benchmark service.
mkdirSync('tmp/compression', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(process.env.BENCHMARK_URL || 'http://127.0.0.1:5176/');
const cases = [];
for (const name of ['photo','bird','landscape','monkey','astronaut']) cases.push({name, type:'jpeg', bytes:readFileSync(`tests/benchmark/fixtures/${name}.png`).toString('base64')});
for (const name of ['logo','gradient-alpha','astronaut','logo-optimized']) cases.push({name,type:'png',bytes:readFileSync(`tests/benchmark/fixtures/${name}.png`).toString('base64')});
for (const disposal of [1,2,3]) {
  const gif=gifenc.GIFEncoder(); const palette=[[0,0,0],[242,198,43],[255,255,255],[0,100,200]];
  for(let i=0;i<8;i++) {
    const pixels=new Uint8Array(240*160).fill(disposal===1?2:0);
    for(let y=40;y<90;y++) for(let x=10+i*22;x<40+i*22;x++) pixels[y*240+x]=1;
    gif.writeFrame(pixels,240,160,{palette,delay:80+i*20,repeat:2,dispose:disposal,transparent:disposal!==1,transparentIndex:0});
  }
  gif.finish();cases.push({name:`animation-disposal-${disposal}`,type:'gif',bytes:Buffer.from(gif.bytes()).toString('base64')});
}
const rows=[];
try {
for(const fixture of cases) {
  const result=await page.evaluate(async fixture=>{
    const modern=await import('/src/lib/image.ts'); const legacy=await import('/tests/benchmark/image-legacy.ts');
    let file=new File([Uint8Array.from(atob(fixture.bytes),c=>c.charCodeAt(0))],`${fixture.name}.${fixture.type}`,{type:`image/${fixture.type}`});
    if(fixture.type==='jpeg') {
      const bitmap=await createImageBitmap(file);const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
      file=new File([await new Promise(r=>c.toBlob(r,'image/jpeg',.96))],file.name,{type:'image/jpeg'});
    }
    const base64=async blob=>{const data=new Uint8Array(await blob.arrayBuffer());let s='';for(const b of data)s+=String.fromCharCode(b);return btoa(s);};
    const outputs={original:await base64(file)};
    for(const [name,engine,colors] of [['old-default',legacy,128],['old-lossless',legacy,0],['new',modern,0]]) {
      // gifenc cannot encode a zero-color palette: 256 is the old engine's best available mode.
      const settings={...engine.defaultImageSettings,colors:fixture.type==='gif'&&colors===0&&engine===legacy?256:colors};
      const start=performance.now();const out=await engine.processImage(file,settings);
      outputs[name]={bytes:out.blob.size,width:out.width,height:out.height,ms:Math.round(performance.now()-start),data:await base64(out.blob),keptOriginal:out.keptOriginal};
    }
    return outputs;
  },fixture);
  writeFileSync(`tmp/compression/${fixture.name}-original.${fixture.type}`,Buffer.from(result.original,'base64'));
  const row={name:fixture.name,type:fixture.type,originalBytes:Buffer.from(result.original,'base64').length};
  for(const name of ['old-default','old-lossless','new']) {const {data,...metrics}=result[name];writeFileSync(`tmp/compression/${fixture.name}-${name}.${fixture.type}`,Buffer.from(data,'base64'));row[name]=metrics;}
  rows.push(row);console.log(JSON.stringify(row));
}
writeFileSync('tmp/compression/sizes.json',JSON.stringify(rows,null,2));
} finally {await browser.close();}

