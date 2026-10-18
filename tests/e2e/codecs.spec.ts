import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
import { parseGIF,decompressFrames } from 'gifuct-js';
import { buffer } from './helpers';

function arrayBuffer(bytes:Uint8Array) {return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;}
function pngPixels(bytes:Uint8Array) {return PNG.sync.read(Buffer.from(bytes)).data;}
function animation(bytes:Uint8Array) {
  const parsed=parseGIF(arrayBuffer(bytes)), frames=decompressFrames(parsed,true);
  const w=parsed.lsd.width,h=parsed.lsd.height;let screen=new Uint8Array(w*h*4),restore=screen.slice();
  const timeline:string[]=[];
  for(const f of frames) {
    if(f.disposalType===3)restore=screen.slice();
    for(let y=0;y<f.dims.height;y++)for(let x=0;x<f.dims.width;x++) {
      const s=(y*f.dims.width+x)*4,d=((f.dims.top+y)*w+f.dims.left+x)*4;
      if(f.patch[s+3])screen.set(f.patch.subarray(s,s+4),d);
    }
    // Transparent RGB is irrelevant to display. Compare all composited frame RGBA.
    timeline.push(`${f.delay}:${Buffer.from(screen).toString('base64')}`);
    if(f.disposalType===2)for(let y=0;y<f.dims.height;y++)screen.fill(0,((f.dims.top+y)*w+f.dims.left)*4,((f.dims.top+y)*w+f.dims.left+f.dims.width)*4);
    if(f.disposalType===3)screen=restore.slice();
  }
  const b=Buffer.from(bytes),marker=b.indexOf('NETSCAPE2.0');return {w,h,timeline,loop:marker<0?-1:b.readUInt16LE(marker+13)};
}

test.beforeEach(async({page})=>{await page.goto('/');});
for(const name of ['logo','gradient-alpha'])test(`Oxipng preserves every raw RGBA value: ${name}`,async({page})=>{
  const input=readFileSync(`tests/benchmark/fixtures/${name}.png`);
  await expect(page.locator('#colors')).toHaveValue('0');
  await page.getByTestId('image-upload').setInputFiles({name:`${name}.png`,mimeType:'image/png',buffer:input});
  await page.getByRole('button',{name:'הקטנת משקל',exact:true}).click();
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:`הורדה ${name}.png`,exact:true}).click();const output=await buffer(await waiting);
  expect(output.length).toBeLessThan(input.length);expect(Buffer.from(pngPixels(output))).toEqual(Buffer.from(pngPixels(input)));
});

for(const disposal of [1,2,3])test(`Gifsicle preserves displayed frames, delay and finite loop, disposal ${disposal}`,async({page})=>{
  const gif=gifenc.GIFEncoder(),palette=[[0,0,0],[242,198,43],[255,255,255],[0,100,200]];
  for(let i=0;i<8;i++) {
    const pixels=new Uint8Array(240*160).fill(0);
    for(let y=40;y<90;y++)for(let x=10+i*22;x<40+i*22;x++)pixels[y*240+x]=1;
    gif.writeFrame(pixels,240,160,{palette,delay:80+i*20,repeat:2,dispose:disposal,transparent:true,transparentIndex:0});
  }
  gif.finish();const input=Buffer.from(gif.bytes());
  await page.getByTestId('image-upload').setInputFiles({name:'timeline.gif',mimeType:'image/gif',buffer:input});await page.getByRole('button',{name:'הקטנת משקל',exact:true}).click();
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'הורדה timeline.gif',exact:true}).click();const output=await buffer(await waiting);
  expect(output.length).toBeLessThan(input.length);expect(animation(output)).toEqual(animation(input));
});

test('codec download failure shows an error without producing a result',async({page})=>{
  await page.route('**/codecs/oxipng_bg.wasm',route=>route.abort());
  await page.getByTestId('image-upload').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:readFileSync('tests/benchmark/fixtures/logo.png')});
  await page.getByRole('button',{name:'הקטנת משקל',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'הורדה logo.png',exact:true})).toHaveCount(0);await expect(page.getByText('logo.png',{exact:true})).toBeVisible();
});

test('optional palette reduction still produces a valid, smaller PNG',async({page})=>{
  const input=readFileSync('tests/benchmark/fixtures/gradient-alpha.png');
  await page.locator('#colors').selectOption('64');await page.getByTestId('image-upload').setInputFiles({name:'palette.png',mimeType:'image/png',buffer:input});
  await page.getByRole('button',{name:'הקטנת משקל',exact:true}).click();const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'הורדה palette.png',exact:true}).click();const output=await buffer(await waiting);
  const decoded=PNG.sync.read(output);expect(decoded.width).toBe(640);expect(decoded.height).toBe(420);expect(output.length).toBeLessThan(input.length);expect(decoded.data[3]).toBeLessThan(255);
  // Palette reduction is intentionally lossy, including partial alpha.
  const colors=new Set<string>();for(let i=0;i<decoded.data.length;i+=4)colors.add(decoded.data.subarray(i,i+4).toString('hex'));expect(colors.size).toBeLessThanOrEqual(64);
});
