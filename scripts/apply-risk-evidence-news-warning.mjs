import fs from 'node:fs'

const appPath = 'src/Phase2Workspace.tsx'
const cssPath = 'src/phase2.css'
let app = fs.readFileSync(appPath, 'utf8')
let css = fs.readFileSync(cssPath, 'utf8')

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`Patch anchor not found: ${label}`)
  return source.replace(before, after)
}

app = replaceOnce(
  app,
  `  Save, Sparkles, Target, TrendingDown, TrendingUp, WalletCards, X,`,
  `  AlertTriangle, ImagePlus, Save, Sparkles, Target, TrendingDown, TrendingUp, UploadCloud, WalletCards, X,`,
  'lucide imports',
)

const helperAnchor = `function monthKey(date: Date) { return \`${'${date.getFullYear()}'}-${'${String(date.getMonth() + 1).padStart(2, \'0\')}'}\` }\n`
const helperBlock = `${helperAnchor}
function normalizeCalendarCurrency(value: any) {
  const raw = String(value || '').trim().toUpperCase()
  const map: Record<string, string> = { US: 'USD', USA: 'USD', EU: 'EUR', GB: 'GBP', UK: 'GBP', JP: 'JPY', CH: 'CHF', CA: 'CAD', AU: 'AUD', NZ: 'NZD' }
  return map[raw] || raw
}
function currenciesForSymbol(symbol: string) {
  const clean = String(symbol || '').toUpperCase().replace(/[^A-Z]/g, '')
  if (['XAUUSD','XAGUSD','NAS100','US30','SPX500','BTCUSD','BTCUSDT','ETHUSD','ETHUSDT'].includes(clean)) return ['USD']
  if (clean === 'GER40') return ['EUR']
  if (clean.length >= 6) return [clean.slice(0, 3), clean.slice(3, 6)]
  return []
}
function nearbyEconomicEvents(events: EconomicEvent[], symbol: string, date: string, time: string) {
  if (!date || !time) return []
  const entry = new Date(\`${'${date}'}T${'${time}'}:00\`)
  if (Number.isNaN(entry.getTime())) return []
  const currencies = currenciesForSymbol(symbol)
  return events
    .map((event) => ({ ...event, deltaMinutes: Math.round((new Date(event.date).getTime() - entry.getTime()) / 60000) }))
    .filter((event: any) => Number.isFinite(event.deltaMinutes) && Math.abs(event.deltaMinutes) <= 60)
    .filter((event: any) => ['high', 'medium'].includes(String(event.impact || '').toLowerCase()))
    .filter((event: any) => currencies.length === 0 || currencies.includes(normalizeCalendarCurrency(event.country)))
    .sort((a: any, b: any) => Math.abs(a.deltaMinutes) - Math.abs(b.deltaMinutes))
}
function brokerLotSizing(symbol: string, entryValue: any, stopValue: any, riskAmount: number | null, accountCurrency: string, quoteToAccountInput: any) {
  const entry = n(entryValue), stop = n(stopValue)
  const distance = entry != null && stop != null ? Math.abs(entry - stop) : null
  const clean = String(symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const currency = String(accountCurrency || 'USD').toUpperCase()
  if (riskAmount == null || !distance || entry == null) return { lotSize: null, detail: 'Enter balance, risk, entry and SL', stopLabel: '—', exact: false, needsConversion: false }

  if (clean === 'XAUUSD' || clean === 'XAGUSD') {
    const contractSize = clean === 'XAUUSD' ? 100 : 5000
    let conversion = 1
    const needsConversion = currency !== 'USD'
    if (needsConversion) {
      const manual = n(quoteToAccountInput)
      if (manual == null || manual <= 0) return { lotSize: null, detail: `Enter USD → ${currency} conversion`, stopLabel: `${distance.toFixed(clean === 'XAUUSD' ? 2 : 3)} price`, exact: false, needsConversion: true }
      conversion = manual
    }
    const lossPerLot = distance * contractSize * conversion
    return { lotSize: lossPerLot > 0 ? riskAmount / lossPerLot : null, detail: `${clean} standard contract ${contractSize} oz`, stopLabel: `${distance.toFixed(clean === 'XAUUSD' ? 2 : 3)} price`, exact: true, needsConversion }
  }

  const fx = clean.match(/^([A-Z]{3})([A-Z]{3})$/)
  if (fx && !['BTC','ETH','XAU','XAG'].includes(fx[1])) {
    const base = fx[1], quote = fx[2]
    const pipSize = quote === 'JPY' ? 0.01 : 0.0001
    const stopPips = distance / pipSize
    const pipValueQuote = 100000 * pipSize
    let quoteToAccount = 1
    let needsConversion = false
    if (quote === currency) quoteToAccount = 1
    else if (base === currency) quoteToAccount = 1 / entry
    else {
      needsConversion = true
      const manual = n(quoteToAccountInput)
      if (manual == null || manual <= 0) return { lotSize: null, detail: `Enter 1 ${quote} → ${currency} conversion`, stopLabel: `${stopPips.toFixed(1)} pips`, exact: false, needsConversion: true }
      quoteToAccount = manual
    }
    const pipValueAccount = pipValueQuote * quoteToAccount
    const lossPerLot = stopPips * pipValueAccount
    return { lotSize: lossPerLot > 0 ? riskAmount / lossPerLot : null, detail: `100,000-unit standard lot · ${pipValueAccount.toFixed(2)} ${currency}/pip`, stopLabel: `${stopPips.toFixed(1)} pips`, exact: true, needsConversion }
  }

  return { lotSize: null, detail: 'Broker contract specification required for this instrument', stopLabel: `${distance.toFixed(4)} price`, exact: false, needsConversion: false }
}
`
app = replaceOnce(app, helperAnchor, helperBlock, 'sizing helpers')

app = replaceOnce(
  app,
  `  const [form, setForm] = useState<any>({ strategy_id: first?.id || '', symbol: first?.markets?.[0] || 'XAUUSD', direction: 'long', trade_date: today(), entry_time: nowTime(), session: detectSession(), timeframe: first?.primary_timeframe || '5M', entry_price: '', stop_loss: '', take_profit: '', exit_price: '', account_balance: profile?.default_account_balance || '', risk_percent: profile?.default_risk_percent || 1, pnl: '', note: '' })\n  const [ruleStates, setRuleStates] = useState<Record<string, 'followed' | 'violated' | 'na'>>({})\n  const [saving, setSaving] = useState(false)\n  const [message, setMessage] = useState('')`,
  `  const [form, setForm] = useState<any>({ strategy_id: first?.id || '', symbol: first?.markets?.[0] || 'XAUUSD', direction: 'long', trade_date: today(), entry_time: nowTime(), session: detectSession(), timeframe: first?.primary_timeframe || '5M', entry_price: '', stop_loss: '', take_profit: '', exit_price: '', account_balance: profile?.default_account_balance || '', risk_percent: profile?.default_risk_percent || 1, quote_to_account_rate: '', pnl: '', note: '' })\n  const [ruleStates, setRuleStates] = useState<Record<string, 'followed' | 'violated' | 'na'>>({})\n  const [saving, setSaving] = useState(false)\n  const [message, setMessage] = useState('')\n  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)\n  const [evidenceType, setEvidenceType] = useState<'before' | 'entry' | 'chart'>('entry')\n  const [evidencePreview, setEvidencePreview] = useState('')\n  const [calendarEvents, setCalendarEvents] = useState<EconomicEvent[]>([])\n  const [calendarMessage, setCalendarMessage] = useState('')`,
  'quick trade state',
)

app = replaceOnce(
  app,
  `  useEffect(() => { if (seed) setForm((p: any) => ({ ...p, strategy_id: seed.strategy_id || p.strategy_id, symbol: seed.symbol || p.symbol, timeframe: seed.timeframe || p.timeframe })) }, [seed])\n  const strategy = active.find((s: Strategy) => s.id === form.strategy_id)`,
  `  useEffect(() => { if (seed) setForm((p: any) => ({ ...p, strategy_id: seed.strategy_id || p.strategy_id, symbol: seed.symbol || p.symbol, timeframe: seed.timeframe || p.timeframe })) }, [seed])\n  useEffect(() => {\n    supabase.functions.invoke('economic-calendar', { body: {} }).then(({ data, error }) => {\n      if (error || data?.error) setCalendarMessage('Economic calendar is temporarily unavailable.')\n      else setCalendarEvents(Array.isArray(data?.events) ? data.events : [])\n    })\n  }, [])\n  useEffect(() => {\n    if (!evidenceFile) { setEvidencePreview(''); return }\n    const url = URL.createObjectURL(evidenceFile); setEvidencePreview(url)\n    return () => URL.revokeObjectURL(url)\n  }, [evidenceFile])\n  const strategy = active.find((s: Strategy) => s.id === form.strategy_id)`,
  'quick trade effects',
)

app = replaceOnce(
  app,
  `  const riskAmount = balance != null && riskPct != null ? balance * riskPct / 100 : null\n  const riskDistance = entry != null && stop != null ? Math.abs(entry - stop) : null\n  const positionSize = riskAmount != null && riskDistance ? riskAmount / riskDistance : null\n  const pairs = Array.from(new Set([...(strategy?.markets || []), ...popularPairs]))`,
  `  const riskAmount = balance != null && riskPct != null ? balance * riskPct / 100 : null\n  const accountCurrency = String(profile?.currency || 'USD').toUpperCase()\n  const sizing = brokerLotSizing(form.symbol, form.entry_price, form.stop_loss, riskAmount, accountCurrency, form.quote_to_account_rate)\n  const positionSize = sizing.lotSize\n  const nearbyEvents = useMemo(() => nearbyEconomicEvents(calendarEvents, form.symbol, form.trade_date, form.entry_time), [calendarEvents, form.symbol, form.trade_date, form.entry_time])\n  const pairs = Array.from(new Set([...(strategy?.markets || []), ...popularPairs]))`,
  'broker sizing calculation',
)

app = replaceOnce(
  app,
  `  function markAll(status: 'followed' | 'na') { const next: any = {}; strategyRules.forEach((r: Rule) => next[r.id] = status); setRuleStates(next) }\n\n  async function save(e: FormEvent) {`,
  `  function markAll(status: 'followed' | 'na') { const next: any = {}; strategyRules.forEach((r: Rule) => next[r.id] = status); setRuleStates(next) }\n  function acceptEvidence(file: File | null | undefined) {\n    if (!file) return\n    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { setMessage('Screenshot must be PNG, JPG or WEBP.'); return }\n    if (file.size > 10 * 1024 * 1024) { setMessage('Screenshot must be 10 MB or smaller.'); return }\n    setEvidenceFile(file); setMessage('')\n  }\n  function handleEvidencePaste(event: any) {\n    const file = Array.from(event.clipboardData?.files || []).find((item: any) => String(item.type || '').startsWith('image/')) as File | undefined\n    if (file) { event.preventDefault(); acceptEvidence(file) }\n  }\n\n  async function save(e: FormEvent) {`,
  'evidence handlers',
)

app = replaceOnce(
  app,
  `    await supabase.from('profiles').update({ default_account_balance: balance, default_risk_percent: riskPct || 1 }).eq('id', userId)\n    setMessage(closed ? \`Closed trade saved at ${'${signed(liveR, \'R\')}'} .\` : 'Open trade saved. Close it later from Open Trades.')`.replace("'} .`", "'}.`"),
  `    let evidenceWarning = ''\n    if (evidenceFile) {\n      const extension = evidenceFile.type === 'image/png' ? 'png' : evidenceFile.type === 'image/webp' ? 'webp' : 'jpg'\n      const bucketPath = \`${'${userId}'}/${'${trade.id}'}/${'${crypto.randomUUID()}'} .${'${extension}'}\`.replace(' .', '.')\n      const { error: uploadError } = await supabase.storage.from('trade-screenshots').upload(bucketPath, evidenceFile, { contentType: evidenceFile.type, upsert: false })\n      if (uploadError) evidenceWarning = \` Screenshot upload failed: ${'${uploadError.message}'}\`\n      else {\n        const { error: imageError } = await supabase.from('trade_images').insert({ trade_id: trade.id, user_id: userId, bucket_path: bucketPath, image_type: evidenceType, notes: 'Added from Quick Trade' })\n        if (imageError) { await supabase.storage.from('trade-screenshots').remove([bucketPath]); evidenceWarning = \` Screenshot metadata failed: ${'${imageError.message}'}\` }\n      }\n    }\n    await supabase.from('profiles').update({ default_account_balance: balance, default_risk_percent: riskPct || 1 }).eq('id', userId)\n    setMessage((closed ? \`Closed trade saved at ${'${signed(liveR, \'R\')}'} .\`.replace(' .', '.') : 'Open trade saved. Close it later from Open Trades.') + evidenceWarning)`,
  'evidence upload save',
)

app = replaceOnce(
  app,
  `    setForm((p: any) => ({ ...p, trade_date: today(), entry_time: nowTime(), entry_price: '', stop_loss: '', take_profit: '', exit_price: '', pnl: '', note: '' }))\n    setSaving(false); onSaved()`,
  `    setForm((p: any) => ({ ...p, trade_date: today(), entry_time: nowTime(), entry_price: '', stop_loss: '', take_profit: '', exit_price: '', quote_to_account_rate: '', pnl: '', note: '' }))\n    setEvidenceFile(null)\n    setSaving(false); onSaved()`,
  'quick trade reset',
)

app = replaceOnce(
  app,
  `    <section className="p2-card"><div className="p2-section-title"><div><h3>Risk calculator</h3><p>Planned RR, risk amount, raw size and realized R update automatically.</p></div></div><div className="p2-grid p2-grid-4">`,
  `    <section className="p2-card"><div className="p2-section-title"><div><h3>Broker-aware risk calculator</h3><p>Forex and Gold use standard contract sizing. Broker-specific instruments stay un-sized until their contract spec is known.</p></div></div><div className="p2-grid p2-grid-4">`,
  'risk heading',
)

app = replaceOnce(
  app,
  `      <label>Risk %<input type="number" min="0" step="0.01" value={form.risk_percent} onChange={(e) => setForm({ ...form, risk_percent: e.target.value })}/></label>\n      <label>Exit price <small>optional</small>`,
  `      <label>Risk %<input type="number" min="0" step="0.01" value={form.risk_percent} onChange={(e) => setForm({ ...form, risk_percent: e.target.value })}/></label>\n      {sizing.needsConversion && <label>Quote → {accountCurrency} rate<input type="number" min="0" step="any" value={form.quote_to_account_rate} onChange={(e) => setForm({ ...form, quote_to_account_rate: e.target.value })} placeholder="1 quote currency in account currency"/><small>Needed for cross-currency pip value</small></label>}\n      <label>Exit price <small>optional</small>`,
  'conversion field',
)

app = replaceOnce(
  app,
  `<div className="p2-metrics"><Metric label="Planned RR" value={rr == null ? '—' : \`1 : ${'${rr.toFixed(2)}'}\`}/><Metric label="Risk amount" value={riskAmount == null ? '—' : riskAmount.toFixed(2)}/><Metric label="Raw position size" value={positionSize == null ? '—' : positionSize.toFixed(2)} detail="Risk amount ÷ price distance"/><Metric label="Realized R" value={liveR == null ? 'Open' : signed(liveR, 'R')}/></div></section>`,
  `<div className="p2-metrics"><Metric label="Planned RR" value={rr == null ? '—' : \`1 : ${'${rr.toFixed(2)}'}\`}/><Metric label="Risk amount" value={riskAmount == null ? '—' : \`${'${riskAmount.toFixed(2)}'} ${'${accountCurrency}'}\`}/><Metric label="Lot size" value={positionSize == null ? '—' : positionSize.toFixed(3)} detail={sizing.detail}/><Metric label="Stop distance" value={sizing.stopLabel}/><Metric label="Realized R" value={liveR == null ? 'Open' : signed(liveR, 'R')}/></div>{!sizing.exact && entry != null && stop != null && riskAmount != null && <div className="p2-sizing-warning"><AlertTriangle size={15}/><span>{sizing.detail}. The trade can still be journaled, but no broker lot size will be stored.</span></div>}</section>`,
  'risk metrics',
)

const ruleSection = `    <section className="p2-card"><div className="p2-section-title"><div><h3>Rule check</h3><p>Use only the rules that matter for this strategy.</p></div><button type="button" className="p2-text" onClick={() => markAll('na')}>Reset</button></div>`
const newSections = `    <section className="p2-card p2-news-proximity"><div className="p2-section-title"><div><h3>Economic-news proximity</h3><p>High/medium-impact events within ±60 minutes of your planned entry.</p></div></div>{calendarMessage ? <div className="p2-muted">{calendarMessage}</div> : nearbyEvents.length ? <div className="p2-news-warning-list">{nearbyEvents.slice(0,4).map((event: any) => <div className={\`p2-news-warning ${'${event.impact}'}\`} key={event.id}><AlertTriangle size={16}/><div><strong>{event.country} · {event.title}</strong><span>{event.deltaMinutes === 0 ? 'At entry time' : event.deltaMinutes > 0 ? \`${'${event.deltaMinutes}'} min after entry\` : \`${'${Math.abs(event.deltaMinutes)}'} min before entry\`} · {String(event.impact).toUpperCase()} impact</span></div></div>)}</div> : <div className="p2-news-clear"><Check size={15}/> No high/medium relevant event found within ±60 minutes.</div>}</section>\n    <section className="p2-card"><div className="p2-section-title"><div><h3>Chart evidence</h3><p>Paste a screenshot with Ctrl/Cmd+V or choose an image. It uploads only after the trade is saved.</p></div></div><div className="p2-evidence-row"><div className="p2-evidence-drop" tabIndex={0} onPaste={handleEvidencePaste}><UploadCloud size={24}/><strong>{evidenceFile ? evidenceFile.name : 'Paste or choose screenshot'}</strong><span>PNG, JPG or WEBP · max 10 MB</span><label className="p2-secondary p2-file-button"><ImagePlus size={15}/> Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => acceptEvidence(e.target.files?.[0])}/></label></div>{evidencePreview && <div className="p2-evidence-preview"><img src={evidencePreview} alt="Trade evidence preview"/><div><select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value as any)}><option value="before">Before entry</option><option value="entry">Entry chart</option><option value="chart">General chart</option></select><button type="button" className="p2-text danger" onClick={() => setEvidenceFile(null)}>Remove</button></div></div>}</div></section>\n${ruleSection}`
app = replaceOnce(app, ruleSection, newSections, 'news and evidence sections')

if (!css.includes('/* phase3-risk-evidence */')) {
  css += `\n\n/* phase3-risk-evidence */\n.p2-sizing-warning,.p2-news-clear{display:flex;align-items:center;gap:9px;margin-top:14px;padding:11px 13px;border:1px solid rgba(255,196,87,.25);background:rgba(255,196,87,.07);border-radius:12px;color:var(--text,#eef4f8);font-size:13px}.p2-news-clear{border-color:rgba(86,225,184,.22);background:rgba(86,225,184,.06);color:#9ce8d3}.p2-muted{color:var(--muted,#8191a5);font-size:13px}.p2-news-warning-list{display:grid;gap:9px}.p2-news-warning{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border-radius:12px;border:1px solid rgba(255,196,87,.24);background:rgba(255,196,87,.07)}.p2-news-warning.high{border-color:rgba(255,111,111,.32);background:rgba(255,111,111,.08)}.p2-news-warning svg{flex:0 0 auto;margin-top:2px}.p2-news-warning div{display:grid;gap:3px}.p2-news-warning strong{font-size:13px}.p2-news-warning span{font-size:11px;color:var(--muted,#8191a5)}.p2-evidence-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,.65fr);gap:16px}.p2-evidence-drop{min-height:160px;border:1px dashed rgba(139,158,181,.35);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7px;padding:20px;background:rgba(255,255,255,.018);outline:none}.p2-evidence-drop:focus{border-color:rgba(86,225,184,.6);box-shadow:0 0 0 3px rgba(86,225,184,.08)}.p2-evidence-drop span{font-size:11px;color:var(--muted,#8191a5)}.p2-file-button{position:relative;overflow:hidden;margin-top:5px}.p2-file-button input{position:absolute;inset:0;opacity:0;cursor:pointer}.p2-evidence-preview{border:1px solid rgba(139,158,181,.2);border-radius:14px;overflow:hidden;background:rgba(0,0,0,.14)}.p2-evidence-preview img{width:100%;height:155px;object-fit:cover;display:block}.p2-evidence-preview>div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px}.p2-evidence-preview select{min-width:135px}.p2-metrics{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))!important}@media(max-width:760px){.p2-evidence-row{grid-template-columns:1fr}.p2-evidence-preview img{height:190px}}\n`
}

fs.writeFileSync(appPath, app)
fs.writeFileSync(cssPath, css)
console.log('Applied broker lot sizing, Quick Trade evidence upload, and economic-event proximity warnings.')
