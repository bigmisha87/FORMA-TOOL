import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import { decompressFrames,parseGIF } from 'gifuct-js';
import { buffer,decode,gifFile,imageFile } from './helpers';

test.beforeEach(async ({page})=>{ await page.goto('/'); });
test('JPEG meets a maximum byte target and downloads a valid image', async ({page})=>{
  const input=await imageFile(page); await page.getByTestId('image-upload').setInputFiles(input);
  await expect(page.getByText('photo.jpg',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'משקל מקסימלי',exact:true}).click(); await page.locator('#target').fill('20');
  await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();
  await expect(page.getByText('הקבצים מוכנים להורדה',{exact:true})).toBeVisible();
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'הורדה photo.jpg',exact:true}).click();const output=await buffer(await dl);
  expect(output.length).toBeLessThanOrEqual(20*1024);expect(output[0]).toBe(255);expect(output[1]).toBe(216);
  const info=await decode(page,output);expect(info.width).toBeGreaterThan(0);expect(info.width/info.height).toBeCloseTo(1.5,1);
});
test('recommended JPEG compression reduces actual bytes by at least the chosen percentage',async({page})=>{
  const input=await imageFile(page);await page.getByTestId('image-upload').setInputFiles(input);await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();
  const button=page.getByRole('button',{name:'הורדה photo.jpg',exact:true});await expect(button).toBeVisible();const dl=page.waitForEvent('download');await button.click();const out=await buffer(await dl);expect(out.length).toBeLessThanOrEqual(input.buffer.length*.6);
});
test('batch resizing preserves portrait and landscape proportions and ZIP names are unique',async({page})=>{
  await page.getByRole('button',{name:'שינוי מידות הגודל הנכון לכל מקום'}).click();
  const a=await imageFile(page,'campaign.png',800,400,true),b=await imageFile(page,'campaign.png',400,800,true);
  await page.getByTestId('image-upload').setInputFiles([a,b]);await page.locator('#width').fill('320');await page.locator('#height').fill('320');
  await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();await expect(page.getByRole('button',{name:'הורדת כל התוצאות ב־ZIP',exact:true})).toBeVisible();
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'הורדת כל התוצאות ב־ZIP',exact:true}).click();const zip=unzipSync(await buffer(await dl));
  expect(Object.keys(zip)).toHaveLength(2);const decoded=await Promise.all(Object.values(zip).map(data=>decode(page,Buffer.from(data))));
  expect(decoded.map(({width,height})=>[width,height])).toEqual([[320,160],[160,320]]);expect(decoded.every(i=>i.corner[3]===0)).toBeTruthy();
});
test('single selection changes only one file; unlocked dimensions can make a square',async({page})=>{
  await page.getByRole('button',{name:'שינוי מידות הגודל הנכון לכל מקום'}).click();
  await page.getByTestId('image-upload').setInputFiles([await imageFile(page,'one.jpg',600,400),await imageFile(page,'two.jpg',400,600)]);
  await page.getByRole('checkbox',{name:'two.jpg',exact:true}).uncheck();await page.getByRole('checkbox',{name:'שמירה על פרופורציות',exact:true}).uncheck();await page.locator('#width').fill('200');await page.locator('#height').fill('200');
  await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();const btn=page.getByRole('button',{name:'הורדה one.jpg',exact:true});await expect(btn).toBeVisible();await expect(page.getByRole('button',{name:'הורדה two.jpg',exact:true})).toHaveCount(0);
  const dl=page.waitForEvent('download');await btn.click();expect(await decode(page,await buffer(await dl))).toMatchObject({width:200,height:200});
});
for(const format of ['JPEG','PNG','WEBP','GIF']) test(`converts to ${format} with a decodable result and correct transparency`,async({page})=>{
  await page.getByRole('button',{name:'המרת פורמט מאותו קובץ, לסוג אחר'}).click();await page.getByRole('button',{name:format,exact:true}).click();
  await page.getByTestId('image-upload').setInputFiles(await imageFile(page,'logo.png',240,160,true));await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();
  const btn=page.getByRole('button',{name:'הורדה logo.png',exact:true});await expect(btn).toBeVisible();const dl=page.waitForEvent('download');await btn.click();const output=await buffer(await dl);const info=await decode(page,output);
  expect(info).toMatchObject({width:240,height:160});expect(info.corner[3]).toBe(format==='JPEG'?255:0);if(format==='JPEG')expect(info.corner.slice(0,3)).toEqual([255,255,255]);
  if(format==='GIF')expect(output.subarray(0,6).toString()).toBe('GIF89a');if(format==='PNG')expect(output[0]).toBe(137);if(format==='WEBP')expect(output.subarray(8,12).toString()).toBe('WEBP');
});
test('PNG compression preserves transparency and does not increase file size',async({page})=>{
  const input=await imageFile(page,'transparent.png',500,300,true);await page.getByTestId('image-upload').setInputFiles(input);await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();
  const btn=page.getByRole('button',{name:'הורדה transparent.png',exact:true});await expect(btn).toBeVisible();const dl=page.waitForEvent('download');await btn.click();const out=await buffer(await dl);expect(out.length).toBeLessThanOrEqual(input.buffer.length);expect((await decode(page,out)).corner[3]).toBe(0);
});
test('animated GIF resize preserves all frames, frame timing, loop count and distinct colors',async({page})=>{
  await page.getByRole('button',{name:'שינוי מידות הגודל הנכון לכל מקום'}).click();await page.getByTestId('image-upload').setInputFiles(gifFile());await page.locator('#width').fill('40');await page.locator('#height').fill('30');await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();
  const btn=page.getByRole('button',{name:'הורדה animation.gif',exact:true});await expect(btn).toBeVisible();const dl=page.waitForEvent('download');await btn.click();const out=await buffer(await dl);const parsed=parseGIF(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength));const frames=decompressFrames(parsed,true);
  expect(parsed.lsd).toMatchObject({width:40,height:30});expect(frames).toHaveLength(3);expect(frames.map(f=>f.delay)).toEqual([80,120,200]);expect(frames.map(f=>Array.from(f.patch.slice(0,3)))).toEqual([[255,0,0],[0,255,0],[0,0,255]]);
  const marker=out.indexOf('NETSCAPE2.0');expect(marker).toBeGreaterThan(0);expect(out.readUInt16LE(marker+13)).toBe(2);
});
test('GIF compression retains animation and never increases file size',async({page})=>{
  const input=gifFile();await page.getByTestId('image-upload').setInputFiles(input);await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();const btn=page.getByRole('button',{name:'הורדה animation.gif',exact:true});await expect(btn).toBeVisible();const dl=page.waitForEvent('download');await btn.click();const out=await buffer(await dl);expect(out.length).toBeLessThanOrEqual(input.buffer.length);const parsed=parseGIF(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength));expect(decompressFrames(parsed,true)).toHaveLength(3);
});
test('dimension report exports real measurements and safely quotes CSV file names',async({page})=>{
  await page.getByRole('button',{name:'בדיקת מידות כל הנתונים במקום אחד'}).click();await page.getByTestId('image-upload').setInputFiles(await imageFile(page,'=cmd.png',315,210,true));await expect(page.getByText('315 × 210',{exact:true})).toBeVisible();const dl=page.waitForEvent('download');await page.getByRole('button',{name:'הורדת טבלת מידות',exact:true}).click();const csv=(await buffer(await dl)).toString();expect(csv).toContain('"\'=cmd.png","315","210"');await expect(page.getByRole('button',{name:'הכנת הקבצים',exact:true})).toHaveCount(0);
});
test('invalid input and invalid settings show clear errors without losing valid files',async({page})=>{
  await page.getByTestId('image-upload').setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not a real image')});await expect(page.getByRole('alert')).toContainText('סוג התמונה לא נתמך');
  await page.getByTestId('image-upload').setInputFiles(await imageFile(page,'good.png',120,80,true));await page.getByRole('button',{name:'שינוי מידות הגודל הנכון לכל מקום'}).click();await page.locator('#width').fill('0');await page.getByRole('button',{name:'הכנת הקבצים',exact:true}).click();await expect(page.getByRole('alert')).toContainText('יש להזין רוחב וגובה תקינים');await expect(page.getByText('good.png',{exact:true})).toBeVisible();
});
