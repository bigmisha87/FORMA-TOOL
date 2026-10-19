import { Component, Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, Check, CircleHelp, Files, Globe2, Image, Layers, Moon, Settings2, ShieldCheck, Sun } from 'lucide-react';
import { en, he, I18n } from './i18n';
import type { Key, Lang } from './i18n';
import ImageWorkspace from './components/ImageWorkspace';
import HelpPage from './components/HelpPage';
import { Modal } from './components/UI';
const PdfWorkspace = lazy(() => import('./components/PdfWorkspace'));
type Tab = 'images' | 'pdf' | 'help';
type Prefs = { lang: Lang; theme: 'light' | 'dark' | 'system'; tab: Tab };
function initial(): Prefs {
  try {
    const stored = JSON.parse(localStorage.getItem('forma-preferences') || '{}');
    return { lang: stored.lang === 'en' ? 'en' : 'he', theme: ['light','dark','system'].includes(stored.theme) ? stored.theme : 'light', tab: ['images','pdf','help'].includes(stored.tab) ? stored.tab : 'images' };
  } catch { return { lang:'he',theme:'light',tab:'images' }; }
}
class ErrorBoundary extends Component<{ children: ReactNode; message: string },{ failed: boolean }> {
  state = { failed:false }; static getDerivedStateFromError() { return { failed:true }; }
  render() { return this.state.failed ? <div role="alert" className="error">{this.props.message}</div> : this.props.children; }
}
export default function App() {
  const [prefs,setPrefs] = useState(initial); const [tab,setTab] = useState<Tab>(prefs.tab);
  const [pdfVisited,setPdfVisited] = useState(prefs.tab === 'pdf'); const [settingsOpen,setSettingsOpen] = useState(false);
  const [toast,setToast] = useState<Key | null>(null); const [systemDark,setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const t = (key: Key) => (prefs.lang === 'he' ? he : en)[key];
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark);
  useEffect(() => { const query = matchMedia('(prefers-color-scheme: dark)'); const change = () => setSystemDark(query.matches); query.addEventListener('change',change); return () => query.removeEventListener('change',change); },[]);
  useEffect(() => { document.documentElement.lang = prefs.lang; document.documentElement.dir = prefs.lang === 'he' ? 'rtl' : 'ltr'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.title = prefs.lang === 'he' ? 'FORMA — קבצים מוכנים. בלי להסתבך.' : 'FORMA — Files, ready. Without the fuss.'; },[prefs.lang,dark]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null),4500); return () => clearTimeout(timer); },[toast]);
  function save() { try { localStorage.setItem('forma-preferences',JSON.stringify(prefs)); setToast('preferencesSaved'); } catch { setToast('noStorage'); } setSettingsOpen(false); }
  function selectTab(value: Tab) { setTab(value); if (value === 'pdf') setPdfVisited(true); }
  return <I18n.Provider value={{ lang:prefs.lang,t }}><div className="app-shell">
    <a className="skip-link" href="#main">{t('workspace')}</a>
    <header className="site-header"><div className="brand-block"><a className="brand" href="#" title="FORMA" onClick={e => { e.preventDefault(); selectTab('images'); }}><span className="brand-mark">f<span/></span><span>forma<span className="brand-dot">.</span></span></a><small className="brand-credit" dir="ltr">Build by <a href="https://www.instagram.com/bigmisha/" title="Instagram" target="_blank" rel="noopener noreferrer">bigmisha</a></small></div>
      <nav aria-label={t('workspace')} className="main-nav">{([{ id:'images',icon:Image },{ id:'pdf',icon:Files },{ id:'help',icon:CircleHelp }] as const).map(({ id,icon:Icon }) => <button key={id} title={t(id)} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => selectTab(id)}><Icon size={17}/>{t(id)}</button>)}</nav>
      <div className="header-actions"><button className="language-btn" title={t('language')} aria-label={t('language')} onClick={() => setPrefs(p => ({...p,lang:p.lang === 'he' ? 'en' : 'he'}))}><Globe2 size={16}/>{prefs.lang === 'he' ? 'EN' : 'עב'}</button><button className="icon-btn" title={t(dark ? 'light' : 'dark')} aria-label={t(dark ? 'light' : 'dark')} onClick={() => setPrefs(p => ({...p,theme:dark ? 'light' : 'dark'}))}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><span className="header-divider"/><button className="icon-btn" title={t('settings')} aria-label={t('settings')} onClick={() => setSettingsOpen(true)}><Settings2 size={19}/></button></div>
    </header>
    <main id="main">
    <div hidden={tab !== 'images'}><ImageWorkspace/></div>
    {pdfVisited && <div hidden={tab !== 'pdf'}><ErrorBoundary message={t('loadError')}><Suspense fallback={<div className="loading-panel">{t('preparing')}</div>}><PdfWorkspace/></Suspense></ErrorBoundary></div>}
    {tab === 'help' && <HelpPage/>}
    <section className="trust-row">{([{ icon:ShieldCheck,title:'privacyTitle',text:'privacyText' },{ icon:Layers,title:'batchTitle',text:'batchText' },{ icon:CircleHelp,title:'helpTitle',text:'helpText' }] as const).map(({ icon:Icon,title,text }) => <article key={title}><span className="trust-icon"><Icon size={22} strokeWidth={1.5}/></span><div><h3>{t(title)}</h3><p>{t(text)}</p></div></article>)}</section>
    </main>
    <footer><div className="footer-brand" dir="ltr">forma<span>.</span><small>A LITTLE TOOL. A LOT LESS WORK.</small></div><p>{t('footer')}</p><div className="source-links"><a href={`${import.meta.env.BASE_URL}LICENSE.txt`} title={t('license')} target="_blank" rel="noreferrer">{t('license')}</a><a href={`${import.meta.env.BASE_URL}forma-source.zip`} title={t('sourceDownload')} download>{t('sourceDownload')}</a><a href="https://github.com/bigmisha87/FORMA-TOOL" title={t('source')} target="_blank" rel="noreferrer">{t('source')}<ArrowUpRight size={15}/></a></div></footer>
    {settingsOpen && <Modal title={t('settingsTitle')} close={() => setSettingsOpen(false)}><p className="modal-sub">{t('settingsSub')}</p><div className="settings-form"><label htmlFor="language">{t('language')}</label><select id="language" value={prefs.lang} title={t('language')} onChange={e => setPrefs(p => ({...p,lang:e.target.value as Lang}))}><option value="he">עברית</option><option value="en">English</option></select><label htmlFor="theme">{t('theme')}</label><select id="theme" value={prefs.theme} title={t('theme')} onChange={e => setPrefs(p => ({...p,theme:e.target.value as Prefs['theme']}))}><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option><option value="system">{t('system')}</option></select><label htmlFor="start-tab">{t('defaultTab')}</label><select id="start-tab" value={prefs.tab} title={t('defaultTab')} onChange={e => setPrefs(p => ({...p,tab:e.target.value as Tab}))}><option value="images">{t('images')}</option><option value="pdf">{t('pdf')}</option><option value="help">{t('help')}</option></select><button className="btn primary" title={t('saveDefaults')} onClick={save}><Check size={17}/>{t('saveDefaults')}</button></div></Modal>}
    {toast && <div className="toast" role="status"><Check size={17}/>{t(toast)}</div>}
  </div></I18n.Provider>;
}
