from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, name: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f'Could not find {name}')
    return text.replace(old, new, 1)


def add_import(text: str, marker: str, line: str) -> str:
    if line in text:
        return text
    if marker not in text:
        raise RuntimeError(f'Import marker not found: {marker}')
    return text.replace(marker, marker + '\n' + line, 1)


def enrich_labels(text: str) -> str:
    # Only transform JSX form labels. This does not touch export headings or data strings.
    terms = [
        'Strategy', 'Pair', 'Instrument', 'Direction', 'Timeframe', 'Higher timeframe', 'Session',
        'Account balance', 'Entry', 'Entry price', 'Stop loss', 'Take profit', 'Exit price',
        'Risk %', 'Planned RR', 'Actual R', 'Confidence', 'Execution rating',
    ]
    pattern = re.compile(r'<label>(' + '|'.join(re.escape(t) for t in sorted(terms, key=len, reverse=True)) + r')(?=(?:\s*<small[^>]*>.*?</small>)?\s*<(?:input|select|textarea))')
    return pattern.sub(lambda m: f'<label><InfoLabel label="{m.group(1)}" />', text)

# App.tsx
app_path = ROOT / 'src' / 'App.tsx'
app = app_path.read_text()
app = add_import(app, "import { supabase } from './lib/supabase'", "import { InfoLabel, InfoTip } from './InfoTip'")
app = replace_once(
    app,
    '<div className="metric-top"><span>{label}</span><div className="metric-icon"><Icon size={17} /></div></div>',
    '<div className="metric-top"><span className="metric-label-with-help">{label}<InfoTip label={label} /></span><div className="metric-icon"><Icon size={17} /></div></div>',
    'dashboard MetricCard label',
)
app = enrich_labels(app)
app_path.write_text(app)

# AdvancedFeatures.tsx
adv_path = ROOT / 'src' / 'AdvancedFeatures.tsx'
adv = adv_path.read_text()
adv = add_import(adv, "import { supabase } from './lib/supabase'", "import { InfoLabel, InfoTip } from './InfoTip'")
adv = replace_once(
    adv,
    'return <div className="metric-card"><div className="metric-top"><span>{label}</span></div><strong className={tone || \'\'}>{value}</strong></div>',
    'return <div className="metric-card"><div className="metric-top"><span className="metric-label-with-help">{label}<InfoTip label={label} /></span></div><strong className={tone || \'\'}>{value}</strong></div>',
    'ReportMetric label',
)
adv = enrich_labels(adv)
adv_path.write_text(adv)

# Phase2Workspace.tsx
p2_path = ROOT / 'src' / 'Phase2Workspace.tsx'
p2 = p2_path.read_text()
p2 = add_import(p2, "import { supabase } from './lib/supabase'", "import { InfoLabel, InfoTip } from './InfoTip'")
p2 = replace_once(
    p2,
    'return <div className="p2-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>',
    'return <div className="p2-metric"><span className="metric-label-with-help">{label}<InfoTip label={label} /></span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>',
    'Phase2 Metric label',
)
p2 = enrich_labels(p2)

heading_replacements = {
    '<h3>Broker-aware risk calculator</h3>': '<h3>Broker-aware risk calculator <InfoTip label="Lot size" /></h3>',
    '<h3>Economic-news proximity</h3>': '<h3>Economic-news proximity <InfoTip label="Economic-news proximity" /></h3>',
    '<h3>Chart evidence</h3>': '<h3>Chart evidence <InfoTip label="Chart evidence" /></h3>',
    '<h3>Rule check</h3>': '<h3>Rule check <InfoTip label="Rule check" /></h3>',
    '<h1>Strategy compare</h1>': '<h1>Strategy compare <InfoTip label="Strategy compare" /></h1>',
    '<h1>Rule & mistake correlations</h1>': '<h1>Rule & mistake correlations <InfoTip label="Correlations" /></h1>',
    '<h1>Playbook</h1>': '<h1>Playbook <InfoTip label="Playbook" /></h1>',
}
for old, new in heading_replacements.items():
    if new not in p2 and old in p2:
        p2 = p2.replace(old, new, 1)

# Economic calendar column terms, where present.
for old, new in {
    '<span>Forecast</span>': '<span className="metric-label-with-help">Forecast<InfoTip label="Forecast" /></span>',
    '<span>Previous</span>': '<span className="metric-label-with-help">Previous<InfoTip label="Previous" /></span>',
    '<span>Actual</span>': '<span className="metric-label-with-help">Actual<InfoTip label="Actual" /></span>',
}.items():
    if new not in p2:
        p2 = p2.replace(old, new)

p2_path.write_text(p2)

# Global tooltip styles
css_path = ROOT / 'src' / 'styles.css'
css = css_path.read_text()
marker = '/* Trading glossary info tips */'
if marker not in css:
    css += r'''

/* Trading glossary info tips */
.info-label-text,
.metric-label-with-help {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  min-width: 0;
}

.info-tip-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 3px;
  top: -.34em;
  vertical-align: super;
  z-index: 40;
}

.info-tip-button {
  width: 15px;
  height: 15px;
  min-width: 15px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(117, 233, 201, .42);
  background: rgba(99, 230, 190, .08);
  color: #72e4c0;
  font: 700 9px/1 ui-sans-serif, system-ui, sans-serif;
  text-transform: none;
  letter-spacing: 0;
  cursor: help;
  box-shadow: none;
  transition: border-color .16s ease, background .16s ease, transform .16s ease;
}

.info-tip-button:hover,
.info-tip-button:focus-visible,
.info-tip-wrap.is-open .info-tip-button {
  border-color: rgba(117, 233, 201, .9);
  background: rgba(99, 230, 190, .18);
  transform: translateY(-1px);
  outline: none;
}

.info-tip-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 9px);
  width: min(300px, calc(100vw - 32px));
  padding: 11px 12px;
  border: 1px solid rgba(116, 142, 164, .28);
  border-radius: 10px;
  background: #101822;
  color: #dce8f3;
  box-shadow: 0 14px 38px rgba(0, 0, 0, .38);
  font-size: 12px;
  line-height: 1.48;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  text-align: left;
  white-space: normal;
  transform: translate(-50%, 4px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity .14s ease, transform .14s ease, visibility .14s ease;
  z-index: 10000;
}

.info-tip-popover::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  width: 8px;
  height: 8px;
  background: #101822;
  border-right: 1px solid rgba(116, 142, 164, .28);
  border-bottom: 1px solid rgba(116, 142, 164, .28);
  transform: translate(-50%, -4px) rotate(45deg);
}

.info-tip-wrap:hover .info-tip-popover,
.info-tip-wrap:focus-within .info-tip-popover,
.info-tip-wrap.is-open .info-tip-popover {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
  pointer-events: auto;
}

@media (max-width: 720px) {
  .info-tip-popover {
    position: fixed;
    left: 14px;
    right: 14px;
    bottom: calc(82px + env(safe-area-inset-bottom, 0px));
    width: auto;
    max-width: none;
    transform: translateY(8px);
    padding: 13px 14px;
    font-size: 13px;
    z-index: 20000;
  }
  .info-tip-popover::after { display: none; }
  .info-tip-wrap:hover .info-tip-popover,
  .info-tip-wrap:focus-within .info-tip-popover,
  .info-tip-wrap.is-open .info-tip-popover {
    transform: translateY(0);
  }
}
'''
css_path.write_text(css)

print('Applied glossary info tooltips to App, AdvancedFeatures and Phase2Workspace.')
