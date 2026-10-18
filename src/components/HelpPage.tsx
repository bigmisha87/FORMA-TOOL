import { BookOpen, ExternalLink } from 'lucide-react';
import { useT } from '../i18n';
import type { Key } from '../i18n';
const sections: [Key,Key][] = [['howTitle','howText'],['pixelsTitle','pixelsText'],['bytesTitle','bytesText'],['ratioTitle','ratioText'],['formatsTitle','formatsText'],['compressionTitle','compressionText'],['gifTitle','gifText'],['pdfHelpTitle','pdfHelpText'],['limitsTitle','limitsText'],['libraries','librariesText']];
export default function HelpPage() {
  const { t } = useT();
  return <section className="help-page"><div className="section-heading"><div><h1>{t('quickHelp')}</h1><p>{t('helpIntro')}</p></div><BookOpen size={28}/></div><div className="help-grid">{sections.map(([title,text],i) => <article key={title}><span className="help-number">{String(i+1).padStart(2,'0')}</span><h3>{t(title)}</h3><p>{t(text)}</p></article>)}</div><a className="text-btn" href="https://github.com/bigmisha87/FORMA-TOOL" target="_blank" rel="noreferrer">{t('source')}<ExternalLink size={15}/></a></section>;
}
