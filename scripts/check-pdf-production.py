"""Audit actual UI downloads using independent PDF readers and Poppler."""
from pathlib import Path
import hashlib,json,subprocess,shutil
import numpy as np
from PIL import Image
import pymupdf as fitz
import pikepdf
from pypdf import PdfReader
from skimage.metrics import structural_similarity

root=Path('tmp/pdf-production');renders=root/'renders';renders.mkdir(parents=True,exist_ok=True)
def snapshot(path):
    with fitz.open(path) as d:
        chars=[[(c['c'],tuple(round(v,2) for v in c['bbox'])) for b in p.get_text('rawdict')['blocks'] if b['type']==0 for l in b['lines'] for s in l['spans'] for c in s['chars']] for p in d]
        features={'text':[p.get_text() for p in d],'chars':chars,'geometry':[(tuple(p.mediabox),tuple(p.cropbox),p.rotation) for p in d],
                  'widgets':[(i,w.field_name,w.field_type,w.field_value) for i,p in enumerate(d) for w in p.widgets()],
                  'links':[(i,l['kind'],l.get('uri'),l.get('page'),tuple(l['from'])) for i,p in enumerate(d) for l in p.get_links()],
                  'outline':d.get_toc(),'vectors':[len(p.get_drawings()) for p in d]}
    features['fields']={n:(str(f.get('/FT')),str(f.get('/V'))) for n,f in (PdfReader(path).get_fields() or {}).items()}
    profiles=set();masks=set()
    with pikepdf.open(path) as d:
        assert not d.check_pdf_syntax(),str(path)
        for o in d.objects:
            if not isinstance(o,pikepdf.Stream):continue
            if o.get('/N') in [1,3,4]:
                b=o.read_bytes()
                if b[36:40]==b'acsp':profiles.add(hashlib.sha256(b).hexdigest())
            m=o.get('/SMask')
            if isinstance(m,pikepdf.Stream):masks.add((int(m['/Width']),int(m['/Height']),hashlib.sha256(m.read_bytes()).hexdigest()))
    features['profiles']=profiles;features['masks']=masks
    return features
def render(path,label):
    out=renders/label;out.mkdir(exist_ok=True)
    subprocess.run([shutil.which('pdftoppm'),'-r','144','-png',str(path),str(out/'page')],capture_output=True,check=True)
    return sorted(out.glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1]))
report=[]
for source in sorted(Path('tests/pdf-benchmark/fixtures').glob('*.pdf')):
    before=snapshot(source);original=render(source,source.stem+'-original')
    for mode in ['gentle','strong']:
        output=root/f'{source.stem}-{mode}.pdf';after=snapshot(output)
        assert before==after,(source.stem,mode,'native text/geometry/links/forms/vectors/ICC/alpha')
        assert output.stat().st_size<=source.stat().st_size
        pages=render(output,source.stem+'-'+mode);assert len(pages)==len(original)
        exact=True;scores=[]
        for a,b in zip(original,pages):
            x=np.array(Image.open(a).convert('RGB'));y=np.array(Image.open(b).convert('RGB'));assert x.shape==y.shape
            same=bool(np.array_equal(x,y));exact&=same
            scores.append(1.0 if same else float(structural_similarity(x[::2,::2],y[::2,::2],channel_axis=2,data_range=255)))
        if mode=='gentle':assert exact,(source.stem,'lossless pixels')
        else:assert min(scores)>=.99,(source.stem,'quality SSIM',min(scores))
        report.append({'name':source.stem,'mode':mode,'inputBytes':source.stat().st_size,'outputBytes':output.stat().st_size,'pages':len(pages),'textAndFeaturesExact':True,'pixelExact':exact,'minimumSSIM':round(min(scores),6)})
        print(report[-1],flush=True)
Path('docs/pdf-production-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('All actual UI downloads passed independent PDF and render checks.')
