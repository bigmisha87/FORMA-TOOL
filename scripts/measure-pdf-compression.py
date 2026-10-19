"""Independent PDF audit: Poppler rendering, PyMuPDF text/geometry, pypdf forms.

All input/output PDFs live in tmp/pdf-research. No production code is changed.
"""
import hashlib,json,shutil,subprocess
from pathlib import Path
import numpy as np
from PIL import Image
import pymupdf as fitz
from pypdf import PdfReader
from skimage.metrics import structural_similarity

ROOT=Path('tmp/pdf-research')
RENDER=ROOT/'renders';RENDER.mkdir(exist_ok=True)
rows=json.loads((ROOT/'sizes.json').read_text())
previous_path=Path('docs/pdf-compression-benchmark.json')
previous={r['name']:r for r in json.loads(previous_path.read_text(encoding='utf8'))} if previous_path.exists() else {}
poppler=shutil.which('pdftoppm')
if not poppler: raise RuntimeError('Poppler pdftoppm required for an independent renderer.')

def snapshot(path):
    doc=fitz.open(path)
    text=[p.get_text() for p in doc]
    chars=[]
    for p in doc:
        chars.append([(c['c'],tuple(round(v,2) for v in c['bbox'])) for b in p.get_text('rawdict')['blocks'] if b['type']==0 for l in b['lines'] for s in l['spans'] for c in s['chars']])
    widgets=[(i,w.field_name,w.field_type,w.field_value,tuple(round(v,2) for v in w.rect)) for i,p in enumerate(doc) for w in p.widgets()]
    links=[(i,l['kind'],l.get('uri'),l.get('page'),tuple(round(v,2) for v in l['from'])) for i,p in enumerate(doc) for l in p.get_links()]
    fields={name:(str(v.get('/FT')),str(v.get('/V'))) for name,v in (PdfReader(path).get_fields() or {}).items()}
    out=dict(pages=len(doc),text=text,chars=chars,widgets=widgets,links=links,toc=doc.get_toc(),fields=fields,
             geometry=[(tuple(p.mediabox),tuple(p.cropbox),p.rotation) for p in doc],vectors=[len(p.get_drawings()) for p in doc])
    doc.close();return out

def render(path,label):
    folder=RENDER/label;folder.mkdir(exist_ok=True)
    # Render all pages, not just a cover or thumbnail. 144 DPI, same renderer/options.
    result=subprocess.run([poppler,'-r','144','-png',str(path),str(folder/'page')],capture_output=True,text=True)
    if result.returncode: raise RuntimeError(result.stderr)
    return sorted(folder.glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1]))

for row in rows:
    name=row['name'];source=ROOT/'input'/f'{name}.pdf';reference=snapshot(source)
    row['inputSha256']=hashlib.sha256(source.read_bytes()).hexdigest()
    row['pages']=reference['pages'];row['textCharacters']=sum(map(len,reference['text']))
    ref_images=render(source,name+'-original')
    for engine,metrics in row['engines'].items():
        path=ROOT/'output'/f'{name}-{engine}.pdf'
        output_hash=hashlib.sha256(path.read_bytes()).hexdigest()
        old_row=previous.get(name,{})
        old_metrics=old_row.get('engines',{}).get(engine,{})
        if old_row.get('inputSha256')==row['inputSha256'] and old_metrics.get('outputSha256')==output_hash:
            row['engines'][engine]={**old_metrics,**metrics}
            print(name,engine,'unchanged, reusing verified result',flush=True)
            continue
        metrics['outputSha256']=output_hash
        actual=snapshot(path)
        metrics['textExact']=actual['text']==reference['text']
        metrics['textGeometryExact']=actual['chars']==reference['chars']
        metrics['pageGeometryExact']=actual['geometry']==reference['geometry']
        metrics['linksExact']=actual['links']==reference['links']
        metrics['formsExact']=actual['widgets']==reference['widgets'] and actual['fields']==reference['fields']
        metrics['bookmarksExact']=actual['toc']==reference['toc']
        metrics['vectorsExact']=actual['vectors']==reference['vectors']
        metrics['allTextCharacters']=sum(map(len,actual['text']))
        metrics['renderPages']=[]
        output_images=render(path,name+'-'+engine)
        assert len(output_images)==len(ref_images), (name,engine,'page count')
        for i,(a,b) in enumerate(zip(ref_images,output_images)):
            before=np.array(Image.open(a).convert('RGB'));after=np.array(Image.open(b).convert('RGB'))
            assert before.shape==after.shape,(name,engine,'render geometry')
            diff=np.abs(before.astype(np.int16)-after.astype(np.int16))
            exact=bool(np.array_equal(before,after))
            # Full-resolution equality/MAE plus spatial SSIM at 72 DPI for repeatable speed.
            metrics['renderPages'].append(dict(page=i+1,pixelExact=exact,mae=round(float(diff.mean()),5),maxDifference=int(diff.max()),ssim=1.0 if exact else round(float(structural_similarity(before[::2,::2],after[::2,::2],channel_axis=2,data_range=255)),6)))
        metrics['pixelExact']=all(p['pixelExact'] for p in metrics['renderPages'])
        metrics['minimumSSIM']=min(p['ssim'] for p in metrics['renderPages'])
        metrics['maximumMAE']=max(p['mae'] for p in metrics['renderPages'])
        metrics['smallerThanCurrentGentlePercent']=round(100*(1-metrics['bytes']/row['engines']['current-gentle']['bytes']),2)
        if engine!='current-strong':
            for key in ['textExact','textGeometryExact','pageGeometryExact','linksExact','formsExact','bookmarksExact','vectorsExact']:
                assert metrics[key],(name,engine,key)
            if engine in ['qpdf-lossless','mupdf-lossless']:assert metrics['pixelExact'],(name,engine,'lossless render')
            if engine in ['image-selective-high','hybrid-high']:assert metrics['minimumSSIM']>=.99,(name,engine,'high-quality SSIM')
        print(name,engine,metrics['bytes'],'SSIM',metrics['minimumSSIM'],'text',metrics['textExact'],'pixels',metrics['pixelExact'],flush=True)
    Path('docs/pdf-compression-benchmark.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Independent checks passed; complete report: docs/pdf-compression-benchmark.json')
