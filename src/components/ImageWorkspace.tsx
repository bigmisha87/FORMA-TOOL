import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Check, CheckCircle2, Download, FileImage, Image, Layers, LockKeyhole, Maximize, Minus, Plus, ScanLine, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { errorKey, useT } from '../i18n';
import type { Key } from '../i18n';
import { defaultImageSettings, inspectImage } from '../lib/image';
import { runImage } from '../lib/image-runner';
import type { ImageInfo, ImageResult, ImageSettings, ImageTask } from '../lib/image';
import { download, fail, size, tick, zipFiles } from '../lib/common';
import { Dropzone, HelpButton, Progress } from './UI';

type Item = { id: string; file: File; info: ImageInfo; preview: string; selected: boolean; result?: ImageResult; resultUrl?: string; error?: Key };
const tools: { task: ImageTask; icon: typeof Image; title: Key; sub: Key; help: Key }[] = [
  { task: 'compress', icon: Minus, title: 'compress', sub: 'compressSub', help: 'compressionText' },
  { task: 'resize', icon: Maximize, title: 'resize', sub: 'resizeSub', help: 'fitHint' },
  { task: 'convert', icon: ArrowLeftRight, title: 'convert', sub: 'convertSub', help: 'flattenHint' },
  { task: 'inspect', icon: ScanLine, title: 'inspect', sub: 'inspectSub', help: 'inspectHint' },
];
export default function ImageWorkspace() {
  const { t } = useT(); const [settings, setSettings] = useState<ImageSettings>(defaultImageSettings);
  const [items, setItems] = useState<Item[]>([]); const itemsRef = useRef<Item[]>([]); itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach(i => { URL.revokeObjectURL(i.preview); if (i.resultUrl) URL.revokeObjectURL(i.resultUrl); }),[]);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [error, setError] = useState<Key | null>(null);
  const [preset, setPreset] = useState('1920x1080'); const [finished, setFinished] = useState(false);
  const selected = items.filter(i => i.selected), results = items.filter(i => i.result);
  const activeTool = tools.find(tool => tool.task === settings.task)!;
  function update(patch: Partial<ImageSettings>) {
    setSettings(s => ({ ...s, ...patch })); setFinished(false);
    setItems(list => list.map(item => { if (item.resultUrl) URL.revokeObjectURL(item.resultUrl); return { ...item, result: undefined, resultUrl: undefined, error: undefined }; }));
  }
  async function add(files: File[]) {
    if (busy || !files.length) return;
    if (items.length + files.length > 50) { setError('tooManyFiles'); return; }
    setBusy(true); setError(null); setFinished(false);
    const added: Item[] = []; let lastError: Key | null = null;
    for (let i = 0; i < files.length; i++) {
      try { const info = await inspectImage(files[i]); added.push({ id: crypto.randomUUID(), file: files[i], info, preview: URL.createObjectURL(files[i]), selected: true }); }
      catch (e) { lastError = errorKey(e); }
      setProgress((i + 1) / files.length); await tick();
    }
    setItems(old => [...old, ...added]); setError(lastError); setBusy(false); setProgress(0);
  }
  function remove(id?: string) {
    setItems(old => old.filter(i => { if (!id || i.id === id) { URL.revokeObjectURL(i.preview); if (i.resultUrl) URL.revokeObjectURL(i.resultUrl); return false; } return true; })); setFinished(false);
  }
  async function run() {
    setError(null); setFinished(false);
    if (!selected.length) { setError('noSelected'); return; }
    if (settings.task === 'resize' && ![settings.width, settings.height].every(n => Number.isInteger(n) && n >= 1 && n <= 16384)) { setError('invalidDimensions'); return; }
    if (settings.task === 'compress' && settings.mode === 'target' && (!Number.isFinite(settings.targetKB) || settings.targetKB < 1)) { setError('invalidTarget'); return; }
    setBusy(true); setProgress(0);
    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      try {
        const result = await runImage(item.file, settings, p => setProgress((i + p) / selected.length));
        const resultUrl = URL.createObjectURL(result.blob);
        setItems(old => old.map(row => { if (row.id !== item.id) return row; if (row.resultUrl) URL.revokeObjectURL(row.resultUrl); return { ...row, result, resultUrl, error: undefined }; }));
      } catch (e) { setItems(old => old.map(row => row.id === item.id ? { ...row, error: errorKey(e) } : row)); }
      setProgress((i + 1) / selected.length); await tick();
    }
    setBusy(false); setFinished(true);
  }
  async function pack() {
    setBusy(true); setError(null);
    try { download(await zipFiles(results.map(i => ({ name: i.result!.name, blob: i.result!.blob }))), 'forma-images.zip'); }
    catch (e) { setError(errorKey(e)); } finally { setBusy(false); }
  }
  function csv() {
    const escape = (value: string) => `"${value.replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
    const rows = [[t('filename'), t('width'), t('height'), t('weight'), 'Format'], ...items.map(i => [i.file.name, String(i.info.width), String(i.info.height), String(i.file.size), i.info.format.toUpperCase()])];
    download(new Blob(['\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'forma-dimensions.csv');
  }
  async function makePdf() {
    if (!selected.length) return;
    setBusy(true); setError(null);
    try {
      if (selected.some(i => i.info.frames > 1)) fail('flattened');
      const { imagesToPdf } = await import('../lib/pdf');
      download(await imagesToPdf(selected.map(i => ({ blob: i.result?.blob || i.file, width: i.result?.width || i.info.width, height: i.result?.height || i.info.height }))), 'forma-images.pdf');
    } catch (e) { setError(errorKey(e)); } finally { setBusy(false); }
  }
  return <section aria-labelledby="image-heading" className="workspace-section">
    <div className="section-heading"><div><h1 id="image-heading">{t('imageHeading')}</h1><p>{t('imageSub')}</p></div><span className="section-label"><span/>IMAGE STUDIO</span></div>
    <div className="workspace-grid"><aside className="tool-sidebar"><div className="sidebar-label">01 <span>{t('stepOne')}</span></div><div className="tool-list">{tools.map(tool => <div className={`tool-wrap ${settings.task === tool.task ? 'active' : ''}`} key={tool.task}>
      <button title={t(tool.sub)} disabled={busy} className="tool-button" aria-pressed={settings.task === tool.task} onClick={() => update({ task: tool.task, format: tool.task === 'convert' ? 'jpeg' : 'original' })}><tool.icon size={21}/><span><b>{t(tool.title)}</b><small>{t(tool.sub)}</small></span></button><HelpButton title={t(tool.title)} text={t(tool.help)}/>
    </div>)}</div><div className="sidebar-tip"><Layers size={20}/><p>{t('batchNote')}</p><small>{t('single')}</small></div></aside>
    <div className="work-area"><Dropzone add={add} disabled={busy}/>
      <fieldset disabled={busy} className="options-panel"><legend><SlidersHorizontal size={16}/>{t('options')}<HelpButton title={t(settings.task === 'resize' ? 'resize' : settings.task === 'convert' ? 'convert' : settings.task === 'inspect' ? 'inspect' : 'compress')} text={t(settings.task === 'resize' ? 'fitHint' : settings.task === 'convert' ? 'formatHint' : settings.task === 'inspect' ? 'inspectHint' : 'compressionText')}/></legend>
        {settings.task === 'compress' && <><div className="option-grid"><div><label>{t('compress')}</label><div className="segmented"><button type="button" className={settings.mode === 'recommended' ? 'chosen' : ''} title={t('reductionHint')} onClick={() => update({ mode: 'recommended' })}>{t('recommended')}</button><button type="button" className={settings.mode === 'target' ? 'chosen' : ''} title={t('targetHint')} onClick={() => update({ mode: 'target' })}>{t('target')}</button></div>
          {settings.mode === 'recommended' ? <><div className="range-label"><label htmlFor="reduction">{t('reduction')}</label><b>{settings.reduction}%</b></div><input id="reduction" type="range" min="10" max="90" step="10" value={settings.reduction} title={t('reductionHint')} onChange={e => update({ reduction: +e.target.value })}/><small className="hint">{t('reductionHint')}</small></> : <><label htmlFor="target">{t('targetLabel')}</label><div className="unit-input" dir="ltr"><input id="target" type="number" min="1" max="51200" value={settings.targetKB || ''} onChange={e => update({ targetKB: +e.target.value })} title={t('targetHint')}/><span>KB</span></div><small className="hint">{t('targetHint')}</small></>}
        </div><div><label htmlFor="colors">{t('colors')}</label><select id="colors" value={settings.colors} title={t('colorsHint')} onChange={e => update({ colors: +e.target.value })}>{<option value={0}>{t('losslessColors')}</option>}{[256,128,64,32].map(c => <option key={c} value={c}>{c}</option>)}</select><small className="hint">{t('colorsHint')}</small></div></div></>}
        {settings.task === 'resize' && <><div className="option-grid"><div><label htmlFor="preset">{t('preset')}</label><select id="preset" value={preset} title={t('preset')} onChange={e => { setPreset(e.target.value); if (e.target.value !== 'custom') { const [width, height] = e.target.value.split('x').map(Number); update({ width, height }); } }}>{[['1920x1080','fullHD'],['1080x1080','square'],['1080x1920','story'],['1200x1200','smallWeb'],['1200x628','banner'],['custom','custom']].map(([v,k]) => <option value={v} key={v}>{t(k as Key)}</option>)}</select></div><div className="dimension-inputs"><div><label htmlFor="width">{t('width')}</label><input id="width" type="number" min="1" max="16384" value={settings.width || ''} title={t('width')} onChange={e => { setPreset('custom'); update({ width: +e.target.value }); }}/></div><span>×</span><div><label htmlFor="height">{t('height')}</label><input id="height" type="number" min="1" max="16384" value={settings.height || ''} title={t('height')} onChange={e => { setPreset('custom'); update({ height: +e.target.value }); }}/></div></div></div><div className="check-row"><label><input type="checkbox" checked={settings.keep} onChange={e => update({ keep: e.target.checked })}/><LockKeyhole size={14}/>{t('keepRatio')}</label><label><input type="checkbox" checked={settings.upscale} onChange={e => update({ upscale: e.target.checked })}/>{t('upscale')}</label></div><small className="hint">{t('fitHint')}</small></>}
        {settings.task === 'convert' && <><label htmlFor="format">{t('outputFormat')}</label><div className="format-buttons" role="group" aria-label={t('outputFormat')}>{(['jpeg','png','webp','gif'] as const).map(f => <button type="button" key={f} title={f.toUpperCase()} aria-pressed={settings.format === f} className={settings.format === f ? 'chosen' : ''} onClick={() => update({ format: f })}>{f.toUpperCase()}{settings.format === f && <Check size={14}/>}</button>)}</div><small className="hint">{t('formatHint')}</small><p className="notice">{t('flattenHint')}</p></>}
        {settings.task === 'inspect' && <p className="hint">{t('inspectHint')}</p>}
      </fieldset>
      {error && <div className="error" role="alert">{t(error)}<button className="icon-btn" title={t('close')} onClick={() => setError(null)}><X size={16}/></button></div>}
      {busy && <Progress value={progress} label={t('processing')}/>}
      {items.length > 0 ? <div className="file-panel"><div className="files-heading"><h3>{t('files')} <span>{items.length}</span></h3><div><button className="text-btn" disabled={busy} title={t('csv')} onClick={csv}><ScanLine size={15}/>{t('csv')}</button><button className="text-btn muted" disabled={busy} title={t('clear')} onClick={() => remove()}><Trash2 size={15}/>{t('clear')}</button></div></div>
        <div className="table-scroll"><table><thead><tr><th><input type="checkbox" disabled={busy} aria-label={t('selectAll')} title={t('selectAll')} checked={selected.length === items.length} onChange={e => setItems(old => old.map(i => ({ ...i, selected: e.target.checked })))}/></th><th>{t('filename')}</th><th>{t('dimensions')}</th><th>{t('weight')}</th><th>{t('result')}</th><th><span className="sr-only">{t('actions')}</span></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><input type="checkbox" disabled={busy} checked={item.selected} title={item.file.name} aria-label={item.file.name} onChange={e => setItems(old => old.map(i => i.id === item.id ? { ...i, selected: e.target.checked } : i))}/></td><td><div className="file-identity"><img src={item.preview} alt=""/><div><b title={item.file.name} dir="auto">{item.file.name}</b><small>{item.info.format.toUpperCase()}{item.info.frames > 1 ? ` · ${item.info.frames} frames` : ''}</small></div></div></td><td><span dir="ltr" className="numeric">{item.info.width} × {item.info.height}</span></td><td><span dir="ltr" className="numeric">{size(item.file.size)}</span></td><td>{item.error ? <span className="row-error" role="alert">{t(item.error)}</span> : item.result ? <div className="file-result"><b><CheckCircle2 size={14}/><span dir="ltr">{size(item.result.blob.size)}</span></b><small dir="ltr">{item.result.width} × {item.result.height} · {item.result.format.toUpperCase()}</small><small className="saved">{Math.max(0, Math.round((1 - item.result.blob.size / item.file.size) * 100))}% {t('saved')}</small>{item.result.keptOriginal && <small>{t('unchanged')}</small>}{!item.result.targetMet && <small className="row-error">{t('targetMiss')}</small>}{item.result.flattened && <small>{t('flattened')}</small>}</div> : <span className="muted">{t('waiting')}</span>}</td><td><div className="row-actions">{item.result && <button className="icon-btn download-btn" disabled={busy} title={t('download')} aria-label={`${t('download')} ${item.file.name}`} onClick={() => download(item.result!.blob, item.result!.name)}><ArrowDownToLine size={17}/></button>}<button className="icon-btn" disabled={busy} title={t('remove')} aria-label={`${t('remove')} ${item.file.name}`} onClick={() => remove(item.id)}><X size={16}/></button></div></td></tr>)}</tbody></table></div>
        <div className="action-bar"><span>{selected.length} {t('selected')}</span><div>{settings.task !== 'inspect' && <button className="btn primary" disabled={busy || !selected.length} title={t(activeTool.title)} onClick={run}><activeTool.icon size={17}/>{busy ? t('processing') : t(activeTool.title)}</button>}{results.length > 0 && <button className="btn secondary" disabled={busy} title={t('downloadAll')} onClick={pack}><Download size={16}/>{t('downloadAll')}</button>}</div></div>
        {finished && results.length > 0 && <div className="success" role="status"><CheckCircle2 size={19}/><b>{t('done')}</b><span dir="ltr">{size(results.reduce((a,i) => a + i.file.size, 0))} → {size(results.reduce((a,i) => a + i.result!.blob.size, 0))}</span></div>}
        <div className="extras"><button className="text-btn" disabled={busy || !selected.length} title={t('makePdf')} onClick={makePdf}><FileImage size={16}/>{t('makePdf')}</button></div>
      </div> : <div className="empty-state"><FileImage size={25}/><div><b>{t('firstStep')}</b><p>{t('emptyNote')}</p></div><span className="empty-plus"><Plus size={18}/></span></div>}
    </div></div>
  </section>;
}
