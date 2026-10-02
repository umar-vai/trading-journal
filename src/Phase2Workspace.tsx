import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, BookOpenCheck, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3,
  GitCompareArrows, LibraryBig, LineChart as LineChartIcon, ListChecks, Plus, RefreshCw,
  AlertTriangle, ImagePlus, Save, Sparkles, Target, TrendingDown, TrendingUp, UploadCloud, WalletCards, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from './lib/supabase'
import './phase2.css'

type Strategy = {
  id: string
  name: string
  status: string
  markets?: string[]
  primary_timeframe?: string | null
  higher_timeframe?: string | null
  preferred_session?: string | null
  current_version?: number
}

type Rule = { id: string; strategy_id: string; rule_text: string; sort_order: number }
type Trade = {
  id: string
  strategy_id?: string | null
  strategy_version?: number | null
  symbol: string
  direction: 'long' | 'short'
  trade_date: string
  entry_time?: string | null
  exit_time?: string | null
  timezone?: string | null
  session?: string | null
  timeframe?: string | null
  higher_timeframe?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  exit_price?: number | null
  risk_percent?: number | null
  account_balance?: number | null
  risk_amount?: number | null
  position_size?: number | null
  planned_rr?: number | null
  actual_r?: number | null
  pnl?: number | null
  result?: string | null
  status?: string | null
  grade?: string | null
  emotion?: string | null
  description?: string | null
  thesis?: string | null
  post_trade_review?: string | null
}
type RuleCheck = { id: string; trade_id: string; rule_text_snapshot: string; status: 'followed' | 'violated' | 'na' }
type Mistake = { id: string; trade_id: string; mistake: string }
type Review = { id: string; period_type: 'daily' | 'weekly'; period_start: string; rating?: number | null; summary?: string | null; lessons?: string | null; next_focus?: string | null; created_at: string }
type PlaybookEntry = {
  id: string; strategy_id?: string | null; source_trade_id?: string | null; title: string; setup_type?: string | null;
  market_conditions?: string | null; entry_model?: string | null; confirmation?: string | null; invalidation?: string | null;
  notes?: string | null; tags?: string[]; created_at: string
}
type EconomicEvent = { id: string; title: string; country: string; impact: string; date: string; forecast?: any; previous?: any; actual?: any }
type ToolTab = 'quick' | 'open' | 'calendar' | 'compare' | 'reviews' | 'correlations' | 'playbook'

const popularPairs = ['XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY','USDCHF','USDCAD','AUDUSD','NZDUSD','GBPJPY','EURJPY','EURGBP','AUDJPY','NAS100','US30','SPX500','GER40','BTCUSD','BTCUSDT','ETHUSD','ETHUSDT']
const timeframes = ['1M','3M','5M','15M','30M','1H','4H','1D','1W']
const tabs: { id: ToolTab; label: string; icon: any }[] = [
  { id: 'quick', label: 'Quick Trade', icon: Sparkles },
  { id: 'open', label: 'Open Trades', icon: Clock3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'compare', label: 'Compare', icon: GitCompareArrows },
  { id: 'reviews', label: 'Reviews', icon: BookOpenCheck },
  { id: 'correlations', label: 'Correlations', icon: LineChartIcon },
  { id: 'playbook', label: 'Playbook', icon: LibraryBig },
]

function n(value: any) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}
function f(value: any, digits = 2) { const num = n(value); return num == null ? '—' : num.toFixed(digits) }
function signed(value: any, suffix = '') { const num = n(value); return num == null ? '—' : `${num >= 0 ? '+' : ''}${num.toFixed(2)}${suffix}` }
function today() { return new Date().toISOString().slice(0, 10) }
function nowTime() { return new Date().toTimeString().slice(0, 5) }
function resultFromR(r: number | null) { return r == null ? 'open' : r > 0.05 ? 'win' : r < -0.05 ? 'loss' : 'breakeven' }
function actualR(direction: string, entry: any, stop: any, exit: any) {
  const e = n(entry), s = n(stop), x = n(exit)
  if (e == null || s == null || x == null || e === s) return null
  const risk = Math.abs(e - s)
  return direction === 'short' ? (e - x) / risk : (x - e) / risk
}
function plannedRR(entry: any, stop: any, target: any) {
  const e = n(entry), s = n(stop), t = n(target)
  if (e == null || s == null || t == null || e === s) return null
  return Math.abs(t - e) / Math.abs(e - s)
}
function detectSession() {
  const h = new Date().getUTCHours()
  if (h < 7) return 'Asian'
  if (h < 12) return 'London'
  if (h < 16) return 'London / New York Overlap'
  if (h < 21) return 'New York'
  return 'Other'
}
function weekStart(input: string) {
  const d = new Date(`${input}T12:00:00`)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}
function addDays(input: string, amount: number) {
  const d = new Date(`${input}T12:00:00`); d.setDate(d.getDate() + amount); return d.toISOString().slice(0, 10)
}
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }

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
  const entry = new Date(`${date}T${time}:00`)
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

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="p2-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

export default function Phase2Workspace() {
  const [session, setSession] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ToolTab>('quick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [checks, setChecks] = useState<RuleCheck[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [playbook, setPlaybook] = useState<PlaybookEntry[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [quickSeed, setQuickSeed] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!session?.user?.id) return
    setBusy(true); setError('')
    const [s, r, t, c, m, rv, pb, pr] = await Promise.all([
      supabase.from('strategies').select('id,name,status,markets,primary_timeframe,higher_timeframe,preferred_session,current_version').order('created_at'),
      supabase.from('strategy_rules').select('id,strategy_id,rule_text,sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('trades').select('*').order('trade_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('trade_rule_checks').select('id,trade_id,rule_text_snapshot,status'),
      supabase.from('trade_mistakes').select('id,trade_id,mistake'),
      supabase.from('journal_reviews').select('*').order('period_start', { ascending: false }),
      supabase.from('playbook_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
    ])
    const firstError = [s.error, r.error, t.error, c.error, m.error, rv.error, pb.error, pr.error].find(Boolean)
    if (firstError) setError(firstError.message)
    setStrategies((s.data || []) as Strategy[]); setRules((r.data || []) as Rule[]); setTrades((t.data || []) as Trade[])
    setChecks((c.data || []) as RuleCheck[]); setMistakes((m.data || []) as Mistake[]); setReviews((rv.data || []) as Review[])
    setPlaybook((pb.data || []) as PlaybookEntry[]); setProfile(pr.data || null); setBusy(false)
  }, [session?.user?.id])

  useEffect(() => { if (open && session) refresh() }, [open, session, refresh])
  if (!session) return null

  const strategyMap = Object.fromEntries(strategies.map((s) => [s.id, s]))
  const openCount = trades.filter((t) => t.status === 'open' || t.result === 'open').length

  function launchFromPlaybook(entry: PlaybookEntry) {
    const source = trades.find((t) => t.id === entry.source_trade_id)
    setQuickSeed({ strategy_id: entry.strategy_id || source?.strategy_id || '', symbol: source?.symbol || '', timeframe: source?.timeframe || '' })
    setTab('quick')
  }

  return <>
    <button className="p2-launcher" onClick={() => setOpen(true)} title="Open trading workflow tools">
      <Sparkles size={18} /><span>Trade tools</span>{openCount > 0 && <b>{openCount}</b>}
    </button>
    {open && <div className="p2-overlay" role="dialog" aria-modal="true">
      <div className="p2-workspace">
        <header className="p2-header">
          <div><span>TRADING OPERATING SYSTEM</span><h2>{tabs.find((item) => item.id === tab)?.label}</h2></div>
          <div className="p2-header-actions"><button onClick={refresh} className="p2-icon" title="Refresh"><RefreshCw size={17} className={busy ? 'spin' : ''} /></button><button onClick={() => setOpen(false)} className="p2-icon"><X size={19} /></button></div>
        </header>
        <div className="p2-body">
          <nav className="p2-tabs">
            {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={17}/><span>{item.label}</span>{item.id === 'open' && openCount > 0 && <em>{openCount}</em>}</button> })}
          </nav>
          <main className="p2-content">
            {error && <div className="p2-alert">{error}</div>}
            {tab === 'quick' && <QuickTrade userId={session.user.id} strategies={strategies} rules={rules} profile={profile} seed={quickSeed} onSaved={refresh} />}
            {tab === 'open' && <OpenTrades trades={trades} strategyMap={strategyMap} onChanged={refresh} />}
            {tab === 'calendar' && <CalendarHub trades={trades} strategyMap={strategyMap} />}
            {tab === 'compare' && <StrategyCompare trades={trades} strategies={strategies} checks={checks} />}
            {tab === 'reviews' && <ReviewCenter userId={session.user.id} trades={trades} strategies={strategies} checks={checks} mistakes={mistakes} reviews={reviews} onChanged={refresh} />}
            {tab === 'correlations' && <CorrelationPanel trades={trades} checks={checks} mistakes={mistakes} />}
            {tab === 'playbook' && <Playbook userId={session.user.id} entries={playbook} strategies={strategies} trades={trades} onChanged={refresh} onTrade={launchFromPlaybook} />}
          </main>
        </div>
      </div>
    </div>}
  </>
}

function QuickTrade({ userId, strategies, rules, profile, seed, onSaved }: any) {
  const active = strategies.filter((s: Strategy) => s.status !== 'archived')
  const first = active[0]
  const [form, setForm] = useState<any>({ strategy_id: first?.id || '', symbol: first?.markets?.[0] || 'XAUUSD', direction: 'long', trade_date: today(), entry_time: nowTime(), session: detectSession(), timeframe: first?.primary_timeframe || '5M', entry_price: '', stop_loss: '', take_profit: '', exit_price: '', account_balance: profile?.default_account_balance || '', risk_percent: profile?.default_risk_percent || 1, quote_to_account_rate: '', pnl: '', note: '' })
  const [ruleStates, setRuleStates] = useState<Record<string, 'followed' | 'violated' | 'na'>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceType, setEvidenceType] = useState<'before' | 'entry' | 'chart'>('entry')
  const [evidencePreview, setEvidencePreview] = useState('')
  const [calendarEvents, setCalendarEvents] = useState<EconomicEvent[]>([])
  const [calendarMessage, setCalendarMessage] = useState('')

  useEffect(() => { if (profile) setForm((p: any) => ({ ...p, account_balance: p.account_balance || profile.default_account_balance || '', risk_percent: p.risk_percent || profile.default_risk_percent || 1 })) }, [profile])
  useEffect(() => { if (seed) setForm((p: any) => ({ ...p, strategy_id: seed.strategy_id || p.strategy_id, symbol: seed.symbol || p.symbol, timeframe: seed.timeframe || p.timeframe })) }, [seed])
  useEffect(() => {
    supabase.functions.invoke('economic-calendar', { body: {} }).then(({ data, error }) => {
      if (error || data?.error) setCalendarMessage('Economic calendar is temporarily unavailable.')
      else setCalendarEvents(Array.isArray(data?.events) ? data.events : [])
    })
  }, [])
  useEffect(() => {
    if (!evidenceFile) { setEvidencePreview(''); return }
    const url = URL.createObjectURL(evidenceFile); setEvidencePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [evidenceFile])
  const strategy = active.find((s: Strategy) => s.id === form.strategy_id)
  const strategyRules = rules.filter((r: Rule) => r.strategy_id === form.strategy_id)
  useEffect(() => { const next: any = {}; strategyRules.forEach((r: Rule) => next[r.id] = 'na'); setRuleStates(next); setForm((p: any) => ({ ...p, symbol: strategy?.markets?.[0] || p.symbol || 'XAUUSD', timeframe: strategy?.primary_timeframe || p.timeframe, session: strategy?.preferred_session || p.session })) }, [form.strategy_id])

  const rr = plannedRR(form.entry_price, form.stop_loss, form.take_profit)
  const liveR = actualR(form.direction, form.entry_price, form.stop_loss, form.exit_price)
  const balance = n(form.account_balance), riskPct = n(form.risk_percent), entry = n(form.entry_price), stop = n(form.stop_loss)
  const riskAmount = balance != null && riskPct != null ? balance * riskPct / 100 : null
  const accountCurrency = String(profile?.currency || 'USD').toUpperCase()
  const sizing = brokerLotSizing(form.symbol, form.entry_price, form.stop_loss, riskAmount, accountCurrency, form.quote_to_account_rate)
  const positionSize = sizing.lotSize
  const nearbyEvents = useMemo(() => nearbyEconomicEvents(calendarEvents, form.symbol, form.trade_date, form.entry_time), [calendarEvents, form.symbol, form.trade_date, form.entry_time])
  const pairs = Array.from(new Set([...(strategy?.markets || []), ...popularPairs]))

  function markAll(status: 'followed' | 'na') { const next: any = {}; strategyRules.forEach((r: Rule) => next[r.id] = status); setRuleStates(next) }
  function acceptEvidence(file: File | null | undefined) {
    if (!file) return
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { setMessage('Screenshot must be PNG, JPG or WEBP.'); return }
    if (file.size > 10 * 1024 * 1024) { setMessage('Screenshot must be 10 MB or smaller.'); return }
    setEvidenceFile(file); setMessage('')
  }
  function handleEvidencePaste(event: any) {
    const file = Array.from(event.clipboardData?.files || []).find((item: any) => String(item.type || '').startsWith('image/')) as File | undefined
    if (file) { event.preventDefault(); acceptEvidence(file) }
  }

  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setMessage('')
    if (!form.strategy_id || !form.symbol || entry == null || stop == null) { setMessage('Strategy, symbol, entry and stop loss are required.'); setSaving(false); return }
    const closed = n(form.exit_price) != null
    const result = closed ? resultFromR(liveR) : 'open'
    const payload: any = {
      user_id: userId, strategy_id: form.strategy_id, strategy_version: strategy?.current_version || 1,
      symbol: String(form.symbol).toUpperCase(), direction: form.direction, trade_date: form.trade_date,
      entry_time: form.entry_time || null, exit_time: closed ? nowTime() : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka', session: form.session || null,
      timeframe: form.timeframe || null, higher_timeframe: strategy?.higher_timeframe || null,
      entry_price: entry, stop_loss: stop, take_profit: n(form.take_profit), exit_price: n(form.exit_price),
      account_balance: balance, risk_percent: riskPct, risk_amount: riskAmount, position_size: positionSize,
      planned_rr: rr, actual_r: liveR, pnl: n(form.pnl), result, status: closed ? 'closed' : 'open',
      description: form.note?.trim() || null,
    }
    const { data: trade, error } = await supabase.from('trades').insert(payload).select('id').single()
    if (error) { setMessage(error.message); setSaving(false); return }
    if (strategyRules.length) {
      const rows = strategyRules.map((r: Rule) => ({ trade_id: trade.id, user_id: userId, rule_id: r.id, rule_text_snapshot: r.rule_text, rule_sort_order: r.sort_order, status: ruleStates[r.id] || 'na' }))
      const { error: checkError } = await supabase.from('trade_rule_checks').insert(rows)
      if (checkError) { await supabase.from('trades').delete().eq('id', trade.id); setMessage(checkError.message); setSaving(false); return }
    }
    let evidenceWarning = ''
    if (evidenceFile) {
      const extension = evidenceFile.type === 'image/png' ? 'png' : evidenceFile.type === 'image/webp' ? 'webp' : 'jpg'
      const bucketPath = `${userId}/${trade.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('trade-screenshots').upload(bucketPath, evidenceFile, { contentType: evidenceFile.type, upsert: false })
      if (uploadError) evidenceWarning = ` Screenshot upload failed: ${uploadError.message}`
      else {
        const { error: imageError } = await supabase.from('trade_images').insert({ trade_id: trade.id, user_id: userId, bucket_path: bucketPath, image_type: evidenceType, notes: 'Added from Quick Trade' })
        if (imageError) { await supabase.storage.from('trade-screenshots').remove([bucketPath]); evidenceWarning = ` Screenshot metadata failed: ${imageError.message}` }
      }
    }
    await supabase.from('profiles').update({ default_account_balance: balance, default_risk_percent: riskPct || 1 }).eq('id', userId)
    setMessage((closed ? `Closed trade saved at ${signed(liveR, 'R')}.` : 'Open trade saved. Close it later from Open Trades.') + evidenceWarning)
    setForm((p: any) => ({ ...p, trade_date: today(), entry_time: nowTime(), entry_price: '', stop_loss: '', take_profit: '', exit_price: '', quote_to_account_rate: '', pnl: '', note: '' }))
    setEvidenceFile(null)
    setSaving(false); onSaved()
  }

  if (!active.length) return <Empty text="Create an active strategy first." />
  return <form className="p2-stack" onSubmit={save}>
    <div className="p2-intro"><div><span>15–30 SECOND ENTRY</span><h1>Quick Trade</h1><p>Enter the minimum data now. Outcome and review can be completed later.</p></div><button type="button" className="p2-secondary" onClick={() => markAll('followed')}><Check size={15}/> Mark rules followed</button></div>
    <section className="p2-card"><div className="p2-grid p2-grid-4">
      <label>Strategy<select value={form.strategy_id} onChange={(e) => setForm({ ...form, strategy_id: e.target.value })}>{active.map((s: Strategy) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Pair<select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}>{pairs.map((p) => <option key={p}>{p}</option>)}</select></label>
      <label>Direction<select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}><option value="long">Long</option><option value="short">Short</option></select></label>
      <label>Timeframe<select value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })}>{timeframes.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>Date<input type="date" value={form.trade_date} onChange={(e) => setForm({ ...form, trade_date: e.target.value })}/></label>
      <label>Entry time<input type="time" value={form.entry_time} onChange={(e) => setForm({ ...form, entry_time: e.target.value })}/></label>
      <label>Session<select value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })}><option>Asian</option><option>London</option><option>New York</option><option>London / New York Overlap</option><option>Other</option></select></label>
      <label>Account balance<input type="number" step="0.01" value={form.account_balance} onChange={(e) => setForm({ ...form, account_balance: e.target.value })} placeholder="10000"/></label>
    </div></section>
    <section className="p2-card"><div className="p2-section-title"><div><h3>Broker-aware risk calculator</h3><p>Forex and Gold use standard contract sizing. Broker-specific instruments stay un-sized until their contract spec is known.</p></div></div><div className="p2-grid p2-grid-4">
      <label>Entry<input required type="number" step="any" value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: e.target.value })}/></label>
      <label>Stop loss<input required type="number" step="any" value={form.stop_loss} onChange={(e) => setForm({ ...form, stop_loss: e.target.value })}/></label>
      <label>Take profit<input type="number" step="any" value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: e.target.value })}/></label>
      <label>Risk %<input type="number" min="0" step="0.01" value={form.risk_percent} onChange={(e) => setForm({ ...form, risk_percent: e.target.value })}/></label>
      {sizing.needsConversion && <label>Quote → {accountCurrency} rate<input type="number" min="0" step="any" value={form.quote_to_account_rate} onChange={(e) => setForm({ ...form, quote_to_account_rate: e.target.value })} placeholder="1 quote currency in account currency"/><small>Needed for cross-currency pip value</small></label>}
      <label>Exit price <small>optional</small><input type="number" step="any" value={form.exit_price} onChange={(e) => setForm({ ...form, exit_price: e.target.value })}/></label>
      <label>P/L amount <small>optional</small><input type="number" step="0.01" value={form.pnl} onChange={(e) => setForm({ ...form, pnl: e.target.value })}/></label>
      <label className="p2-span-2">Quick note<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="What did you see?"/></label>
    </div><div className="p2-metrics"><Metric label="Planned RR" value={rr == null ? '—' : `1 : ${rr.toFixed(2)}`}/><Metric label="Risk amount" value={riskAmount == null ? '—' : `${riskAmount.toFixed(2)} ${accountCurrency}`}/><Metric label="Lot size" value={positionSize == null ? '—' : positionSize.toFixed(3)} detail={sizing.detail}/><Metric label="Stop distance" value={sizing.stopLabel}/><Metric label="Realized R" value={liveR == null ? 'Open' : signed(liveR, 'R')}/></div>{!sizing.exact && entry != null && stop != null && riskAmount != null && <div className="p2-sizing-warning"><AlertTriangle size={15}/><span>{sizing.detail}. The trade can still be journaled, but no broker lot size will be stored.</span></div>}</section>
    <section className="p2-card p2-news-proximity"><div className="p2-section-title"><div><h3>Economic-news proximity</h3><p>High/medium-impact events within ±60 minutes of your planned entry.</p></div></div>{calendarMessage ? <div className="p2-muted">{calendarMessage}</div> : nearbyEvents.length ? <div className="p2-news-warning-list">{nearbyEvents.slice(0,4).map((event: any) => <div className={`p2-news-warning ${event.impact}`} key={event.id}><AlertTriangle size={16}/><div><strong>{event.country} · {event.title}</strong><span>{event.deltaMinutes === 0 ? 'At entry time' : event.deltaMinutes > 0 ? `${event.deltaMinutes} min after entry` : `${Math.abs(event.deltaMinutes)} min before entry`} · {String(event.impact).toUpperCase()} impact</span></div></div>)}</div> : <div className="p2-news-clear"><Check size={15}/> No high/medium relevant event found within ±60 minutes.</div>}</section>
    <section className="p2-card"><div className="p2-section-title"><div><h3>Chart evidence</h3><p>Paste a screenshot with Ctrl/Cmd+V or choose an image. It uploads only after the trade is saved.</p></div></div><div className="p2-evidence-row"><div className="p2-evidence-drop" tabIndex={0} onPaste={handleEvidencePaste}><UploadCloud size={24}/><strong>{evidenceFile ? evidenceFile.name : 'Paste or choose screenshot'}</strong><span>PNG, JPG or WEBP · max 10 MB</span><label className="p2-secondary p2-file-button"><ImagePlus size={15}/> Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => acceptEvidence(e.target.files?.[0])}/></label></div>{evidencePreview && <div className="p2-evidence-preview"><img src={evidencePreview} alt="Trade evidence preview"/><div><select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value as any)}><option value="before">Before entry</option><option value="entry">Entry chart</option><option value="chart">General chart</option></select><button type="button" className="p2-text danger" onClick={() => setEvidenceFile(null)}>Remove</button></div></div>}</div></section>
    <section className="p2-card"><div className="p2-section-title"><div><h3>Rule check</h3><p>Use only the rules that matter for this strategy.</p></div><button type="button" className="p2-text" onClick={() => markAll('na')}>Reset</button></div><div className="p2-rule-list">{strategyRules.map((r: Rule, i: number) => <div className="p2-rule" key={r.id}><span>{i + 1}</span><strong>{r.rule_text}</strong><div><button type="button" className={ruleStates[r.id] === 'followed' ? 'good active' : ''} onClick={() => setRuleStates({ ...ruleStates, [r.id]: 'followed' })}><Check size={14}/></button><button type="button" className={ruleStates[r.id] === 'violated' ? 'bad active' : ''} onClick={() => setRuleStates({ ...ruleStates, [r.id]: 'violated' })}><X size={14}/></button><button type="button" className={ruleStates[r.id] === 'na' ? 'active' : ''} onClick={() => setRuleStates({ ...ruleStates, [r.id]: 'na' })}>N/A</button></div></div>)}</div></section>
    {message && <div className="p2-info">{message}</div>}
    <div className="p2-sticky"><div><strong>{strategy?.name}</strong><span>{n(form.exit_price) == null ? 'Will be saved as an open trade' : `Will close as ${resultFromR(liveR)}`}</span></div><button className="p2-primary" disabled={saving}>{saving ? <RefreshCw className="spin" size={16}/> : <Save size={16}/>} {n(form.exit_price) == null ? 'Save open trade' : 'Save closed trade'}</button></div>
  </form>
}

function OpenTrades({ trades, strategyMap, onChanged }: any) {
  const open = trades.filter((t: Trade) => t.status === 'open' || t.result === 'open')
  const [editing, setEditing] = useState<string | null>(null)
  const [closeForm, setCloseForm] = useState<any>({ exit_price: '', exit_time: nowTime(), pnl: '', review: '' })
  const [message, setMessage] = useState('')

  async function closeTrade(trade: Trade) {
    const r = actualR(trade.direction, trade.entry_price, trade.stop_loss, closeForm.exit_price)
    if (r == null) { setMessage('Exit price, entry and stop are required to calculate R.'); return }
    const { error } = await supabase.from('trades').update({ exit_price: Number(closeForm.exit_price), exit_time: closeForm.exit_time || nowTime(), actual_r: r, result: resultFromR(r), status: 'closed', pnl: n(closeForm.pnl), post_trade_review: closeForm.review?.trim() || null }).eq('id', trade.id)
    if (error) setMessage(error.message); else { setMessage(`Trade closed at ${signed(r, 'R')}.`); setEditing(null); setCloseForm({ exit_price: '', exit_time: nowTime(), pnl: '', review: '' }); onChanged() }
  }
  async function cancelTrade(id: string) { await supabase.from('trades').update({ status: 'cancelled', result: 'cancelled' }).eq('id', id); onChanged() }

  return <div className="p2-stack"><div className="p2-intro"><div><span>OPEN → CLOSED WORKFLOW</span><h1>Open trades</h1><p>Keep entry capture fast, then finish the result when the trade is actually over.</p></div></div>{message && <div className="p2-info">{message}</div>}{!open.length ? <Empty text="No open trades. Quick Trade will place unfinished trades here."/> : <div className="p2-open-list">{open.map((trade: Trade) => { const live = editing === trade.id ? actualR(trade.direction, trade.entry_price, trade.stop_loss, closeForm.exit_price) : null; return <article className="p2-card p2-open-card" key={trade.id}><div className="p2-open-head"><div><strong>{trade.symbol}</strong><span>{strategyMap[trade.strategy_id || '']?.name || 'No strategy'} · {trade.trade_date} {trade.entry_time?.slice(0,5)}</span></div><b className={trade.direction === 'long' ? 'up' : 'down'}>{trade.direction.toUpperCase()}</b></div><div className="p2-mini-grid"><span>Entry <b>{f(trade.entry_price, 4)}</b></span><span>SL <b>{f(trade.stop_loss, 4)}</b></span><span>TP <b>{f(trade.take_profit, 4)}</b></span><span>Plan <b>{trade.planned_rr ? `1:${f(trade.planned_rr)}` : '—'}</b></span></div>{editing !== trade.id ? <div className="p2-actions"><button className="p2-primary" onClick={() => setEditing(trade.id)}>Close trade</button><button className="p2-text danger" onClick={() => cancelTrade(trade.id)}>Cancel</button></div> : <div className="p2-close-box"><div className="p2-grid p2-grid-4"><label>Exit price<input autoFocus type="number" step="any" value={closeForm.exit_price} onChange={(e) => setCloseForm({ ...closeForm, exit_price: e.target.value })}/></label><label>Exit time<input type="time" value={closeForm.exit_time} onChange={(e) => setCloseForm({ ...closeForm, exit_time: e.target.value })}/></label><label>P/L amount<input type="number" step="0.01" value={closeForm.pnl} onChange={(e) => setCloseForm({ ...closeForm, pnl: e.target.value })}/></label><Metric label="Calculated R" value={live == null ? '—' : signed(live, 'R')}/><label className="p2-span-4">Post-trade review<textarea value={closeForm.review} onChange={(e) => setCloseForm({ ...closeForm, review: e.target.value })} placeholder="What happened and what did you learn?"/></label></div><div className="p2-actions"><button className="p2-secondary" onClick={() => setEditing(null)}>Back</button><button className="p2-primary" onClick={() => closeTrade(trade)}>Confirm close</button></div></div>}</article> })}</div>}</div>
}

function CalendarHub({ trades, strategyMap }: any) {
  const [month, setMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(today())
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [calendarError, setCalendarError] = useState('')
  const [impact, setImpact] = useState('high')
  const [currency, setCurrency] = useState('all')

  useEffect(() => { supabase.functions.invoke('economic-calendar', { body: {} }).then(({ data, error }) => { if (error || data?.error) setCalendarError(data?.error || error?.message || 'Calendar unavailable'); else setEvents(data?.events || []) }) }, [])
  const key = monthKey(month)
  const monthTrades = trades.filter((t: Trade) => t.trade_date?.startsWith(key))
  const byDate = useMemo(() => { const map: Record<string, Trade[]> = {}; monthTrades.forEach((t: Trade) => { (map[t.trade_date] ||= []).push(t) }); return map }, [monthTrades])
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const cells: (string | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(`${key}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  const curve = useMemo(() => { let r = 0, pnl = 0; return [...trades].filter((t: Trade) => n(t.actual_r) != null || n(t.pnl) != null).sort((a: Trade,b: Trade) => `${a.trade_date}${a.entry_time||''}`.localeCompare(`${b.trade_date}${b.entry_time||''}`)).map((t: Trade, i: number) => { r += n(t.actual_r) || 0; pnl += n(t.pnl) || 0; return { x: i + 1, r: Number(r.toFixed(2)), pnl: Number(pnl.toFixed(2)) } }) }, [trades])
  const selected = byDate[selectedDate] || []
  const currencies = Array.from(new Set(events.map((e) => e.country).filter(Boolean))).sort()
  const filteredEvents = events.filter((e) => (impact === 'all' || e.impact === impact) && (currency === 'all' || e.country === currency)).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const monthR = monthTrades.reduce((sum: number,t: Trade) => sum + (n(t.actual_r) || 0), 0)

  function shiftMonth(delta: number) { setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1)) }
  return <div className="p2-stack"><div className="p2-intro"><div><span>TIME + PERFORMANCE CONTEXT</span><h1>Trading calendar</h1><p>See daily execution, cumulative curves and high-impact events in one place.</p></div></div><div className="p2-metrics"><Metric label="Month trades" value={String(monthTrades.length)}/><Metric label="Month Net R" value={signed(monthR,'R')}/><Metric label="Selected day" value={selectedDate}/><Metric label="Selected trades" value={String(selected.length)}/></div>
    <section className="p2-card"><div className="p2-calendar-head"><button className="p2-icon" onClick={() => shiftMonth(-1)}><ChevronLeft size={18}/></button><h3>{month.toLocaleString(undefined,{month:'long',year:'numeric'})}</h3><button className="p2-icon" onClick={() => shiftMonth(1)}><ChevronRight size={18}/></button></div><div className="p2-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d)=><span key={d}>{d}</span>)}</div><div className="p2-calendar-grid">{cells.map((date, i) => { if (!date) return <div className="p2-day empty" key={`e-${i}`}/>; const dayTrades = byDate[date] || []; const net = dayTrades.reduce((s:number,t:Trade)=>s+(n(t.actual_r)||0),0); return <button key={date} className={`p2-day ${selectedDate===date?'selected':''}`} onClick={()=>setSelectedDate(date)}><span>{Number(date.slice(-2))}</span>{dayTrades.length>0 && <><strong className={net>=0?'positive':'negative'}>{signed(net,'R')}</strong><small>{dayTrades.length} trade{dayTrades.length===1?'':'s'}</small></>}</button> })}</div>{selected.length>0 && <div className="p2-day-detail">{selected.map((t:Trade)=><div key={t.id}><strong>{t.symbol}</strong><span>{strategyMap[t.strategy_id||'']?.name || '—'}</span><b className={(n(t.actual_r)||0)>=0?'positive':'negative'}>{signed(t.actual_r,'R')}</b></div>)}</div>}</section>
    <section className="p2-card"><div className="p2-section-title"><div><h3>Equity / R curves</h3><p>R normalizes strategy performance; P/L shows account-impact history.</p></div></div>{curve.length ? <ResponsiveContainer width="100%" height={300}><LineChart data={curve}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="x"/><YAxis/><Tooltip/><Legend/><Line type="monotone" dataKey="r" name="Cumulative R" stroke="currentColor" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="pnl" name="Cumulative P/L" stroke="#6ee7c5" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer> : <Empty text="Close trades with Actual R or P/L to build the curves."/>}</section>
    <section className="p2-card"><div className="p2-section-title"><div><h3>Economic calendar</h3><p>Use this as context around entries, not as a signal.</p></div><div className="p2-inline-filters"><select value={impact} onChange={(e)=>setImpact(e.target.value)}><option value="high">High impact</option><option value="medium">Medium</option><option value="low">Low</option><option value="all">All impact</option></select><select value={currency} onChange={(e)=>setCurrency(e.target.value)}><option value="all">All currencies</option>{currencies.map((c)=><option key={c}>{c}</option>)}</select></div></div>{calendarError && <div className="p2-info">{calendarError}</div>}<div className="p2-event-list">{filteredEvents.slice(0,30).map((e)=><div className="p2-event" key={e.id}><span className={`impact ${e.impact}`}>{e.impact}</span><time>{new Date(e.date).toLocaleString([], {weekday:'short',hour:'2-digit',minute:'2-digit'})}</time><b>{e.country}</b><strong>{e.title}</strong><small>F {e.forecast ?? '—'} · P {e.previous ?? '—'} · A {e.actual ?? '—'}</small></div>)}{!filteredEvents.length && !calendarError && <Empty text="No matching economic events in the current feed."/>}</div></section>
  </div>
}

function StrategyCompare({ trades, strategies, checks }: any) {
  const used = strategies.filter((s: Strategy) => trades.some((t: Trade) => t.strategy_id === s.id))
  const [selected, setSelected] = useState<string[]>(() => used.slice(0,3).map((s:Strategy)=>s.id))
  useEffect(()=>{ if (!selected.length && used.length) setSelected(used.slice(0,3).map((s:Strategy)=>s.id)) }, [used.length])
  const checkMap = useMemo(()=>{ const m:Record<string,RuleCheck[]>={}; checks.forEach((c:RuleCheck)=>(m[c.trade_id] ||= []).push(c)); return m },[checks])
  function metrics(strategy: Strategy) {
    const subset = trades.filter((t:Trade)=>t.strategy_id===strategy.id && ['win','loss','breakeven'].includes(t.result||'')); const decisive=subset.filter((t:Trade)=>['win','loss'].includes(t.result||'')); const rv=subset.map((t:Trade)=>n(t.actual_r)).filter((v:any)=>v!=null) as number[]
    const wins=decisive.filter((t:Trade)=>t.result==='win').length; const positive=rv.filter(v=>v>0), negative=rv.filter(v=>v<0); const net=rv.reduce((a,b)=>a+b,0); const gw=positive.reduce((a,b)=>a+b,0); const gl=Math.abs(negative.reduce((a,b)=>a+b,0)); let peak=0, cum=0, maxDD=0; rv.forEach(v=>{cum+=v; peak=Math.max(peak,cum); maxDD=Math.min(maxDD,cum-peak)})
    const strategyChecks = subset.flatMap((t:Trade)=>checkMap[t.id]||[]).filter(c=>c.status!=='na'); const followed=strategyChecks.filter(c=>c.status==='followed').length
    return { id:strategy.id,name:strategy.name,trades:subset.length,winRate:decisive.length?wins/decisive.length*100:0,net,expectancy:rv.length?net/rv.length:0,avgWin:positive.length?gw/positive.length:0,avgLoss:negative.length?negative.reduce((a,b)=>a+b,0)/negative.length:0,pf:gl?gw/gl:gw>0?99:0,adherence:strategyChecks.length?followed/strategyChecks.length*100:0,maxDD }
  }
  const rows=used.filter((s:Strategy)=>selected.includes(s.id)).map(metrics)
  const chart=rows.map((r:any)=>({name:r.name,expectancy:Number(r.expectancy.toFixed(2)),winRate:Number(r.winRate.toFixed(1))}))
  function toggle(id:string){ setSelected((current)=>current.includes(id)?current.filter(x=>x!==id):current.length<3?[...current,id]:current) }
  return <div className="p2-stack"><div className="p2-intro"><div><span>EDGE VS EDGE</span><h1>Strategy compare</h1><p>Compare up to three strategies using expectancy, drawdown, adherence and sample size—not win rate alone.</p></div></div><section className="p2-card"><div className="p2-chip-row">{used.map((s:Strategy)=><button key={s.id} className={selected.includes(s.id)?'active':''} onClick={()=>toggle(s.id)}>{s.name}</button>)}</div></section>{rows.length ? <><section className="p2-card p2-table-wrap"><table className="p2-table"><thead><tr><th>Strategy</th><th>Trades</th><th>WR</th><th>Net R</th><th>Expectancy</th><th>PF</th><th>Adherence</th><th>Max DD</th><th>Sample</th></tr></thead><tbody>{rows.map((r:any)=><tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.trades}</td><td>{f(r.winRate)}%</td><td className={r.net>=0?'positive':'negative'}>{signed(r.net,'R')}</td><td className={r.expectancy>=0?'positive':'negative'}>{signed(r.expectancy,'R')}</td><td>{r.pf>=99?'∞':f(r.pf)}</td><td>{f(r.adherence,1)}%</td><td className="negative">{signed(r.maxDD,'R')}</td><td>{r.trades<20?'Low':r.trades<50?'Developing':'Stronger'}</td></tr>)}</tbody></table></section><section className="p2-card"><ResponsiveContainer width="100%" height={280}><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Bar dataKey="expectancy" name="Expectancy (R)" fill="currentColor"/><Bar dataKey="winRate" name="Win rate %" fill="#6ee7c5"/></BarChart></ResponsiveContainer></section></> : <Empty text="Log trades under at least one strategy to compare performance."/>}</div>
}

function ReviewCenter({ userId, trades, strategies, checks, mistakes, reviews, onChanged }: any) {
  const [type, setType] = useState<'daily'|'weekly'>('daily'); const [date,setDate]=useState(today()); const start=type==='weekly'?weekStart(date):date; const end=type==='weekly'?addDays(start,6):start
  const subset=trades.filter((t:Trade)=>t.trade_date>=start&&t.trade_date<=end); const decisive=subset.filter((t:Trade)=>['win','loss'].includes(t.result||'')); const wins=decisive.filter((t:Trade)=>t.result==='win').length; const net=subset.reduce((s:number,t:Trade)=>s+(n(t.actual_r)||0),0)
  const ids=new Set(subset.map((t:Trade)=>t.id)); const sc=checks.filter((c:RuleCheck)=>ids.has(c.trade_id)&&c.status!=='na'); const adherence=sc.length?sc.filter((c:RuleCheck)=>c.status==='followed').length/sc.length*100:0; const sm=mistakes.filter((m:Mistake)=>ids.has(m.trade_id)); const mistakeCounts:Record<string,number>={}; sm.forEach((m:Mistake)=>mistakeCounts[m.mistake]=(mistakeCounts[m.mistake]||0)+1); const topMistake=Object.entries(mistakeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'None'
  const strategyStats=strategies.map((s:Strategy)=>({name:s.name,r:subset.filter((t:Trade)=>t.strategy_id===s.id).reduce((a:number,t:Trade)=>a+(n(t.actual_r)||0),0)})).sort((a:any,b:any)=>b.r-a.r); const best=strategyStats[0]?.name||'—'
  const existing=reviews.find((r:Review)=>r.period_type===type&&r.period_start===start)
  const [form,setForm]=useState<any>({rating:4,summary:'',lessons:'',next_focus:''})
  useEffect(()=>setForm(existing?{rating:existing.rating||4,summary:existing.summary||'',lessons:existing.lessons||'',next_focus:existing.next_focus||''}:{rating:4,summary:'',lessons:'',next_focus:''}),[existing?.id,type,start])
  async function save(){ const {error}=await supabase.from('journal_reviews').upsert({user_id:userId,period_type:type,period_start:start,rating:Number(form.rating),summary:form.summary||null,lessons:form.lessons||null,next_focus:form.next_focus||null},{onConflict:'user_id,period_type,period_start'}); if(!error) onChanged() }
  function autoSummary(){ setForm((p:any)=>({...p,summary:`${subset.length} trades, ${signed(net,'R')} net, ${decisive.length?((wins/decisive.length)*100).toFixed(1):'0.0'}% win rate, ${adherence.toFixed(1)}% rule adherence. Best strategy: ${best}. Most common mistake: ${topMistake}.`})) }
  return <div className="p2-stack"><div className="p2-intro"><div><span>FEEDBACK LOOP</span><h1>Daily / Weekly Review</h1><p>Turn raw trades into one clear lesson and one concrete focus for the next session.</p></div></div><section className="p2-card"><div className="p2-review-controls"><div className="p2-segment"><button className={type==='daily'?'active':''} onClick={()=>setType('daily')}>Daily</button><button className={type==='weekly'?'active':''} onClick={()=>setType('weekly')}>Weekly</button></div><input type="date" value={date} onChange={(e)=>setDate(e.target.value)}/><span>{start}{type==='weekly'?` → ${end}`:''}</span></div><div className="p2-metrics"><Metric label="Trades" value={String(subset.length)}/><Metric label="Net R" value={signed(net,'R')}/><Metric label="Win rate" value={`${decisive.length?((wins/decisive.length)*100).toFixed(1):'0.0'}%`}/><Metric label="Adherence" value={`${adherence.toFixed(1)}%`}/><Metric label="Top mistake" value={topMistake}/></div></section><section className="p2-card"><div className="p2-section-title"><div><h3>{existing?'Update review':'Write review'}</h3><p>One concise review is more useful than a long diary you never revisit.</p></div><button className="p2-secondary" onClick={autoSummary}><Sparkles size={15}/> Auto summary</button></div><div className="p2-grid p2-grid-2"><label>Execution rating (1–5)<input type="number" min="1" max="5" value={form.rating} onChange={(e)=>setForm({...form,rating:e.target.value})}/></label><label className="p2-span-2">Summary<textarea value={form.summary} onChange={(e)=>setForm({...form,summary:e.target.value})}/></label><label>What did I learn?<textarea value={form.lessons} onChange={(e)=>setForm({...form,lessons:e.target.value})}/></label><label>Next focus<textarea value={form.next_focus} onChange={(e)=>setForm({...form,next_focus:e.target.value})}/></label></div><div className="p2-actions"><button className="p2-primary" onClick={save}><Save size={15}/> Save review</button></div></section><section className="p2-card"><div className="p2-section-title"><div><h3>Recent reviews</h3><p>Your decision log over time.</p></div></div><div className="p2-review-list">{reviews.slice(0,8).map((r:Review)=><article key={r.id}><div><strong>{r.period_type} · {r.period_start}</strong><span>{'★'.repeat(r.rating||0)}</span></div><p>{r.summary||'No summary.'}</p>{r.next_focus&&<small>Next: {r.next_focus}</small>}</article>)}{!reviews.length&&<Empty text="Your saved reviews will appear here."/>}</div></section></div>
}

function CorrelationPanel({ trades, checks, mistakes }: any) {
  const tradeMap=Object.fromEntries(trades.map((t:Trade)=>[t.id,t])); const expectancy=(items:Trade[])=>{const vals=items.map(t=>n(t.actual_r)).filter((v:any)=>v!=null) as number[];return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}; const wr=(items:Trade[])=>{const d=items.filter(t=>['win','loss'].includes(t.result||''));return d.length?d.filter(t=>t.result==='win').length/d.length*100:0}
  const ruleGroups:Record<string,{label:string;followed:Trade[];violated:Trade[]}>={}; checks.forEach((c:RuleCheck)=>{if(c.status==='na')return;const t=tradeMap[c.trade_id];if(!t||n(t.actual_r)==null)return;const k=c.rule_text_snapshot.toLowerCase().trim();(ruleGroups[k] ||= {label:c.rule_text_snapshot,followed:[],violated:[]})[c.status].push(t)})
  const ruleRows=Object.values(ruleGroups).map(g=>({label:g.label,followed:g.followed.length,violated:g.violated.length,fe:expectancy(g.followed),ve:expectancy(g.violated),delta:expectancy(g.followed)-expectancy(g.violated)})).filter(r=>r.followed+r.violated>=3).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))
  const allWithR=trades.filter((t:Trade)=>n(t.actual_r)!=null); const mistakeNames=Array.from(new Set(mistakes.map((m:Mistake)=>m.mistake))); const mistakeRows=mistakeNames.map(name=>{const ids=new Set(mistakes.filter((m:Mistake)=>m.mistake===name).map((m:Mistake)=>m.trade_id));const withM=allWithR.filter((t:Trade)=>ids.has(t.id));const without=allWithR.filter((t:Trade)=>!ids.has(t.id));return {name,count:withM.length,withExp:expectancy(withM),withoutExp:expectancy(without),withWR:wr(withM),withoutWR:wr(without),cost:expectancy(withM)-expectancy(without)}}).filter(r=>r.count>=2).sort((a,b)=>a.cost-b.cost)
  return <div className="p2-stack"><div className="p2-intro"><div><span>BEHAVIORAL EDGE</span><h1>Rule & mistake correlations</h1><p>These are evidence signals, not proof of causation. Use them to decide what deserves testing.</p></div></div><section className="p2-card p2-table-wrap"><div className="p2-section-title"><div><h3>Rule impact</h3><p>Expectancy when followed versus violated.</p></div></div>{ruleRows.length?<table className="p2-table"><thead><tr><th>Rule</th><th>Followed n</th><th>Followed Exp.</th><th>Violated n</th><th>Violated Exp.</th><th>Delta</th></tr></thead><tbody>{ruleRows.map((r:any)=><tr key={r.label}><td><strong>{r.label}</strong></td><td>{r.followed}</td><td>{signed(r.fe,'R')}</td><td>{r.violated}</td><td>{signed(r.ve,'R')}</td><td className={r.delta>=0?'positive':'negative'}>{signed(r.delta,'R')}</td></tr>)}</tbody></table>:<Empty text="Need at least 3 evaluated observations per rule."/>}</section><section className="p2-card p2-table-wrap"><div className="p2-section-title"><div><h3>Mistake cost</h3><p>Compare trades containing a mistake with your baseline trades.</p></div></div>{mistakeRows.length?<table className="p2-table"><thead><tr><th>Mistake</th><th>Count</th><th>With mistake Exp.</th><th>Without Exp.</th><th>With WR</th><th>Without WR</th><th>Impact</th></tr></thead><tbody>{mistakeRows.map((r:any)=><tr key={r.name}><td><strong>{r.name}</strong></td><td>{r.count}</td><td>{signed(r.withExp,'R')}</td><td>{signed(r.withoutExp,'R')}</td><td>{f(r.withWR,1)}%</td><td>{f(r.withoutWR,1)}%</td><td className={r.cost>=0?'positive':'negative'}>{signed(r.cost,'R')}</td></tr>)}</tbody></table>:<Empty text="Tag the same mistake on at least two trades to estimate its impact."/>}</section></div>
}

function Playbook({ userId, entries, strategies, trades, onChanged, onTrade }: any) {
  const blank={title:'',strategy_id:'',source_trade_id:'',setup_type:'',market_conditions:'',entry_model:'',confirmation:'',invalidation:'',notes:'',tags:''}; const [form,setForm]=useState<any>(blank); const [show,setShow]=useState(false); const [editing,setEditing]=useState<string|null>(null)
  const candidates=trades.filter((t:Trade)=>['win','breakeven'].includes(t.result||'')||((n(t.actual_r)||0)>0)).slice(0,50)
  function edit(e:PlaybookEntry){setEditing(e.id);setShow(true);setForm({title:e.title,strategy_id:e.strategy_id||'',source_trade_id:e.source_trade_id||'',setup_type:e.setup_type||'',market_conditions:e.market_conditions||'',entry_model:e.entry_model||'',confirmation:e.confirmation||'',invalidation:e.invalidation||'',notes:e.notes||'',tags:(e.tags||[]).join(', ')})}
  function chooseTrade(id:string){const t=trades.find((x:Trade)=>x.id===id);setForm((p:any)=>({...p,source_trade_id:id,strategy_id:t?.strategy_id||p.strategy_id,title:p.title||`${t?.symbol||''} A+ setup`,market_conditions:p.market_conditions||t?.description||'',confirmation:p.confirmation||t?.thesis||''}))}
  async function save(){if(!form.title.trim())return;const payload={user_id:userId,title:form.title.trim(),strategy_id:form.strategy_id||null,source_trade_id:form.source_trade_id||null,setup_type:form.setup_type||null,market_conditions:form.market_conditions||null,entry_model:form.entry_model||null,confirmation:form.confirmation||null,invalidation:form.invalidation||null,notes:form.notes||null,tags:form.tags.split(',').map((x:string)=>x.trim()).filter(Boolean)}; if(editing) await supabase.from('playbook_entries').update(payload).eq('id',editing);else await supabase.from('playbook_entries').insert(payload);setShow(false);setEditing(null);setForm(blank);onChanged()}
  async function remove(id:string){await supabase.from('playbook_entries').delete().eq('id',id);onChanged()}
  return <div className="p2-stack"><div className="p2-intro"><div><span>REFERENCE LIBRARY</span><h1>Trade playbook</h1><p>Save your best repeatable setups so the next trade starts from evidence, not memory.</p></div><button className="p2-primary" onClick={()=>{setEditing(null);setForm(blank);setShow(true)}}><Plus size={16}/> Add setup</button></div>{show&&<section className="p2-card"><div className="p2-section-title"><div><h3>{editing?'Edit setup':'New playbook setup'}</h3></div><button className="p2-icon" onClick={()=>setShow(false)}><X size={17}/></button></div><div className="p2-grid p2-grid-2"><label>Title<input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="A+ London sweep"/></label><label>Strategy<select value={form.strategy_id} onChange={(e)=>setForm({...form,strategy_id:e.target.value})}><option value="">No strategy</option>{strategies.map((s:Strategy)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Source trade<select value={form.source_trade_id} onChange={(e)=>chooseTrade(e.target.value)}><option value="">None</option>{candidates.map((t:Trade)=><option key={t.id} value={t.id}>{t.trade_date} · {t.symbol} · {signed(t.actual_r,'R')}</option>)}</select></label><label>Setup type<input value={form.setup_type} onChange={(e)=>setForm({...form,setup_type:e.target.value})} placeholder="Liquidity sweep / FVG / breakout"/></label><label>Market conditions<textarea value={form.market_conditions} onChange={(e)=>setForm({...form,market_conditions:e.target.value})}/></label><label>Entry model<textarea value={form.entry_model} onChange={(e)=>setForm({...form,entry_model:e.target.value})}/></label><label>Confirmation<textarea value={form.confirmation} onChange={(e)=>setForm({...form,confirmation:e.target.value})}/></label><label>Invalidation<textarea value={form.invalidation} onChange={(e)=>setForm({...form,invalidation:e.target.value})}/></label><label className="p2-span-2">Notes<textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label><label className="p2-span-2">Tags<input value={form.tags} onChange={(e)=>setForm({...form,tags:e.target.value})} placeholder="London, Gold, A+"/></label></div><div className="p2-actions"><button className="p2-primary" onClick={save}><Save size={15}/> Save setup</button></div></section>}<div className="p2-playbook-grid">{entries.map((e:PlaybookEntry)=>{const source=trades.find((t:Trade)=>t.id===e.source_trade_id);return <article className="p2-card p2-playbook-card" key={e.id}><div className="p2-playbook-top"><div><span>{strategies.find((s:Strategy)=>s.id===e.strategy_id)?.name||'General setup'}</span><h3>{e.title}</h3></div>{source&&<b>{source.symbol}</b>}</div>{e.setup_type&&<p><strong>Model:</strong> {e.setup_type}</p>}{e.market_conditions&&<p><strong>Condition:</strong> {e.market_conditions}</p>}{e.confirmation&&<p><strong>Confirmation:</strong> {e.confirmation}</p>}{e.invalidation&&<p><strong>Invalidation:</strong> {e.invalidation}</p>}<div className="p2-tag-row">{(e.tags||[]).map(tag=><span key={tag}>{tag}</span>)}</div><div className="p2-actions"><button className="p2-primary" onClick={()=>onTrade(e)}><Sparkles size={14}/> Trade this setup</button><button className="p2-secondary" onClick={()=>edit(e)}>Edit</button><button className="p2-text danger" onClick={()=>remove(e.id)}>Delete</button></div></article>})}{!entries.length&&<Empty text="Save your best setup as a playbook entry, optionally linked to a winning trade."/>}</div></div>
}

function Empty({ text }: { text: string }) { return <div className="p2-empty"><Activity size={22}/><p>{text}</p></div> }
