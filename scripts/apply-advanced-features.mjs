import fs from 'node:fs'

const appPath = 'src/App.tsx'
const cssPath = 'src/styles.css'
let app = fs.readFileSync(appPath, 'utf8')
let css = fs.readFileSync(cssPath, 'utf8')

function replaceOnce(oldText, newText, label) {
  if (!app.includes(oldText)) throw new Error(`Patch anchor not found: ${label}`)
  app = app.replace(oldText, newText)
}

if (app.includes("from './AdvancedFeatures'")) {
  console.log('Advanced features are already integrated.')
  process.exit(0)
}

replaceOnce(
  `  BookOpen,\n  Check,`,
  `  BookOpen,\n  CalendarDays,\n  Check,`,
  'CalendarDays icon import',
)
replaceOnce(
  `  TrendingUp,\n  X,`,
  `  TrendingUp,\n  WifiOff,\n  X,`,
  'WifiOff icon import',
)
replaceOnce(
  `import { supabase } from './lib/supabase'\n\ntype View = 'dashboard' | 'strategies' | 'new-trade' | 'journal' | 'analytics'`,
  `import { supabase } from './lib/supabase'\nimport { AdvancedAnalytics, DEFAULT_MISTAKES, ReportsPage, TradeEvidencePanel, exportJournalXlsx } from './AdvancedFeatures'\nimport { cacheJournalSnapshot, clearJournalSnapshot, loadJournalSnapshot } from './lib/offlineCache'\n\ntype View = 'dashboard' | 'strategies' | 'new-trade' | 'journal' | 'analytics' | 'reports'`,
  'feature imports and reports view',
)

replaceOnce(
  `  const [checks, setChecks] = useState<RuleCheck[]>([])\n  const [loading, setLoading] = useState(true)`,
  `  const [checks, setChecks] = useState<RuleCheck[]>([])\n  const [mistakes, setMistakes] = useState<any[]>([])\n  const [images, setImages] = useState<any[]>([])\n  const [offline, setOffline] = useState(!navigator.onLine)\n  const [loading, setLoading] = useState(true)`,
  'extra state',
)

const oldLoadData = `  const loadData = useCallback(async () => {\n    setRefreshing(true)\n    const [strategyResult, ruleResult, tradeResult, checkResult] = await Promise.all([\n      supabase.from('strategies').select('*').order('created_at', { ascending: false }),\n      supabase.from('strategy_rules').select('*').order('sort_order'),\n      supabase.from('trades').select('*').order('trade_date', { ascending: false }).order('created_at', { ascending: false }),\n      supabase.from('trade_rule_checks').select('*').order('rule_sort_order'),\n    ])\n    setStrategies((strategyResult.data || []) as Strategy[])\n    setRules((ruleResult.data || []) as Rule[])\n    setTrades((tradeResult.data || []) as Trade[])\n    setChecks((checkResult.data || []) as RuleCheck[])\n    setLoading(false)\n    setRefreshing(false)\n  }, [])\n\n  useEffect(() => { loadData() }, [loadData])`

const newLoadData = `  const loadData = useCallback(async () => {\n    setRefreshing(true)\n    try {\n      const [strategyResult, ruleResult, tradeResult, checkResult, mistakeResult, imageResult] = await Promise.all([\n        supabase.from('strategies').select('*').order('created_at', { ascending: false }),\n        supabase.from('strategy_rules').select('*').order('sort_order'),\n        supabase.from('trades').select('*').order('trade_date', { ascending: false }).order('created_at', { ascending: false }),\n        supabase.from('trade_rule_checks').select('*').order('rule_sort_order'),\n        supabase.from('trade_mistakes').select('*').order('created_at'),\n        supabase.from('trade_images').select('*').order('created_at'),\n      ])\n      if (strategyResult.error || ruleResult.error || tradeResult.error || checkResult.error) {\n        throw strategyResult.error || ruleResult.error || tradeResult.error || checkResult.error\n      }\n      const nextStrategies = (strategyResult.data || []) as Strategy[]\n      const nextRules = (ruleResult.data || []) as Rule[]\n      const nextTrades = (tradeResult.data || []) as Trade[]\n      const nextChecks = (checkResult.data || []) as RuleCheck[]\n      const nextMistakes = mistakeResult.data || []\n      const nextImages = imageResult.data || []\n      setStrategies(nextStrategies)\n      setRules(nextRules)\n      setTrades(nextTrades)\n      setChecks(nextChecks)\n      setMistakes(nextMistakes)\n      setImages(nextImages)\n      setOffline(false)\n      await cacheJournalSnapshot(user.id, { strategies: nextStrategies, rules: nextRules, trades: nextTrades, checks: nextChecks, mistakes: nextMistakes, images: nextImages })\n    } catch (error) {\n      const cached = await loadJournalSnapshot(user.id).catch(() => null)\n      if (cached) {\n        setStrategies(cached.strategies as Strategy[])\n        setRules(cached.rules as Rule[])\n        setTrades(cached.trades as Trade[])\n        setChecks(cached.checks as RuleCheck[])\n        setMistakes(cached.mistakes as any[])\n        setImages(cached.images as any[])\n        setOffline(true)\n      }\n    } finally {\n      setLoading(false)\n      setRefreshing(false)\n    }\n  }, [user.id])\n\n  useEffect(() => { loadData() }, [loadData])\n  useEffect(() => {\n    const onOnline = () => { setOffline(false); loadData() }\n    const onOffline = () => setOffline(true)\n    window.addEventListener('online', onOnline)\n    window.addEventListener('offline', onOffline)\n    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }\n  }, [loadData])`
replaceOnce(oldLoadData, newLoadData, 'loadData with offline cache')

replaceOnce(
  `  const checksByTrade = useMemo(() => {\n    const map: Record<string, RuleCheck[]> = {}\n    checks.forEach((check) => {\n      if (!map[check.trade_id]) map[check.trade_id] = []\n      map[check.trade_id].push(check)\n    })\n    return map\n  }, [checks])`,
  `  const checksByTrade = useMemo(() => {\n    const map: Record<string, RuleCheck[]> = {}\n    checks.forEach((check) => {\n      if (!map[check.trade_id]) map[check.trade_id] = []\n      map[check.trade_id].push(check)\n    })\n    return map\n  }, [checks])\n  const mistakesByTrade = useMemo(() => {\n    const map: Record<string, any[]> = {}\n    mistakes.forEach((item) => { if (!map[item.trade_id]) map[item.trade_id] = []; map[item.trade_id].push(item) })\n    return map\n  }, [mistakes])\n  const imagesByTrade = useMemo(() => {\n    const map: Record<string, any[]> = {}\n    images.forEach((item) => { if (!map[item.trade_id]) map[item.trade_id] = []; map[item.trade_id].push(item) })\n    return map\n  }, [images])`,
  'extras maps',
)

replaceOnce(
  `    { id: 'analytics', label: 'Analytics', icon: BarChart3 },\n  ]`,
  `    { id: 'analytics', label: 'Analytics', icon: BarChart3 },\n    { id: 'reports', label: 'Reports', icon: CalendarDays },\n  ]`,
  'reports nav',
)

replaceOnce(
  `          <button className="logout-button" onClick={() => supabase.auth.signOut()}><LogOut size={17} />Sign out</button>`,
  `          <button className="logout-button" onClick={async () => { await clearJournalSnapshot(user.id).catch(() => undefined); await supabase.auth.signOut({ scope: 'local' }) }}><LogOut size={17} />Sign out</button>`,
  'privacy-aware signout',
)

replaceOnce(
  `          <div className="topbar-actions">\n            <button className="icon-button" onClick={loadData} title="Refresh data">`,
  `          <div className="topbar-actions">\n            {offline && <span className="offline-badge"><WifiOff size={14} /> Offline cache</span>}\n            <button className="icon-button" onClick={loadData} title="Refresh data">`,
  'offline badge',
)

replaceOnce(
  `              {view === 'journal' && <JournalPage trades={trades} strategyMap={strategyMap} checksByTrade={checksByTrade} onExport={() => exportTradesCSV(trades, strategyMap, checksByTrade)} />}\n              {view === 'analytics' && <AnalyticsPage trades={trades} strategies={strategies} checks={checks} strategyMap={strategyMap} onJson={() => exportBackup(strategies, rules, trades, checks)} />}`,
  `              {view === 'journal' && <JournalPage user={user} trades={trades} strategies={strategies} checks={checks} mistakes={mistakes} images={images} strategyMap={strategyMap} checksByTrade={checksByTrade} mistakesByTrade={mistakesByTrade} imagesByTrade={imagesByTrade} onChanged={loadData} onExport={() => exportTradesCSV(trades, strategyMap, checksByTrade)} onExportXlsx={() => exportJournalXlsx({ trades, strategies, checks, mistakes, images })} />}\n              {view === 'analytics' && <AnalyticsPage trades={trades} strategies={strategies} checks={checks} strategyMap={strategyMap} onJson={() => exportBackup(strategies, rules, trades, checks, mistakes, images)} />}\n              {view === 'reports' && <ReportsPage trades={trades} strategies={strategies} checks={checks} mistakes={mistakes} images={images} />}`,
  'view integrations',
)

replaceOnce(
  `  const [ruleStates, setRuleStates] = useState<Record<string, RuleStatus>>({})\n  const [busy, setBusy] = useState(false)`,
  `  const [ruleStates, setRuleStates] = useState<Record<string, RuleStatus>>({})\n  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([])\n  const [customMistake, setCustomMistake] = useState('')\n  const [busy, setBusy] = useState(false)`,
  'mistake state',
)

replaceOnce(
  `  const adherencePreview = useMemo(() => {\n    const values = Object.values(ruleStates)\n    const followed = values.filter((v) => v === 'followed').length\n    const violated = values.filter((v) => v === 'violated').length\n    return followed + violated === 0 ? 0 : (followed / (followed + violated)) * 100\n  }, [ruleStates])\n\n  async function save(e: FormEvent) {`,
  `  const adherencePreview = useMemo(() => {\n    const values = Object.values(ruleStates)\n    const followed = values.filter((v) => v === 'followed').length\n    const violated = values.filter((v) => v === 'violated').length\n    return followed + violated === 0 ? 0 : (followed / (followed + violated)) * 100\n  }, [ruleStates])\n\n  function toggleMistake(mistake: string) {\n    setSelectedMistakes((current) => current.includes(mistake) ? current.filter((item) => item !== mistake) : [...current, mistake])\n  }\n\n  async function save(e: FormEvent) {`,
  'mistake toggle',
)

replaceOnce(
  `      const { error: checkError } = await supabase.from('trade_rule_checks').insert(checkRows)\n      if (checkError) { setError(checkError.message); setBusy(false); return }\n    }\n    setBusy(false)\n    onSaved()`,
  `      const { error: checkError } = await supabase.from('trade_rule_checks').insert(checkRows)\n      if (checkError) { await supabase.from('trades').delete().eq('id', trade.id); setError(checkError.message); setBusy(false); return }\n    }\n    if (selectedMistakes.length) {\n      const mistakeRows = selectedMistakes.map((mistake) => ({ trade_id: trade.id, user_id: user.id, mistake }))\n      const { error: mistakeError } = await supabase.from('trade_mistakes').insert(mistakeRows)\n      if (mistakeError) { await supabase.from('trades').delete().eq('id', trade.id); setError(mistakeError.message); setBusy(false); return }\n    }\n    setBusy(false)\n    onSaved()`,
  'save mistakes with rollback',
)

replaceOnce(
  `      <section className="panel">\n        <PanelHeader title="Journal notes" subtitle="Record what you saw before the result can influence your memory" />`,
  `      <section className="panel">\n        <PanelHeader title="Mistake tracker" subtitle="Tag execution errors separately from strategy-rule compliance" />\n        <div className="mistake-picker">\n          {DEFAULT_MISTAKES.map((mistake) => <button type="button" key={mistake} className={selectedMistakes.includes(mistake) ? 'selected' : ''} onClick={() => toggleMistake(mistake)}>{mistake}</button>)}\n        </div>\n        <div className="custom-mistake-row trade-form-custom-mistake"><input value={customMistake} onChange={(e) => setCustomMistake(e.target.value)} placeholder="Add a custom mistake" /><button type="button" className="secondary-button" disabled={!customMistake.trim()} onClick={() => { const value = customMistake.trim(); if (value && !selectedMistakes.includes(value)) setSelectedMistakes([...selectedMistakes, value]); setCustomMistake('') }}><Plus size={15} /> Add</button></div>\n        {selectedMistakes.length > 0 && <p className="selected-mistake-summary">Selected: {selectedMistakes.join(' · ')}</p>}\n      </section>\n\n      <section className="panel">\n        <PanelHeader title="Journal notes" subtitle="Record what you saw before the result can influence your memory" />`,
  'new trade mistake UI',
)

replaceOnce(
  `function JournalPage({ trades, strategyMap, checksByTrade, onExport }: any) {`,
  `function JournalPage({ user, trades, strategies, checks, mistakes, images, strategyMap, checksByTrade, mistakesByTrade, imagesByTrade, onChanged, onExport, onExportXlsx }: any) {`,
  'journal props',
)

replaceOnce(
  `      <div className="page-heading"><div><span className="eyebrow">EXECUTION HISTORY</span><h1>Trade journal</h1><p>Search, filter and review the evidence behind every result.</p></div><button className="secondary-button" onClick={onExport}><Download size={17} /> Export CSV</button></div>`,
  `      <div className="page-heading"><div><span className="eyebrow">EXECUTION HISTORY</span><h1>Trade journal</h1><p>Search, filter and review the evidence behind every result.</p></div><div className="journal-export-actions"><button className="secondary-button" onClick={onExport}><Download size={17} /> CSV</button><button className="secondary-button" onClick={onExportXlsx}><Download size={17} /> XLSX</button></div></div>`,
  'journal export buttons',
)

replaceOnce(
  `                expanded === trade.id ? <tr className="trade-detail-row" key={\`${'${trade.id}'}-detail\`}><td colSpan={9}><TradeDetails trade={trade} checks={tradeChecks} /></td></tr> : null,`,
  `                expanded === trade.id ? <tr className="trade-detail-row" key={\`${'${trade.id}'}-detail\`}><td colSpan={9}><TradeDetails trade={trade} checks={tradeChecks} /><TradeEvidencePanel trade={trade} images={imagesByTrade[trade.id] || []} mistakes={mistakesByTrade[trade.id] || []} userId={user.id} onChanged={onChanged} /></td></tr> : null,`,
  'journal evidence panel',
)

replaceOnce(
  `      </section>\n    </div>\n  )\n}\n\nfunction calculateMetrics(trades: Trade[], checks: RuleCheck[])`,
  `      </section>\n      <AdvancedAnalytics trades={trades} />\n    </div>\n  )\n}\n\nfunction calculateMetrics(trades: Trade[], checks: RuleCheck[])`,
  'advanced analytics block',
)

replaceOnce(
  `function exportBackup(strategies: Strategy[], rules: Rule[], trades: Trade[], checks: RuleCheck[]) {\n  downloadText(\`trading-journal-backup-\${new Date().toISOString().slice(0,10)}.json\`, JSON.stringify({ exported_at: new Date().toISOString(), strategies, rules, trades, rule_checks: checks }, null, 2), 'application/json')\n}`,
  `function exportBackup(strategies: Strategy[], rules: Rule[], trades: Trade[], checks: RuleCheck[], mistakes: any[], images: any[]) {\n  downloadText(\`trading-journal-backup-\${new Date().toISOString().slice(0,10)}.json\`, JSON.stringify({ exported_at: new Date().toISOString(), strategies, rules, trades, rule_checks: checks, mistakes, images }, null, 2), 'application/json')\n}`,
  'complete JSON backup',
)

const marker = '/* advanced-features-v2 */'
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.offline-badge { display: inline-flex; align-items: center; gap: 6px; color: var(--yellow); background: rgba(255,209,102,.08); border: 1px solid rgba(255,209,102,.2); border-radius: 999px; padding: 7px 10px; font-size: 11px; font-weight: 700; }\n.journal-export-actions, .report-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }\n.report-actions select { width: auto; min-width: 150px; }\n.report-metrics { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }\n.advanced-analytics-stack { display: grid; gap: 18px; }\n.advanced-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }\n.mini-stat { padding: 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); display: grid; gap: 8px; }\n.mini-stat span { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }\n.mini-stat strong { font-size: 22px; }\n.analytics-breakdown-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }\n.compact-analytics-panel h3 { margin-bottom: 15px; }\n.breakdown-table { display: grid; }\n.breakdown-head, .breakdown-row { display: grid; grid-template-columns: minmax(120px, 1fr) 48px 58px 72px; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 12px; }\n.breakdown-head { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }\n.breakdown-row:last-child { border-bottom: 0; }\n.muted-copy { color: var(--muted); font-size: 13px; line-height: 1.6; }\n.panel-title-icon, .evidence-heading { display: flex; align-items: flex-start; gap: 10px; }\n.panel-title-icon svg, .evidence-heading > svg { color: var(--accent); margin-top: 2px; }\n.panel-title-icon h3, .evidence-heading h4 { margin: 0 0 4px; }\n.panel-title-icon p, .evidence-heading p { margin: 0; color: var(--muted); font-size: 11px; }\n.daily-report-list { display: grid; margin-top: 16px; }\n.daily-report-row { display: grid; grid-template-columns: 1fr 80px 70px 75px; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 12px; }\n.mistake-frequency { display: grid; gap: 8px; margin-top: 16px; }\n.mistake-frequency > div { display: flex; justify-content: space-between; gap: 10px; padding: 9px 11px; border-radius: 9px; background: rgba(255,123,123,.06); color: #cbd5df; }\n.mistake-frequency strong { color: var(--red); }\n.mistake-picker, .mistake-chip-grid { display: flex; flex-wrap: wrap; gap: 8px; }\n.mistake-picker button, .mistake-chip-grid button { border: 1px solid #2a3543; background: #111821; color: #aeb9c7; border-radius: 999px; padding: 8px 11px; font-size: 11px; }\n.mistake-picker button.selected { color: #ffd0d0; border-color: rgba(255,123,123,.5); background: var(--red-soft); }\n.trade-form-custom-mistake { margin-top: 14px; max-width: 560px; }\n.selected-mistake-summary { margin: 12px 0 0; color: var(--muted); font-size: 11px; }\n.evidence-panel { display: grid; grid-template-columns: 1.15fr .85fr; gap: 18px; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); }\n.evidence-column { min-width: 0; display: grid; align-content: start; gap: 11px; }\n.evidence-upload-row { display: grid; grid-template-columns: 150px 1fr; gap: 9px; }\n.evidence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }\n.evidence-card { overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: #0a0f16; }\n.evidence-card img, .image-loading { width: 100%; aspect-ratio: 16/10; object-fit: cover; display: grid; place-items: center; color: var(--muted); background: #090e14; }\n.evidence-card > div { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 7px 9px; }\n.evidence-card > div span { color: var(--accent); font-size: 10px; text-transform: uppercase; }\n.evidence-card button, .active-mistakes button { border: 0; background: transparent; color: var(--muted); padding: 2px; }\n.evidence-card p { padding: 0 9px 9px; margin: 0; color: var(--muted); font-size: 10px; }\n.custom-mistake-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }\n.active-mistakes { display: flex; flex-wrap: wrap; gap: 7px; }\n.active-mistakes > span { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 7px 9px; color: #ffd0d0; background: var(--red-soft); border: 1px solid rgba(255,123,123,.18); font-size: 10px; }\n.evidence-error { grid-column: 1 / -1; }\n@media (max-width: 1000px) { .advanced-summary-grid { grid-template-columns: repeat(2, 1fr); } .analytics-breakdown-grid, .evidence-panel { grid-template-columns: 1fr; } }\n@media (max-width: 680px) { .advanced-summary-grid { grid-template-columns: 1fr 1fr; } .evidence-grid { grid-template-columns: 1fr 1fr; } .evidence-upload-row { grid-template-columns: 1fr; } .daily-report-row { grid-template-columns: 1fr 64px 60px; } .daily-report-row span:nth-child(2) { display: none; } .report-actions { width: 100%; } .report-actions select, .report-actions button { flex: 1 1 140px; } .offline-badge { display: none; } }\n`
}

fs.writeFileSync(appPath, app)
fs.writeFileSync(cssPath, css)
console.log('Advanced trading journal features integrated successfully.')
