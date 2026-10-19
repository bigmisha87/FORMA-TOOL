import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';
import {buffer} from './helpers';

const cases=['alpha-graphics','duplicate-assets','hebrew-form','photo-device-rgb','photo-flate','photo-jpeg','scan-ocr','text-vectors','tracemonkey'];
test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('button',{name:'כלי PDF',exact:true}).click();await page.getByRole('button',{name:'הקטנת PDF פחות משקל, יותר נוח לשלוח'}).click();});

for(const name of cases)for(const mode of ['gentle','strong'])test(`${mode} preserves selectable text and document features: ${name}`,async({page},info)=>{
  const input=readFileSync(`tests/pdf-benchmark/fixtures/${name}.pdf`);
  await page.locator('#compression').selectOption(mode);
  await page.getByTestId('pdf-upload').setInputFiles({name:`${name}.pdf`,mimeType:'application/pdf',buffer:input});
  await page.getByRole('button',{name:'הקטנת PDF',exact:true}).click();
  const button=page.getByRole('button',{name:'הורדה',exact:true});await expect(button).toBeVisible();
  const waiting=page.waitForEvent('download');await button.click();const output=await buffer(await waiting);
  expect(output.length).toBeLessThanOrEqual(input.length);
  const result=await page.evaluate(async({a,b})=>{
    const {loadPdf}=await import('/src/lib/pdf.ts');
    const inspect=async(s:string)=>{
      const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));const pdf=await loadPdf(new File([bytes],'test.pdf',{type:'application/pdf'}));
      try {
        const pages=[];
        for(let i=1;i<=pdf.preview.numPages;i++) {
          const p=await pdf.preview.getPage(i);const text=(await p.getTextContent()).items.filter(x=>'str' in x).map(x=>x.str).join('').replace(/\s/g,'');
          const annotations=(await p.getAnnotations()).map(x=>({subtype:x.subtype,url:x.url,rect:x.rect,fieldName:x.fieldName,value:x.fieldValue}));
          pages.push({text,view:p.view,rotate:p.rotate,annotations});
        }
        return {pages,fields:pdf.doc.getForm().getFields().map(f=>f.getName()),outline:(await pdf.preview.getOutline())?.map(x=>x.title)};
      }finally{await pdf.close();}
    };
    return {before:await inspect(a),after:await inspect(b)};
  },{a:input.toString('base64'),b:output.toString('base64')});
  expect(result.after).toEqual(result.before);
  if(name==='photo-flate'&&mode==='strong')expect(output.length).toBeLessThan(input.length*.4);
  if(name==='duplicate-assets')expect(output.length).toBeLessThan(input.length*.3);
  if(info.project.name==='chrome'){mkdirSync('tmp/pdf-production',{recursive:true});writeFileSync(`tmp/pdf-production/${name}-${mode}.pdf`,output);}
});

test('failed codec download produces an error, keeps source and allows retry',async({page})=>{
  await page.route('**/codecs/mupdf-wasm.wasm',route=>route.abort());
  await page.getByTestId('pdf-upload').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:readFileSync('tests/pdf-benchmark/fixtures/photo-flate.pdf')});
  await page.getByRole('button',{name:'הקטנת PDF',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'הורדה',exact:true})).toHaveCount(0);
  await page.unroute('**/codecs/mupdf-wasm.wasm');await page.getByRole('button',{name:'הקטנת PDF',exact:true}).click();await expect(page.getByRole('button',{name:'הורדה',exact:true})).toBeVisible();
});

test('digitally signed input is rejected without altering the source',async({page})=>{
  const doc=await PDFDocument.create();doc.addPage();const signature=doc.context.obj({Type:PDFName.of('Sig'),ByteRange:[PDFNumber.of(0),PDFNumber.of(10),PDFNumber.of(20),PDFNumber.of(5)]});doc.catalog.set(PDFName.of('Perms'),doc.context.obj({DocMDP:doc.context.register(signature)}));
  await page.getByTestId('pdf-upload').setInputFiles({name:'signed.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});await page.getByRole('button',{name:'הקטנת PDF',exact:true}).click();await expect(page.getByRole('alert')).toContainText('חתום דיגיטלית');await expect(page.getByRole('button',{name:'הורדה',exact:true})).toHaveCount(0);
});
