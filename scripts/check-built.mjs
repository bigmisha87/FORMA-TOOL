import { chromium } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

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
  await page.locator('#width').fill('120');await page.locator('#height').fill('80');await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();
  await page.getByRole('button',{name:'הורדה production.png',exact:true}).waitFor();assert.equal(workerStarted,true);
  console.log('Image worker passed');
  await page.getByRole('button',{name:'כלי PDF',exact:true}).click();
  const fixture=await PDFDocument.create();fixture.addPage([400,600]).drawRectangle({x:20,y:20,width:360,height:560,color:rgb(.3,.6,.4)});fixture.addPage([500,600]);
  await page.getByTestId('pdf-upload').setInputFiles({name:'production.pdf',mimeType:'application/pdf',buffer:Buffer.from(await fixture.save())});
  await page.getByRole('button',{name:'סיבוב 90° 1',exact:true}).click();await page.getByRole('button',{name:'הכנת PDF להורדה',exact:true}).click();
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'הורדה',exact:true}).click();const stream=await (await waiting).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const output=await PDFDocument.load(Buffer.concat(chunks));
  assert.equal(output.getPageCount(),2);assert.equal(output.getPage(0).getRotation().angle,90);assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
  const result={url,passed:true,imageWorker:true,pdfWorker:true,pages:output.getPageCount(),runtimeErrors:errors,failedRequests};
  mkdirSync('tmp',{recursive:true});writeFileSync('tmp/production-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }
