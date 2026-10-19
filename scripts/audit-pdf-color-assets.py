"""Confirm embedded ICC payloads and decoded alpha masks survive compression."""
import hashlib,json
from pathlib import Path
import pikepdf

root=Path('tmp/pdf-research');report=Path('docs/pdf-compression-benchmark.json')
rows=json.loads(report.read_text(encoding='utf8'))
def assets(path):
    profiles=set();masks=set()
    with pikepdf.open(path) as doc:
        for obj in doc.objects:
            if not isinstance(obj,pikepdf.Stream):continue
            if obj.get('/N') in [1,3,4]:
                data=obj.read_bytes()
                if data[36:40]==b'acsp':profiles.add(hashlib.sha256(data).hexdigest())
            mask=obj.get('/SMask')
            if isinstance(mask,pikepdf.Stream):
                masks.add((int(mask.get('/Width',0)),int(mask.get('/Height',0)),hashlib.sha256(mask.read_bytes()).hexdigest()))
    return profiles,masks
for row in rows:
    source=assets(root/'input'/f'{row["name"]}.pdf')
    for engine,metrics in row['engines'].items():
        result=assets(root/'output'/f'{row["name"]}-{engine}.pdf')
        metrics['iccPayloadsExact']=source[0]==result[0]
        metrics['alphaMasksExact']=source[1]==result[1]
        if engine!='current-strong':assert result==source,(row['name'],engine,'ICC/alpha payload')
report.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('All preserving candidates retain the source ICC profile payloads and decoded alpha masks.')
