"""Independent decode/quality audit. Requires Pillow, numpy, scikit-image.

Run the browser benchmark first. The site itself does not use Python.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageSequence, ImageDraw
from skimage.metrics import structural_similarity, peak_signal_noise_ratio

root = Path('tmp/compression')
rows = json.loads((root / 'sizes.json').read_text())
for row in rows:
    name, ext = row['name'], row['type']
    original = Image.open(root / f'{name}-original.{ext}')
    source = np.array(original.convert('RGB' if ext == 'jpeg' else 'RGBA'))
    for engine in ['old-default', 'old-lossless', 'new']:
        output = Image.open(root / f'{name}-{engine}.{ext}')
        pixels = np.array(output.convert('RGB' if ext == 'jpeg' else 'RGBA'))
        if ext == 'jpeg':
            assert output.size == original.size
            row[engine]['ssim'] = round(structural_similarity(source, pixels, channel_axis=2, data_range=255), 6)
            row[engine]['psnr'] = round(peak_signal_noise_ratio(source, pixels, data_range=255), 3)
        elif ext == 'png':
            row[engine]['pixelExact'] = bool(np.array_equal(source,pixels))
            # Compare visible RGBA plus raw stored RGBA independently (Canvas premultiplies).
            row[engine]['maxChannelDifference'] = int(np.abs(source.astype(int)-pixels.astype(int)).max())
        else:
            original.seek(0)
            a = [(np.array(f.convert('RGBA')), f.info.get('duration',0)) for f in ImageSequence.Iterator(original)]
            b = [(np.array(f.convert('RGBA')), f.info.get('duration',0)) for f in ImageSequence.Iterator(output)]
            row[engine]['animationExact'] = len(a)==len(b) and all(np.array_equal(x,y) and tx==ty for (x,tx),(y,ty) in zip(a,b)) and original.info.get('loop')==output.info.get('loop')
            row[engine]['frames'] = len(b)
    assert row['new']['bytes'] <= row['originalBytes'], name
    if ext == 'jpeg':
        # At the same 40% byte-reduction request, quality must not regress vs baseline.
        assert row['new']['ssim'] >= row['old-default']['ssim'], name
    else:
        assert row['new']['pixelExact' if ext=='png' else 'animationExact'], name
    print(name, row['new'])

Path('docs/compression-benchmark.json').write_text(json.dumps(rows,indent=2)+'\n')
# A visual comparison at native scale, no upscaling or enhancement of output images.
photo_names=[r['name'] for r in rows if r['type']=='jpeg']
sheet=Image.new('RGB',(1536, sum(Image.open(root/f'{n}-original.jpeg').height+32 for n in photo_names)), 'white')
draw=ImageDraw.Draw(sheet); y=0
for name in photo_names:
    h=0
    for i,engine in enumerate(['original','old-default','new']):
        im=Image.open(root/f'{name}-{engine}.jpeg');sheet.paste(im,(i*512,y+28));draw.text((i*512+4,y+6),f'{name} / {engine}',fill='black');h=im.height
    y+=h+32
sheet.save('docs/compression-comparison.png')

