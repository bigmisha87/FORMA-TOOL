import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Download, FileImage, Files, Grip, Minimize2, RotateCw, Scissors, Trash2, X } from 'lucide-react';
import { errorKey, useT } from '../i18n';
import type { Key } from '../i18n';
import { download, fail, outputName, parseRange, size, zipFiles } from '../lib/common';
import { compressPdf, loadPdf, makePages, organizePdf, pdfToImages, splitPdf } from '../lib/pdf';
import type { PdfMode, PdfPage, PdfSource } from '../lib/pdf';
import { Dropzone, HelpButton, Progress } from './UI';

const tools: { mode: PdfMode; icon: typeof Files; title: Key; sub: Key; help: Key }[] = [
  { mode:'organize',icon:Files,title:'organize',sub:'organizeSub',help:'pdfArrangeHint' },
  { mode:'compress',icon:Minimize2,title:'pdfCompress',sub:'pdfCompressSub',help:'pdfHelpText' },
  { mode:'split',icon:Scissors,title:'split',sub:'splitSub',help:'pdfSplitHint' },
  { mode:'images',icon:FileImage,title:'pdfImages',sub:'pdfImagesSub',help:'pdfImagesHint' },
];
type Result = { blob: Blob; name: string; before?: number };
export default function PdfWorkspace() {
  const { t } = useT(); const [mode, setMode] = useState<PdfMode>('organize');
  const [sources, setSources] = useState<PdfSource[]>([]), [pages, setPages] = useState<PdfPage[]>([]);
  const sourcesRef = useRef(sources); sourcesRef.current = sources;
  useEffect(() => () => sourcesRef.current.forEach(s => void s.close()),[]);
  const [busy,setBusy] = useState(false), [progress,setProgress] = useState(0), [loading,setLoading] = useState(false);
  const [error,setError] = useState<Key | null>(null), [strong,setStrong] = useState(true);
  const [range,setRange] = useState(''), [results,setResults] = useState<Result[]>([]), [drag,setDrag] = useState<string | null>(null);
  const selected = pages.filter(p => p.selected);
  const activeTool = tools.find(tool => tool.mode === mode)!;
  const invalidate = () => setResults([]);
  async function add(files: File[]) {
    if (busy || !files.length) return;
    if (sources.length + files.length > 50) { setError('tooManyFiles'); return; }
    setBusy(true); setLoading(true); setError(null); setProgress(0); invalidate();
    let total = sources.reduce((sum,s) => sum + s.doc.getPageCount(),0);
    const added: PdfSource[] = [], newPages: PdfPage[] = [];
    for (let i = 0; i < files.length; i++) {
      let source: PdfSource | undefined;
      try {
        source = await loadPdf(files[i]);
        if (total + source.doc.getPageCount() > 200) fail('pdfTooManyPages');
        const batch = await makePages(source, p => setProgress((i + p) / files.length));
        total += batch.length; added.push(source); newPages.push(...batch);
      } catch (e) { setError(errorKey(e)); if (source) await source.close(); }
    }
    setSources(old => [...old,...added]); setPages(old => [...old,...newPages]); setBusy(false); setLoading(false);
  }
  function clear() { sources.forEach(s => void s.close()); setSources([]); setPages([]); setResults([]); setRange(''); setError(null); }
  function move(id: string, to: number) {
    invalidate(); setPages(old => { const copy = [...old]; const at = copy.findIndex(p => p.id === id); const [item] = copy.splice(at,1); copy.splice(Math.max(0,Math.min(to,copy.length)),0,item); return copy; });
  }
  function applyRange() {
    try { const values = parseRange(range,pages.length); setPages(old => old.map((p,i) => ({...p,selected:values.includes(i)}))); setError(null); invalidate(); }
    catch (e) { setError(errorKey(e)); }
  }
  async function run() {
    setError(null); setResults([]); setProgress(0);
    if (!sources.length) { setError('noFiles'); return; }
    if (mode !== 'compress' && !selected.length) { setError('noPages'); return; }
    setBusy(true);
    try {
      if (mode === 'organize') setResults([{ blob:await organizePdf(sources,selected),name:'forma-document.pdf' }]);
      if (mode === 'split') setResults([{ blob:await splitPdf(sources,selected,setProgress),name:'forma-pages.zip' }]);
      if (mode === 'images') setResults([{ blob:await pdfToImages(sources,selected,setProgress),name:'forma-pdf-images.zip' }]);
      if (mode === 'compress') {
        const output: Result[] = [];
        for (let i = 0; i < sources.length; i++) {
          try { output.push({ blob:await compressPdf(sources[i],strong,p => setProgress((i+p)/sources.length)),name:outputName(sources[i].file.name,'pdf'),before:sources[i].file.size }); }
          catch (e) { setError(errorKey(e)); }
        }
        setResults(output);
      }
      setProgress(1);
    } catch (e) { setError(errorKey(e)); } finally { setBusy(false); }
  }
  async function downloadResults() {
    setBusy(true); try { download(await zipFiles(results), 'forma-pdfs.zip'); } catch (e) { setError(errorKey(e)); } finally { setBusy(false); }
  }
  return <section aria-labelledby="pdf-heading" className="workspace-section">
    <div className="section-heading"><div><h1 id="pdf-heading">{t('pdfHeading')}</h1><p>{t('pdfSub')}</p></div><span className="section-label"><span/>PDF STUDIO</span></div>
    <div className="workspace-grid"><aside className="tool-sidebar"><div className="sidebar-label">01 <span>{t('stepOne')}</span></div><div className="tool-list">{tools.map(tool => <div key={tool.mode} className={`tool-wrap ${mode === tool.mode ? 'active' : ''}`}><button disabled={busy} className="tool-button" title={t(tool.sub)} aria-pressed={mode === tool.mode} onClick={() => { setMode(tool.mode); invalidate(); }}><tool.icon size={21}/><span><b>{t(tool.title)}</b><small>{t(tool.sub)}</small></span></button><HelpButton title={t(tool.title)} text={t(tool.help)}/></div>)}</div><div className="sidebar-tip"><Files size={20}/><p>{t('pdfArrangeHint')}</p></div></aside>
    <div className="work-area"><Dropzone pdf add={add} disabled={busy}/>
      <fieldset className="options-panel" disabled={busy}><legend>{t(mode === 'compress' ? 'pdfCompression' : mode === 'split' ? 'split' : mode === 'images' ? 'pdfImages' : 'organize')}<HelpButton title={t('pdfHelpTitle')} text={t('pdfHelpText')}/></legend>
      {mode === 'compress' ? <><div className="option-grid"><div><label htmlFor="compression">{t('pdfCompression')}</label><select id="compression" value={strong ? 'strong' : 'gentle'} title={t('pdfCompression')} onChange={e => { setStrong(e.target.value === 'strong'); invalidate(); }}><option value="gentle">{t('gentle')}</option><option value="strong">{t('strong')}</option></select></div></div><p className={strong ? 'notice' : 'hint'}>{t(strong ? 'strongHint' : 'gentleHint')}</p><small className="hint">{t('pdfBatchHint')}</small></> : <p className="hint">{t(mode === 'organize' ? 'pdfArrangeHint' : mode === 'split' ? 'pdfSplitHint' : 'pdfImagesHint')}</p>}
      </fieldset>
      {error && <div className="error" role="alert">{t(error)}<button className="icon-btn" title={t('close')} onClick={() => setError(null)}><X size={16}/></button></div>}
      {busy && <Progress value={progress} label={t(loading ? 'preparing' : 'processing')}/>}
      {!!sources.length && <div className="pdf-files"><div className="files-heading"><h3>{sources.length} {t('files')} · {pages.length} {t('pages')}</h3><button className="text-btn muted" disabled={busy} title={t('clear')} onClick={clear}><Trash2 size={15}/>{t('clear')}</button></div><div className="source-chips">{sources.map(s => <span key={s.id} title={s.file.name}><Files size={14}/><b dir="auto">{s.file.name}</b><small dir="ltr">{size(s.file.size)}</small><button className="icon-btn" disabled={busy} title={`${t('remove')} ${s.file.name}`} aria-label={`${t('remove')} ${s.file.name}`} onClick={() => { void s.close(); setSources(old => old.filter(v => v.id !== s.id)); setPages(old => old.filter(v => v.source !== s.id)); invalidate(); }}><X size={13}/></button></span>)}</div></div>}
      {!!pages.length && mode !== 'compress' && <><div className="pdf-selection"><div><label htmlFor="range">{t('range')}</label><div className="range-input"><input id="range" dir="ltr" type="text" value={range} title={t('rangeHint')} placeholder={t('rangePlaceholder')} onChange={e => setRange(e.target.value)}/><button className="btn secondary" disabled={busy} title={t('rangeHint')} onClick={applyRange}>{t('applyRange')}</button></div></div><button className="text-btn" disabled={busy} title={t(selected.length === pages.length ? 'deselectAll' : 'resetSelection')} onClick={() => { setPages(old => old.map(p => ({...p,selected:selected.length !== pages.length}))); invalidate(); }}>{t(selected.length === pages.length ? 'deselectAll' : 'resetSelection')}</button></div>
      <div className="page-grid">{pages.map((p,i) => <article data-testid="pdf-page" key={p.id} className={`page-card ${p.selected ? 'selected' : ''}`} draggable={!busy} onDragStart={() => setDrag(p.id)} onDragEnd={() => setDrag(null)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (drag && !busy) move(drag,i); setDrag(null); }}>
        <div className="page-top"><label><input type="checkbox" disabled={busy} checked={p.selected} aria-label={`${t('page')} ${i+1}`} title={`${t('page')} ${i+1}`} onChange={e => { setPages(old => old.map(v => v.id === p.id ? {...v,selected:e.target.checked} : v)); invalidate(); }}/><span>{i+1}</span></label><Grip size={16}/></div><div className="page-preview"><img style={{ transform:`rotate(${p.rotation}deg)` }} src={p.thumbnail} alt={`${t('page')} ${p.index+1}`}/></div><small className="page-source" title={sources.find(s => s.id === p.source)?.file.name}>{sources.find(s => s.id === p.source)?.file.name} · {p.index+1}</small>
        <div className="page-actions"><button className="icon-btn" disabled={busy || i === 0} title={t('moveEarlier')} aria-label={`${t('moveEarlier')} ${i+1}`} onClick={() => move(p.id,i-1)}><ArrowUp size={15}/></button><button className="icon-btn" disabled={busy || i === pages.length-1} title={t('moveLater')} aria-label={`${t('moveLater')} ${i+1}`} onClick={() => move(p.id,i+1)}><ArrowDown size={15}/></button><button className="icon-btn" disabled={busy} title={t('rotate')} aria-label={`${t('rotate')} ${i+1}`} onClick={() => { setPages(old => old.map(v => v.id === p.id ? {...v,rotation:(v.rotation+90)%360} : v)); invalidate(); }}><RotateCw size={15}/></button><button className="icon-btn" disabled={busy} title={t('deletePage')} aria-label={`${t('deletePage')} ${i+1}`} onClick={() => { setPages(old => old.filter(v => v.id !== p.id)); invalidate(); }}><Trash2 size={15}/></button></div>
      </article>)}</div></>}
      {!!sources.length && <div className="action-bar"><span>{mode === 'compress' ? sources.length : selected.length} {t(mode === 'compress' ? 'files' : 'selected')}</span><button className="btn primary" disabled={busy || (mode !== 'compress' && !selected.length)} title={t(activeTool.title)} onClick={run}><activeTool.icon size={17}/>{busy ? t('processing') : t(activeTool.title)}</button></div>}
      {!!results.length && <div className="pdf-results" role="status"><h3><Check size={18}/>{t('done')}</h3>{results.map((result,i) => <div key={i}><span><b dir="auto">{result.name}</b><small dir="ltr">{result.before ? `${size(result.before)} → ` : ''}{size(result.blob.size)}</small>{result.before === result.blob.size && <small>{t('originalPdf')}</small>}</span><button className="btn secondary" disabled={busy} title={t('download')} onClick={() => download(result.blob,result.name)}><Download size={16}/>{t('download')}</button></div>)}{results.length > 1 && <button className="btn primary" disabled={busy} title={t('downloadAll')} onClick={downloadResults}><Download size={16}/>{t('downloadAll')}</button>}</div>}
      {!sources.length && <div className="empty-state"><Files size={27}/><div><b>{t('pdfEmpty')}</b><p>{t('pdfEmptySub')}</p></div></div>}
    </div></div>
  </section>;
}
