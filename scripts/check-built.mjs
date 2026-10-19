import { chromium } from '@playwright/test';
import { PDFDocument, PDFName, PDFDict, rgb } from 'pdf-lib';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import gifenc from 'gifenc';
import {parseGIF,decompressFrames} from 'gifuct-js';
import {unzipSync} from 'fflate';

const url = process.env.BUILT_URL || 'http://127.0.0.1:4186/FORMA-TOOL/';
const browser = await chromium.launch({ channel:'chrome' });
const context = await browser.newContext({ viewport:{ width:1440,height:1050 } });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const errors = [], failedRequests = [];
page.on('pageerror',error => errors.push(error.message));
page.on('response',response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });
let workerStarted = false; page.on('worker',() => { workerStarted=true; });
try {
  await page.goto(url); await page.evaluate(() => document.fonts.ready);
  console.log('Production page loaded');
  mkdirSync('docs',{recursive:true});
  await page.screenshot({path:'docs/preview.png',fullPage:true});
  const image = await page.evaluate(() => {
    const c=document.createElement('canvas');c.width=240;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#315d45';ctx.fillRect(0,0,240,160);return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button',{name:'שינוי מידות הגודל הנכון לכל מקום'}).click();
  await page.getByTestId('image-upload').setInputFiles({name:'production.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await page.locator('#width').fill('120');await page.locator('#height').fill('80');await page.getByRole('button',{name:'שינוי מידות',exact:true}).click();
  await page.getByRole('button',{name:'הורדה production.png',exact:true}).waitFor();assert.equal(workerStarted,true);
  console.log('Image worker passed');
  // Exercise every WASM codec from the compiled GitHub Pages subpath.
  const jpeg=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=640;c.height=420;const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,640,420);g.addColorStop(0,'#f2c62b');g.addColorStop(1,'#151515');ctx.fillStyle=g;ctx.fillRect(0,0,640,420);
    ctx.fillStyle='white';ctx.font='32px sans-serif';ctx.fillText('FORMA production test',30,100);return c.toDataURL('image/jpeg',.96).split(',')[1];
  });
  const gif=gifenc.GIFEncoder();for(let i=0;i<3;i++)gif.writeFrame(new Uint8Array(80*60).fill(i),80,60,{palette:[[255,0,0],[0,255,0],[0,0,255]],delay:[80,120,200][i],repeat:2,dispose:2});gif.finish();
  for(const [ext,input] of [['jpg',Buffer.from(jpeg,'base64')],['gif',Buffer.from(gif.bytes())]]) {
    await page.goto(url);
    await page.getByTestId('image-upload').setInputFiles({name:`codec.${ext}`,mimeType:`image/${ext==='jpg'?'jpeg':'gif'}`,buffer:input});
    await page.getByRole('button',{name:'הקטנת משקל',exact:true}).click();
    const waiting=page.waitForEvent('download');await page.getByRole('button',{name:`הורדה codec.${ext}`,exact:true}).click();
    const stream=await (await waiting).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const output=Buffer.concat(chunks);
    assert.ok(output.length<=input.length);
    if(ext==='jpg') {assert.equal(output[0],255);assert.equal(output[1],216);assert.ok(output.length<=input.length*.6);}
    else {const frames=decompressFrames(parseGIF(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength)),true);assert.equal(frames.length,3);assert.deepEqual(frames.map(f=>f.delay),[80,120,200]);}
    console.log(`${ext} compiled codec passed: ${input.length} -> ${output.length} bytes`);
  }
  await page.getByRole('button',{name:'כלי PDF',exact:true}).click();
  const fixture=await PDFDocument.create();fixture.addPage([400,600]).drawRectangle({x:20,y:20,width:360,height:560,color:rgb(.3,.6,.4)});fixture.addPage([500,600]);
  await page.getByTestId('pdf-upload').setInputFiles({name:'production.pdf',mimeType:'application/pdf',buffer:Buffer.from(await fixture.save())});
  await page.getByRole('button',{name:'סיבוב 90° 1',exact:true}).click();await page.getByRole('button',{name:'סידור ואיחוד',exact:true}).click();
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'הורדה',exact:true}).click();const stream=await (await waiting).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const output=await PDFDocument.load(Buffer.concat(chunks));
  assert.equal(output.getPageCount(),2);assert.equal(output.getPage(0).getRotation().angle,90);assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
  // A compiled MuPDF worker must actually compress while preserving native text.
  await page.getByRole('button',{name:'ניקוי הכל',exact:true}).click();
  await page.getByRole('button',{name:'הקטנת PDF פחות משקל, יותר נוח לשלוח'}).click();
  const photo=readFileSync('tests/pdf-benchmark/fixtures/photo-flate.pdf');
  await page.getByTestId('pdf-upload').setInputFiles({name:'preserve.pdf',mimeType:'application/pdf',buffer:photo});
  await page.getByRole('button',{name:'הקטנת PDF',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'הורדה',exact:true}).click();
  const pdfStream=await (await download).createReadStream();const pdfChunks=[];for await(const chunk of pdfStream)pdfChunks.push(chunk);const compressed=Buffer.concat(pdfChunks);
  assert.ok(compressed.length<photo.length*.4);
  await page.screenshot({path:'docs/pdf-compression-preview.png',fullPage:true});
  const compressedDoc=await PDFDocument.load(compressed);assert.equal(compressedDoc.getPageCount(),2);
  const fonts=compressedDoc.getPage(0).node.Resources().lookup(PDFName.of('Font'),PDFDict);assert.ok(fonts.keys().length>0);
  writeFileSync('tmp/pdf-built-output.pdf',compressed);
  // Reopen the real output with the production viewer as well.
  await page.getByRole('button',{name:'ניקוי הכל',exact:true}).click();
  await page.getByTestId('pdf-upload').setInputFiles({name:'reopen.pdf',mimeType:'application/pdf',buffer:compressed});
  await page.getByText('reopen.pdf',{exact:true}).waitFor();
  console.log(`MuPDF + MozJPEG compiled worker passed: ${photo.length} -> ${compressed.length} bytes`);
  const source=await context.request.get(new URL('forma-source.zip',url).href);assert.equal(source.status(),200);
  const entries=unzipSync(await source.body());assert.ok(entries['src/lib/pdf-compress.ts']);assert.ok(entries['src/lib/pdf-compress.worker.ts']);assert.ok(entries['LICENSE']);assert.ok(entries['package-lock.json']);
  const license=await context.request.get(new URL('LICENSE.txt',url).href);assert.ok((await license.text()).includes('GNU AFFERO GENERAL PUBLIC LICENSE'));
  const nativeSource=await context.request.head(new URL('third_party/mupdf/mupdf-1.28.1-source.tar.gz',url).href);assert.equal(nativeSource.status(),200);
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
  const result={url,passed:true,imageWorker:true,codecs:['MozJPEG','Oxipng','Gifsicle','MuPDF'],pdfWorker:true,textPreservingCompression:true,sourceAndLicense:true,pages:output.getPageCount(),runtimeErrors:errors,failedRequests};
  mkdirSync('tmp',{recursive:true});writeFileSync('tmp/production-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }
