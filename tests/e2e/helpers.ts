import type { Page, Download } from '@playwright/test';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import gifenc from 'gifenc';
const { GIFEncoder } = gifenc;

export async function imageFile(page: Page, name = 'photo.jpg', width = 1200, height = 800, transparent = false) {
  const png = name.endsWith('.png');
  const base64 = await page.evaluate(({ width,height,png,transparent }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d')!;
    if (transparent) { ctx.fillStyle = '#e84854'; ctx.fillRect(width/4,height/4,width/2,height/2); }
    else {
      const data = ctx.createImageData(width,height); let seed = 345;
      for(let i=0;i<data.data.length;i+=4) { seed=(seed*1664525+1013904223)>>>0; data.data[i]=seed%256; data.data[i+1]=(seed>>>8)%256; data.data[i+2]=(seed>>>16)%256; data.data[i+3]=255; }
      ctx.putImageData(data,0,0);
    }
    return canvas.toDataURL(png ? 'image/png' : 'image/jpeg',.94).split(',')[1];
  },{width,height,png,transparent});
  return { name,mimeType:png ? 'image/png' : 'image/jpeg',buffer:Buffer.from(base64,'base64') };
}
export async function buffer(download: Download) {
  const stream = await download.createReadStream(); const chunks: Buffer[]=[];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks);
}
export async function decode(page: Page, data: Buffer) {
  return page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const canvas = document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);
    const output={width:bitmap.width,height:bitmap.height,corner:Array.from(ctx.getImageData(0,0,1,1).data)};bitmap.close();return output;
  },data.toString('base64'));
}
export async function pdfFile(name='brief.pdf',widths=[400,500,600]) {
  const doc = await PDFDocument.create(); const font=await doc.embedFont(StandardFonts.Helvetica);
  for(let i=0;i<widths.length;i++) { const p=doc.addPage([widths[i],600]);p.drawRectangle({x:20,y:20,width:widths[i]-40,height:560,color:[rgb(.9,.3,.3),rgb(.3,.7,.4),rgb(.3,.4,.9)][i%3]});p.drawText(`FORMA / PAGE ${i+1}`,{x:45,y:480,size:24,font,color:rgb(1,1,1)}); }
  return {name,mimeType:'application/pdf',buffer:Buffer.from(await doc.save({useObjectStreams:false}))};
}
export function gifFile(name='animation.gif') {
  const gif=GIFEncoder(); const palette=[[255,0,0],[0,255,0],[0,0,255],[0,0,0]];
  for(let i=0;i<3;i++) gif.writeFrame(new Uint8Array(80*60).fill(i),80,60,{palette,delay:[80,120,200][i],repeat:2,dispose:2});
  gif.finish();return {name,mimeType:'image/gif',buffer:Buffer.from(gif.bytes())};
}
