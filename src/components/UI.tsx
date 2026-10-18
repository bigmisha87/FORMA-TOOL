import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CircleHelp, Upload, X, ShieldCheck, LoaderCircle } from 'lucide-react';
import { useT } from '../i18n';

export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  const { t } = useT();
  return <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="modal-top"><h2 id={titleId}>{title}</h2><button className="icon-btn" onClick={close} title={t('close')} aria-label={t('close')}><X size={20}/></button></div>{children}
  </dialog>;
}
export function HelpButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false); const { t } = useT();
  return <><button type="button" className="help-btn" title={t('helpFor') + title} aria-label={t('helpFor') + title} onClick={() => setOpen(true)}><CircleHelp size={16}/></button>{open && <Modal title={title} close={() => setOpen(false)}><p className="help-copy">{text}</p><button className="btn primary" onClick={() => setOpen(false)}>{t('understood')}</button></Modal>}</>;
}
export function Dropzone({ pdf = false, add, disabled }: { pdf?: boolean; add: (files: File[]) => void; disabled: boolean }) {
  const { t } = useT(); const ref = useRef<HTMLInputElement>(null); const [over, setOver] = useState(false);
  return <div className={`dropzone ${over ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) add(Array.from(e.dataTransfer.files)); }}>
    <div className="upload-icon"><Upload size={27} strokeWidth={1.5}/><span>+</span></div>
    <h3>{t(pdf ? 'pdfDropTitle' : 'dropTitle')}</h3><p>{t(pdf ? 'pdfDropSub' : 'dropSub')}</p>
    <button className="btn primary" disabled={disabled} title={t('chooseFiles')} onClick={() => ref.current?.click()}><Upload size={17}/>{t('chooseFiles')}</button>
    <input data-testid={pdf ? 'pdf-upload' : 'image-upload'} ref={ref} type="file" className="sr-only" aria-label={t('chooseFiles')} multiple accept={pdf ? '.pdf,application/pdf' : '.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp'} onChange={e => { add(Array.from(e.target.files || [])); e.target.value = ''; }}/>
    <small dir="auto">{t(pdf ? 'pdfSupported' : 'supported')}</small>
    <div className="drop-foot"><ShieldCheck size={14}/>{t('local')}</div>
  </div>;
}
export function Progress({ value, label }: { value: number; label: string }) {
  return <div className="progress-box" role="status"><div><LoaderCircle className="spin" size={17}/><span>{label}</span><b>{Math.round(value * 100)}%</b></div><progress value={value} max={1}/></div>;
}
export function StepBar() { const { t } = useT(); return <div className="steps">{(['stepOne','stepTwo','stepThree'] as const).map((key, i) => <div key={key}><span>{i + 1}</span>{t(key)}{i < 2 && <i/>}</div>)}</div>; }
