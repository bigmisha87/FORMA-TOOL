"""Independently audit the PDFs produced by each browser engine smoke test."""
from pathlib import Path
import json,subprocess,shutil
import pymupdf as fitz
from pypdf import PdfReader
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity

root=Path('tmp/pdf-research')
report=Path('docs/pdf-candidate-browsers.json')
rows=json.loads(report.read_text())
for row in rows:
    assert 'error' not in row,row
    assert row['pdfjsTextExact'],row
    name,engine,browser=row['fixture'],row['engine'],row['browser']
    source=fitz.open(root/'input'/f'{name}.pdf')
    path=root/'browser-output'/f'{name}-{engine}-{browser}.pdf';out=fitz.open(path)
    assert [p.get_text() for p in source]==[p.get_text() for p in out],row
    assert source.get_toc()==out.get_toc(),row
    assert [(i,w.field_name,w.field_value) for i,p in enumerate(source) for w in p.widgets()]==[(i,w.field_name,w.field_value) for i,p in enumerate(out) for w in p.widgets()],row
    row['nativeTextExact']=True;row['bookmarksExact']=True;row['formValuesExact']=True
    render=root/'browser-renders'/f'{name}-{engine}-{browser}';render.mkdir(parents=True,exist_ok=True)
    subprocess.run([shutil.which('pdftoppm'),'-r','144','-png',str(path),str(render/'page')],check=True,capture_output=True)
    values=[];exact=[]
    for file in sorted(render.glob('*.png'),key=lambda p:int(p.stem.split('-')[-1])):
        index=int(file.stem.split('-')[-1])
        original=sorted((root/'renders'/f'{name}-original').glob('*.png'),key=lambda p:int(p.stem.split('-')[-1]))[index-1]
        a=np.array(Image.open(original).convert('RGB'));b=np.array(Image.open(file).convert('RGB'))
        same=bool(np.array_equal(a,b));exact.append(same)
        values.append(1.0 if same else float(structural_similarity(a[::2,::2],b[::2,::2],channel_axis=2,data_range=255)))
    row['pixelExact']=all(exact);row['minimumSSIM']=round(min(values),6)
    if engine in ['qpdf','mupdf']:assert row['pixelExact'],row
    if engine in ['selective-high','hybrid']:assert row['minimumSSIM']>=.99,row
    # The fixture's field must remain editable, not just appear on the page.
    if name=='hebrew-form':
        page=out[0];widget=next(page.widgets());widget.field_value='Edited client 987';widget.update()
        edited=root/'browser-output'/f'edited-{engine}-{browser}.pdf';out.save(edited)
        fields=PdfReader(edited).get_fields();assert fields['client']['/V']=='Edited client 987',row
        row['formEditVerified']=True
    source.close();out.close()
    print(browser,name,engine,row['minimumSSIM'],flush=True)
report.write_text(json.dumps(rows,indent=2)+'\n')
print('All browser-generated PDFs independently verified.')
