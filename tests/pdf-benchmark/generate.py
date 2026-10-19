"""Controlled PDF corpus. No user documents or generated media are used."""
from pathlib import Path
from io import BytesIO
import zlib
import pymupdf as fitz
import pikepdf
from PIL import Image

ROOT=Path('tmp/pdf-research')
INPUT=ROOT/'input'
INPUT.mkdir(parents=True,exist_ok=True)
PHOTO=Path('tests/benchmark/fixtures/astronaut.png')
FONT=Path('C:/Windows/Fonts/arial.ttf')
if not FONT.exists():
    FONT=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')

def title(page, text):
    page.insert_text((36,40),text,fontsize=16)
    page.insert_text((36,62),'FORMA | selectable text 0123456789 | PDF benchmark',fontsize=9)

def save(doc,name,**kw):
    doc.save(INPUT/f'{name}.pdf',**kw);doc.close()

# Already compressed office-like text/vectors. Fonts are standard PDF fonts.
d=fitz.open()
for n in range(3):
    p=d.new_page();title(p,f'Account brief / {n+1}')
    for y in range(100,740,16):p.insert_text((36,y),f'{y}: Budget, delivery date, campaign goals and client approval.',fontsize=10)
    p.draw_rect(fitz.Rect(390,110,550,190),color=(.1,.1,.1),fill=(.95,.78,.16))
save(d,'text-vectors',deflate=True)

# Identical resources imported from separate PDFs: font/image deduplication.
d=fitz.open()
for n in range(4):
    sub=fitz.open();p=sub.new_page();title(p,f'Repeated assets / {n+1}')
    p.insert_font(fontname='ArialBench',fontfile=str(FONT));p.insert_text((36,95),'Embedded font, repeated photo and native text.',fontname='ArialBench',fontsize=11)
    p.insert_image(fitz.Rect(60,130,500,570),filename=str(PHOTO))
    d.insert_pdf(sub);sub.close()
save(d,'duplicate-assets',deflate=True)

# Figma-like lossless photo streams at low Flate effort, with text kept separate.
d=fitz.open()
for n in range(2):
    p=d.new_page();title(p,f'Photo layout / {n+1}');p.insert_image(fitz.Rect(50,100,545,595),filename=str(PHOTO));p.insert_text((36,720),'Native caption remains selectable above and below the photograph.',fontsize=10)
save(d,'photo-flate',deflate=True)
with pikepdf.open(INPUT/'photo-flate.pdf',allow_overwriting_input=True) as pdf:
    for obj in pdf.objects:
        if isinstance(obj,pikepdf.Stream) and obj.get('/Subtype')==pikepdf.Name.Image and obj.get('/ColorSpace')==pikepdf.Name.DeviceRGB:
            obj.write(zlib.compress(obj.read_bytes(),1),filter=pikepdf.Name.FlateDecode)
    pdf.save(INPUT/'photo-flate.pdf',compress_streams=True,recompress_flate=False)

# Same decoded RGB samples with a simple DeviceRGB dictionary: QPDF's image
# optimizer supports this case, while the ICCBased fixture is commonly skipped.
with pikepdf.open(INPUT/'photo-flate.pdf') as pdf:
    for obj in pdf.objects:
        if isinstance(obj,pikepdf.Stream) and obj.get('/Subtype')==pikepdf.Name.Image:
            obj['/ColorSpace']=pikepdf.Name.DeviceRGB
    pdf.save(INPUT/'photo-device-rgb.pdf')

# Already JPEG-compressed photo: should not imply the same savings as Flate photos.
photo=Image.open(PHOTO).convert('RGB');buf=BytesIO();photo.save(buf,format='JPEG',quality=85,subsampling=0)
d=fitz.open();p=d.new_page();title(p,'Already compressed JPEG photo');p.insert_image(fitz.Rect(50,100,545,595),stream=buf.getvalue());p.insert_text((36,700),'An already-compressed image must not be rasterized together with text.',fontsize=10)
save(d,'photo-jpeg',deflate=True)

# Transparency, fine lines, lossless flat artwork and a placed photo.
d=fitz.open();p=d.new_page();title(p,'Transparency, line art and soft masks')
p.insert_image(fitz.Rect(30,100,400,470),filename=str(PHOTO))
p.insert_image(fitz.Rect(150,180,560,450),filename='tests/benchmark/fixtures/gradient-alpha.png')
for x in range(35,560,7):p.draw_line((x,490),(x,550),color=(.15,.15,.15),width=.25)
p.insert_text((36,600),'Fine native text: abcdefghijklmnopqrstuvwxyz 0.5pt rules.',fontsize=7)
save(d,'alpha-graphics',deflate=True)

# Hebrew, embedded fonts, vector content, URL, bookmarks and an editable widget.
d=fitz.open();p=d.new_page();title(p,'Hebrew, links and form')
p.insert_htmlbox(fitz.Rect(40,100,550,240),'<div dir="rtl" style="font-size:22px">בדיקת טקסט בעברית<br>משרד פרסום — תקציב ומועד מסירה</div>')
p.insert_text((40,280),'Client approval link',fontsize=12)
p.insert_link({'kind':fitz.LINK_URI,'from':fitz.Rect(40,260,200,290),'uri':'https://example.com/approval'})
w=fitz.Widget();w.field_name='client';w.field_type=fitz.PDF_WIDGET_TYPE_TEXT;w.field_value='FORMA client';w.rect=fitz.Rect(40,330,330,360);w.text_font='Helv';w.text_fontsize=12;p.add_widget(w)
d.set_toc([[1,'Campaign brief',1]])
save(d,'hebrew-form',deflate=True)

# A scanned page with an existing invisible OCR layer. The experiment does not add OCR.
d=fitz.open();p=d.new_page(width=512,height=512);p.insert_image(p.rect,filename=str(PHOTO));p.insert_text((20,30),'Existing searchable OCR layer 123456789',fontsize=12,render_mode=3)
save(d,'scan-ocr',deflate=True)
print('Created eight controlled PDFs in', INPUT)
