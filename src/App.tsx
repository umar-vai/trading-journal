import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileJson,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from './lib/supabase'

type View = 'dashboard' | 'strategies' | 'new-trade' | 'journal' | 'analytics'
type RuleStatus = 'followed' | 'violated' | 'na'

type Strategy = {
  id: string
  user_id: string
  name: string
  description?: string | null
  status: 'active' | 'testing' | 'archived'
  markets: string[]
  primary_timeframe?: string | null
  higher_timeframe?: string | null
  min_rr?: number | null
  preferred_session?: string | null
  current_version: number
  created_at: string
}

type Rule = {
  id: string
  strategy_id: string
  user_id: string
  rule_text: string
  sort_order: number
  is_active: boolean
}

type Trade = {
  id: string
  user_id: string
  strategy_id?: string | null
  strategy_version?: number | null
  symbol: string
  direction: 'long' | 'short'
  trade_date: string
  entry_time?: string | null
  exit_time?: string | null
  timezone: string
  session?: string | null
  timeframe?: string | null
  higher_timeframe?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  exit_price?: number | null
  risk_percent?: number | null
  planned_rr?: number | null
  actual_r?: number | null
  pnl?: number | null
  result?: 'win' | 'loss' | 'breakeven' | 'open' | 'cancelled' | null
  status: 'planned' | 'open' | 'closed' | 'cancelled'
  grade?: 'A+' | 'A' | 'B' | 'C' | 'D' | null
  emotion?: string | null
  confidence?: number | null
  description?: string | null
  thesis?: string | null
  post_trade_review?: string | null
  created_at: string
}

type RuleCheck = {
  id: string
  trade_id: string
  rule_id?: string | null
  rule_text_snapshot: string
  rule_sort_order: number
  status: RuleStatus
}

const sessions = ['Asian', 'London', 'New York', 'London / New York Overlap', 'Other']
const timeframes = ['1M', '3M', '5M', '15M', '30M', '1H', '4H', '1D', '1W']
const emotions = ['Calm', 'Focused', 'FOMO', 'Fear', 'Greed', 'Revenge', 'Overconfident', 'Tired', 'Distracted']

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(digits)
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  if (loading) return <FullScreenLoader />
  if (!session) return <AuthScreen />
  return <TradingJournal user={session.user} />
}

function FullScreenLoader() {
  return (
    <div className="full-loader">
      <div className="brand-mark"><Activity size={24} /></div>
      <span>Loading Trading Journal…</span>
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || email.split('@')[0] } },
      })
      if (error) setError(error.message)
      else if (!data.session) setMessage('Account created. Check your email to confirm the account, then sign in.')
    }
    setBusy(false)
  }

  async function resetPassword() {
    if (!email) {
      setError('Enter your email first.')
      return
    }
    setBusy(true)
    setError('')
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) setError(error.message)
    else setMessage('Password reset email sent.')
    setBusy(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark"><TrendingUp size={22} /></div>
          <div>
            <strong>Trading Journal</strong>
            <span>Strategy Performance & Discipline Tracker</span>
          </div>
        </div>
        <div className="auth-copy">
          <span className="eyebrow">PRIVATE TRADING WORKSPACE</span>
          <h1>Build proof around your trading edge.</h1>
          <p>Track strategies, rule compliance, execution quality, R-multiples and the patterns behind your best and worst trades.</p>
          <div className="auth-points">
            <div><ShieldCheck size={18} /><span>Your account data is isolated with database-level RLS.</span></div>
            <div><Target size={18} /><span>Every trade stays linked to its strategy and rule set.</span></div>
            <div><BarChart3 size={18} /><span>Analyze expectancy, profit factor, adherence and strategy performance.</span></div>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit}>
          <div>
            <span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'CREATE WORKSPACE'}</span>
            <h2>{mode === 'login' ? 'Sign in to your journal' : 'Create your account'}</h2>
            <p>{mode === 'login' ? 'Your strategies and trades will be ready where you left them.' : 'Start with a secure personal trading workspace.'}</p>
          </div>
          {mode === 'signup' && (
            <label>
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}
          <button className="primary-button wide" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={18} /> : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          {mode === 'login' && <button className="text-button" type="button" onClick={resetPassword}>Forgot password?</button>}
          <div className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TradingJournal({ user }: { user: any }) {
  const [view, setView] = useState<View>('dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [checks, setChecks] = useState<RuleCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    setRefreshing(true)
    const [strategyResult, ruleResult, tradeResult, checkResult] = await Promise.all([
      supabase.from('strategies').select('*').order('created_at', { ascending: false }),
      supabase.from('strategy_rules').select('*').order('sort_order'),
      supabase.from('trades').select('*').order('trade_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('trade_rule_checks').select('*').order('rule_sort_order'),
    ])
    setStrategies((strategyResult.data || []) as Strategy[])
    setRules((ruleResult.data || []) as Rule[])
    setTrades((tradeResult.data || []) as Trade[])
    setChecks((checkResult.data || []) as RuleCheck[])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const strategyMap = useMemo(() => Object.fromEntries(strategies.map((s) => [s.id, s])), [strategies])
  const rulesByStrategy = useMemo(() => {
    const map: Record<string, Rule[]> = {}
    rules.forEach((rule) => {
      if (!map[rule.strategy_id]) map[rule.strategy_id] = []
      map[rule.strategy_id].push(rule)
    })
    return map
  }, [rules])
  const checksByTrade = useMemo(() => {
    const map: Record<string, RuleCheck[]> = {}
    checks.forEach((check) => {
      if (!map[check.trade_id]) map[check.trade_id] = []
      map[check.trade_id].push(check)
    })
    return map
  }, [checks])

  const metrics = useMemo(() => calculateMetrics(trades, checks), [trades, checks])

  const navItems: { id: View; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'strategies', label: 'Strategies', icon: Target },
    { id: 'new-trade', label: 'New Trade', icon: Plus },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ]

  function navigate(next: View) {
    setView(next)
    setMobileMenu(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><TrendingUp size={20} /></div>
          <div><strong>Trading Journal</strong><span>Edge Tracker</span></div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{(user.email || 'U')[0].toUpperCase()}</div>
            <div><strong>{user.user_metadata?.display_name || user.email?.split('@')[0]}</strong><span>{user.email}</span></div>
          </div>
          <button className="logout-button" onClick={() => supabase.auth.signOut()}><LogOut size={17} />Sign out</button>
        </div>
      </aside>
      {mobileMenu && <div className="mobile-overlay" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu size={20} /></button>
          <div>
            <span className="topbar-kicker">TRADING WORKSPACE</span>
            <h2>{navItems.find((item) => item.id === view)?.label}</h2>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={loadData} title="Refresh data"><RefreshCw className={refreshing ? 'spin' : ''} size={17} /></button>
            <button className="primary-button compact" onClick={() => navigate('new-trade')}><Plus size={17} /> Log trade</button>
          </div>
        </header>

        <div className="page-content">
          {loading ? <SectionLoader /> : (
            <>
              {view === 'dashboard' && <Dashboard metrics={metrics} trades={trades} strategies={strategies} strategyMap={strategyMap} onNewTrade={() => navigate('new-trade')} />}
              {view === 'strategies' && <StrategiesPage user={user} strategies={strategies} rulesByStrategy={rulesByStrategy} onChanged={loadData} />}
              {view === 'new-trade' && <NewTradePage user={user} strategies={strategies} rulesByStrategy={rulesByStrategy} onSaved={() => { loadData(); navigate('journal') }} />}
              {view === 'journal' && <JournalPage trades={trades} strategyMap={strategyMap} checksByTrade={checksByTrade} onExport={() => exportTradesCSV(trades, strategyMap, checksByTrade)} />}
              {view === 'analytics' && <AnalyticsPage trades={trades} strategies={strategies} checks={checks} strategyMap={strategyMap} onJson={() => exportBackup(strategies, rules, trades, checks)} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function SectionLoader() {
  return <div className="section-loader"><RefreshCw className="spin" size={20} /> Loading your journal…</div>
}

function Dashboard({ metrics, trades, strategies, strategyMap, onNewTrade }: any) {
  const recent = trades.slice(0, 6)
  const strategyStats = strategyPerformance(trades, strategies)
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">PERFORMANCE SNAPSHOT</span>
          <h1>Trade the plan. Measure the execution.</h1>
          <p>Your journal separates outcome from process so a lucky win never looks like a good trade.</p>
        </div>
        <button className="primary-button" onClick={onNewTrade}><Plus size={18} /> Log a new trade</button>
      </section>

      <section className="metric-grid">
        <MetricCard label="Total Trades" value={metrics.totalTrades} detail={`${metrics.closedTrades} closed`} icon={BookOpen} />
        <MetricCard label="Win Rate" value={`${metrics.winRate.toFixed(1)}%`} detail={`${metrics.wins} wins / ${metrics.losses} losses`} icon={Target} trend={metrics.winRate >= 50 ? 'up' : 'down'} />
        <MetricCard label="Net R" value={`${metrics.netR >= 0 ? '+' : ''}${metrics.netR.toFixed(2)}R`} detail={`${metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}R expectancy`} icon={metrics.netR >= 0 ? TrendingUp : TrendingDown} trend={metrics.netR >= 0 ? 'up' : 'down'} />
        <MetricCard label="Profit Factor" value={Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞'} detail="Gross wins ÷ gross losses" icon={BarChart3} />
        <MetricCard label="Rule Adherence" value={`${metrics.adherence.toFixed(1)}%`} detail={`${metrics.violations} rule violations`} icon={ShieldCheck} trend={metrics.adherence >= 80 ? 'up' : undefined} />
      </section>

      <section className="two-column">
        <div className="panel">
          <PanelHeader title="Recent trades" subtitle="Your latest executions" />
          {recent.length === 0 ? <EmptyState text="No trades yet. Log your first trade to start the journal." /> : (
            <div className="recent-list">
              {recent.map((trade: Trade) => (
                <div className="recent-row" key={trade.id}>
                  <div className={`direction-badge ${trade.direction}`}>{trade.direction === 'long' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}</div>
                  <div className="recent-main"><strong>{trade.symbol}</strong><span>{strategyMap[trade.strategy_id || '']?.name || 'No strategy'} · {trade.trade_date}</span></div>
                  <ResultPill result={trade.result} />
                  <strong className={(trade.actual_r || 0) >= 0 ? 'positive' : 'negative'}>{trade.actual_r == null ? '—' : `${trade.actual_r >= 0 ? '+' : ''}${formatNumber(trade.actual_r)}R`}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <PanelHeader title="Strategy leaderboard" subtitle="Ranked by expectancy" />
          {strategyStats.length === 0 ? <EmptyState text="Create a strategy and start tagging trades to compare performance." /> : (
            <div className="leaderboard">
              {strategyStats.slice(0, 5).map((row, index) => (
                <div className="leader-row" key={row.id}>
                  <span className="rank">{index + 1}</span>
                  <div><strong>{row.name}</strong><span>{row.trades} trades · {row.winRate.toFixed(1)}% WR</span></div>
                  <strong className={row.expectancy >= 0 ? 'positive' : 'negative'}>{row.expectancy >= 0 ? '+' : ''}{row.expectancy.toFixed(2)}R</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, trend }: any) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span><div className="metric-icon"><Icon size={17} /></div></div>
      <strong className={trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : ''}>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function PanelHeader({ title, subtitle, action }: any) {
  return <div className="panel-header"><div><h3>{title}</h3><p>{subtitle}</p></div>{action}</div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><Activity size={22} /><p>{text}</p></div>
}

function ResultPill({ result }: { result?: string | null }) {
  return <span className={`result-pill ${result || 'open'}`}>{result || 'open'}</span>
}

function StrategiesPage({ user, strategies, rulesByStrategy, onChanged }: any) {
  const emptyForm = {
    name: '', description: '', markets: '', primary_timeframe: '5M', higher_timeframe: '1H', min_rr: '2', preferred_session: 'London', status: 'active', rules: ['', '', ''],
  }
  const [form, setForm] = useState<any>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function startEdit(strategy: Strategy) {
    setEditingId(strategy.id)
    setForm({
      name: strategy.name,
      description: strategy.description || '',
      markets: (strategy.markets || []).join(', '),
      primary_timeframe: strategy.primary_timeframe || '5M',
      higher_timeframe: strategy.higher_timeframe || '1H',
      min_rr: strategy.min_rr ?? '',
      preferred_session: strategy.preferred_session || 'London',
      status: strategy.status,
      rules: (rulesByStrategy[strategy.id] || []).map((r: Rule) => r.rule_text).concat(['']).slice(0, Math.max((rulesByStrategy[strategy.id] || []).length + 1, 3)),
    })
    setShowForm(true)
  }

  function updateRule(index: number, value: string) {
    setForm((prev: any) => ({ ...prev, rules: prev.rules.map((r: string, i: number) => i === index ? value : r) }))
  }

  function addRule() {
    setForm((prev: any) => ({ ...prev, rules: [...prev.rules, ''] }))
  }

  function removeRule(index: number) {
    setForm((prev: any) => ({ ...prev, rules: prev.rules.filter((_: string, i: number) => i !== index) }))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const cleanedRules = form.rules.map((r: string) => r.trim()).filter(Boolean)
    if (!form.name.trim()) { setError('Strategy name is required.'); setBusy(false); return }
    if (cleanedRules.length === 0) { setError('Add at least one rule.'); setBusy(false); return }
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      markets: form.markets.split(',').map((m: string) => m.trim().toUpperCase()).filter(Boolean),
      primary_timeframe: form.primary_timeframe || null,
      higher_timeframe: form.higher_timeframe || null,
      min_rr: form.min_rr === '' ? null : Number(form.min_rr),
      preferred_session: form.preferred_session || null,
      status: form.status,
    }

    if (!editingId) {
      const { data: created, error: strategyError } = await supabase.from('strategies').insert(payload).select('*').single()
      if (strategyError) { setError(strategyError.message); setBusy(false); return }
      const ruleRows = cleanedRules.map((ruleText: string, index: number) => ({ strategy_id: created.id, user_id: user.id, rule_text: ruleText, sort_order: index }))
      const { error: ruleError } = await supabase.from('strategy_rules').insert(ruleRows)
      if (ruleError) { setError(ruleError.message); setBusy(false); return }
      await supabase.from('strategy_versions').insert({
        strategy_id: created.id,
        user_id: user.id,
        version: 1,
        strategy_snapshot: { ...payload, current_version: 1 },
        rules_snapshot: cleanedRules.map((ruleText: string, index: number) => ({ rule_text: ruleText, sort_order: index })),
        change_note: 'Initial strategy version',
      })
    } else {
      const current = strategies.find((s: Strategy) => s.id === editingId)
      const nextVersion = (current?.current_version || 1) + 1
      const { error: updateError } = await supabase.from('strategies').update({ ...payload, current_version: nextVersion }).eq('id', editingId)
      if (updateError) { setError(updateError.message); setBusy(false); return }
      await supabase.from('strategy_rules').delete().eq('strategy_id', editingId)
      const ruleRows = cleanedRules.map((ruleText: string, index: number) => ({ strategy_id: editingId, user_id: user.id, rule_text: ruleText, sort_order: index }))
      const { error: ruleError } = await supabase.from('strategy_rules').insert(ruleRows)
      if (ruleError) { setError(ruleError.message); setBusy(false); return }
      const { error: versionError } = await supabase.from('strategy_versions').insert({
        strategy_id: editingId,
        user_id: user.id,
        version: nextVersion,
        strategy_snapshot: { ...payload, current_version: nextVersion },
        rules_snapshot: cleanedRules.map((ruleText: string, index: number) => ({ rule_text: ruleText, sort_order: index })),
        change_note: `Updated to version ${nextVersion}`,
      })
      if (versionError) { setError(versionError.message); setBusy(false); return }
    }

    setBusy(false)
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    await onChanged()
  }

  async function archive(strategy: Strategy) {
    await supabase.from('strategies').update({ status: strategy.status === 'archived' ? 'active' : 'archived' }).eq('id', strategy.id)
    onChanged()
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><span className="eyebrow">YOUR PLAYBOOK</span><h1>Strategies & rules</h1><p>Define the setup before you judge the result. Editing creates a new strategy version for future trades.</p></div>
        <button className="primary-button" onClick={startCreate}><Plus size={18} /> New strategy</button>
      </div>

      {showForm && (
        <form className="panel strategy-form" onSubmit={save}>
          <PanelHeader title={editingId ? 'Edit strategy' : 'Create strategy'} subtitle={editingId ? 'This change will create a new version.' : 'Start with the setup and its non-negotiable rules.'} action={<button type="button" className="icon-button" onClick={() => setShowForm(false)}><X size={18} /></button>} />
          <div className="form-grid two">
            <label>Strategy name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="London Liquidity Sweep" /></label>
            <label>Markets<input value={form.markets} onChange={(e) => setForm({ ...form, markets: e.target.value })} placeholder="XAUUSD, NAS100" /></label>
            <label>Primary timeframe<select value={form.primary_timeframe} onChange={(e) => setForm({ ...form, primary_timeframe: e.target.value })}>{timeframes.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Higher timeframe<select value={form.higher_timeframe} onChange={(e) => setForm({ ...form, higher_timeframe: e.target.value })}>{timeframes.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Minimum RR<input type="number" min="0" step="0.1" value={form.min_rr} onChange={(e) => setForm({ ...form, min_rr: e.target.value })} /></label>
            <label>Preferred session<select value={form.preferred_session} onChange={(e) => setForm({ ...form, preferred_session: e.target.value })}>{sessions.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="testing">Testing</option><option value="archived">Archived</option></select></label>
            <label className="span-two">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What market condition and setup defines this strategy?" /></label>
          </div>
          <div className="rules-builder">
            <div className="rules-builder-head"><div><h4>Execution rules</h4><p>Each new trade will show these as Followed / Violated / N/A.</p></div><button type="button" className="secondary-button" onClick={addRule}><Plus size={16} /> Add rule</button></div>
            <div className="rule-input-list">
              {form.rules.map((rule: string, index: number) => (
                <div className="rule-input" key={index}><span>{index + 1}</span><input value={rule} onChange={(e) => updateRule(index, e.target.value)} placeholder={`Rule ${index + 1}`} /><button type="button" onClick={() => removeRule(index)}><X size={16} /></button></div>
              ))}
            </div>
          </div>
          {error && <div className="alert error">{error}</div>}
          <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? <RefreshCw className="spin" size={17} /> : <Save size={17} />}{editingId ? 'Save new version' : 'Create strategy'}</button></div>
        </form>
      )}

      <div className="strategy-grid">
        {strategies.length === 0 ? <div className="panel"><EmptyState text="No strategies yet. Create the first strategy and define its rules." /></div> : strategies.map((strategy: Strategy) => {
          const strategyRules = rulesByStrategy[strategy.id] || []
          return (
            <article className={`strategy-card ${strategy.status === 'archived' ? 'archived' : ''}`} key={strategy.id}>
              <div className="strategy-card-top"><div><span className={`status-dot ${strategy.status}`} /> <span className="status-label">{strategy.status}</span></div><span className="version-badge">v{strategy.current_version}.0</span></div>
              <h3>{strategy.name}</h3>
              <p>{strategy.description || 'No description yet.'}</p>
              <div className="strategy-meta"><span>{strategy.primary_timeframe || '—'} entry</span><span>{strategy.higher_timeframe || '—'} HTF</span><span>{strategy.min_rr ? `Min 1:${strategy.min_rr}` : 'RR flexible'}</span></div>
              <div className="rule-preview">
                {strategyRules.slice(0, 4).map((rule: Rule) => <div key={rule.id}><Check size={14} /><span>{rule.rule_text}</span></div>)}
                {strategyRules.length > 4 && <small>+{strategyRules.length - 4} more rules</small>}
              </div>
              <div className="strategy-card-actions"><button className="secondary-button" onClick={() => startEdit(strategy)}>Edit rules</button><button className="text-button" onClick={() => archive(strategy)}>{strategy.status === 'archived' ? 'Restore' : 'Archive'}</button></div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function NewTradePage({ user, strategies, rulesByStrategy, onSaved }: any) {
  const activeStrategies = strategies.filter((s: Strategy) => s.status !== 'archived')
  const [form, setForm] = useState<any>({
    strategy_id: activeStrategies[0]?.id || '', symbol: 'XAUUSD', direction: 'long', trade_date: new Date().toISOString().slice(0, 10), entry_time: new Date().toTimeString().slice(0, 5), exit_time: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka', session: 'London', timeframe: '5M', higher_timeframe: '1H', entry_price: '', stop_loss: '', take_profit: '', exit_price: '', risk_percent: '1', actual_r: '', pnl: '', result: 'win', grade: 'A', emotion: 'Calm', confidence: '4', description: '', thesis: '', post_trade_review: '',
  })
  const [ruleStates, setRuleStates] = useState<Record<string, RuleStatus>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const strategyRules: Rule[] = rulesByStrategy[form.strategy_id] || []
    const next: Record<string, RuleStatus> = {}
    strategyRules.forEach((rule) => { next[rule.id] = 'na' })
    setRuleStates(next)
  }, [form.strategy_id, rulesByStrategy])

  const selectedStrategy = activeStrategies.find((s: Strategy) => s.id === form.strategy_id)
  const strategyRules: Rule[] = rulesByStrategy[form.strategy_id] || []
  const plannedRR = useMemo(() => {
    const entry = Number(form.entry_price), stop = Number(form.stop_loss), target = Number(form.take_profit)
    if (!entry || !stop || !target || entry === stop) return null
    return Math.abs(target - entry) / Math.abs(entry - stop)
  }, [form.entry_price, form.stop_loss, form.take_profit])
  const adherencePreview = useMemo(() => {
    const values = Object.values(ruleStates)
    const followed = values.filter((v) => v === 'followed').length
    const violated = values.filter((v) => v === 'violated').length
    return followed + violated === 0 ? 0 : (followed / (followed + violated)) * 100
  }, [ruleStates])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    if (!form.strategy_id) { setError('Choose a strategy first.'); setBusy(false); return }
    if (!form.symbol.trim()) { setError('Symbol is required.'); setBusy(false); return }
    const status = form.result === 'open' ? 'open' : form.result === 'cancelled' ? 'cancelled' : 'closed'
    const payload: any = {
      user_id: user.id,
      strategy_id: form.strategy_id,
      strategy_version: selectedStrategy?.current_version || 1,
      symbol: form.symbol.trim().toUpperCase(),
      direction: form.direction,
      trade_date: form.trade_date,
      entry_time: form.entry_time || null,
      exit_time: form.exit_time || null,
      timezone: form.timezone || 'Asia/Dhaka',
      session: form.session || null,
      timeframe: form.timeframe || null,
      higher_timeframe: form.higher_timeframe || null,
      entry_price: form.entry_price === '' ? null : Number(form.entry_price),
      stop_loss: form.stop_loss === '' ? null : Number(form.stop_loss),
      take_profit: form.take_profit === '' ? null : Number(form.take_profit),
      exit_price: form.exit_price === '' ? null : Number(form.exit_price),
      risk_percent: form.risk_percent === '' ? null : Number(form.risk_percent),
      planned_rr: plannedRR,
      actual_r: form.actual_r === '' ? null : Number(form.actual_r),
      pnl: form.pnl === '' ? null : Number(form.pnl),
      result: form.result,
      status,
      grade: form.grade || null,
      emotion: form.emotion || null,
      confidence: form.confidence === '' ? null : Number(form.confidence),
      description: form.description.trim() || null,
      thesis: form.thesis.trim() || null,
      post_trade_review: form.post_trade_review.trim() || null,
    }
    const { data: trade, error: tradeError } = await supabase.from('trades').insert(payload).select('*').single()
    if (tradeError) { setError(tradeError.message); setBusy(false); return }
    if (strategyRules.length) {
      const checkRows = strategyRules.map((rule) => ({
        trade_id: trade.id,
        user_id: user.id,
        rule_id: rule.id,
        rule_text_snapshot: rule.rule_text,
        rule_sort_order: rule.sort_order,
        status: ruleStates[rule.id] || 'na',
      }))
      const { error: checkError } = await supabase.from('trade_rule_checks').insert(checkRows)
      if (checkError) { setError(checkError.message); setBusy(false); return }
    }
    setBusy(false)
    onSaved()
  }

  if (activeStrategies.length === 0) {
    return <div className="panel"><EmptyState text="Create at least one active strategy before logging a trade." /></div>
  }

  return (
    <form className="page-stack" onSubmit={save}>
      <div className="page-heading"><div><span className="eyebrow">EXECUTION RECORD</span><h1>Log a trade</h1><p>Capture both the outcome and whether the setup actually followed the plan.</p></div><div className="live-adherence"><span>Rule adherence</span><strong>{adherencePreview.toFixed(0)}%</strong></div></div>

      <section className="panel">
        <PanelHeader title="Trade context" subtitle="Strategy, instrument, time and market session" />
        <div className="form-grid three">
          <label>Strategy<select value={form.strategy_id} onChange={(e) => setForm({ ...form, strategy_id: e.target.value })}>{activeStrategies.map((s: Strategy) => <option key={s.id} value={s.id}>{s.name} · v{s.current_version}.0</option>)}</select></label>
          <label>Symbol<input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="XAUUSD" /></label>
          <label>Direction<select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}><option value="long">Long</option><option value="short">Short</option></select></label>
          <label>Date<input type="date" value={form.trade_date} onChange={(e) => setForm({ ...form, trade_date: e.target.value })} /></label>
          <label>Entry time<input type="time" value={form.entry_time} onChange={(e) => setForm({ ...form, entry_time: e.target.value })} /></label>
          <label>Exit time<input type="time" value={form.exit_time} onChange={(e) => setForm({ ...form, exit_time: e.target.value })} /></label>
          <label>Timezone<input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></label>
          <label>Session<select value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })}>{sessions.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Entry timeframe<select value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })}>{timeframes.map((t) => <option key={t}>{t}</option>)}</select></label>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Rule checklist" subtitle={`${selectedStrategy?.name || ''} · Strategy version ${selectedStrategy?.current_version || 1}`} />
        <div className="checklist">
          {strategyRules.map((rule, index) => (
            <div className="checklist-row" key={rule.id}>
              <div className="rule-copy"><span>{index + 1}</span><strong>{rule.rule_text}</strong></div>
              <div className="tri-toggle">
                <button type="button" className={ruleStates[rule.id] === 'followed' ? 'selected good' : ''} onClick={() => setRuleStates({ ...ruleStates, [rule.id]: 'followed' })}><Check size={15} /> Followed</button>
                <button type="button" className={ruleStates[rule.id] === 'violated' ? 'selected bad' : ''} onClick={() => setRuleStates({ ...ruleStates, [rule.id]: 'violated' })}><X size={15} /> Violated</button>
                <button type="button" className={ruleStates[rule.id] === 'na' ? 'selected neutral' : ''} onClick={() => setRuleStates({ ...ruleStates, [rule.id]: 'na' })}>N/A</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Risk & result" subtitle="R-multiple is the primary normalized performance metric" />
        <div className="form-grid four">
          <label>Entry price<input type="number" step="any" value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: e.target.value })} /></label>
          <label>Stop loss<input type="number" step="any" value={form.stop_loss} onChange={(e) => setForm({ ...form, stop_loss: e.target.value })} /></label>
          <label>Take profit<input type="number" step="any" value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: e.target.value })} /></label>
          <label>Planned RR<input readOnly value={plannedRR ? `1 : ${plannedRR.toFixed(2)}` : ''} placeholder="Auto-calculated" /></label>
          <label>Exit price<input type="number" step="any" value={form.exit_price} onChange={(e) => setForm({ ...form, exit_price: e.target.value })} /></label>
          <label>Risk %<input type="number" step="0.01" value={form.risk_percent} onChange={(e) => setForm({ ...form, risk_percent: e.target.value })} /></label>
          <label>Actual R<input type="number" step="0.01" value={form.actual_r} onChange={(e) => setForm({ ...form, actual_r: e.target.value })} placeholder="e.g. 2.15 or -1" /></label>
          <label>P/L amount<input type="number" step="0.01" value={form.pnl} onChange={(e) => setForm({ ...form, pnl: e.target.value })} placeholder="Optional" /></label>
          <label>Result<select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option><option value="open">Open</option><option value="cancelled">Cancelled</option></select></label>
          <label>Execution grade<select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}><option>A+</option><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
          <label>Emotion<select value={form.emotion} onChange={(e) => setForm({ ...form, emotion: e.target.value })}>{emotions.map((emotion) => <option key={emotion}>{emotion}</option>)}</select></label>
          <label>Confidence (1–5)<input type="number" min="1" max="5" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} /></label>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Journal notes" subtitle="Record what you saw before the result can influence your memory" />
        <div className="form-grid two">
          <label>What did you see?<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="HTF structure, liquidity, context, confluences…" /></label>
          <label>Why did you take the trade?<textarea value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} placeholder="The exact thesis that justified entry…" /></label>
          <label className="span-two">Post-trade review<textarea value={form.post_trade_review} onChange={(e) => setForm({ ...form, post_trade_review: e.target.value })} placeholder="What was done well? What should change next time?" /></label>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}
      <div className="sticky-save"><div><strong>{selectedStrategy?.name}</strong><span>{strategyRules.length} rules · {adherencePreview.toFixed(0)}% adherence</span></div><button className="primary-button" disabled={busy}>{busy ? <RefreshCw className="spin" size={17} /> : <Save size={17} />} Save trade</button></div>
    </form>
  )
}

function JournalPage({ trades, strategyMap, checksByTrade, onExport }: any) {
  const [query, setQuery] = useState('')
  const [strategyFilter, setStrategyFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const strategyOptions = Object.values(strategyMap) as Strategy[]
  const filtered = trades.filter((trade: Trade) => {
    const haystack = `${trade.symbol} ${strategyMap[trade.strategy_id || '']?.name || ''} ${trade.description || ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase()) && (strategyFilter === 'all' || trade.strategy_id === strategyFilter)
  })

  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">EXECUTION HISTORY</span><h1>Trade journal</h1><p>Search, filter and review the evidence behind every result.</p></div><button className="secondary-button" onClick={onExport}><Download size={17} /> Export CSV</button></div>
      <div className="panel journal-panel">
        <div className="filter-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search symbol, strategy or notes…" /><select value={strategyFilter} onChange={(e) => setStrategyFilter(e.target.value)}><option value="all">All strategies</option>{strategyOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        {filtered.length === 0 ? <EmptyState text="No trades match this view." /> : (
          <div className="trade-table-wrap"><table className="trade-table"><thead><tr><th>Date</th><th>Symbol</th><th>Strategy</th><th>Dir.</th><th>Result</th><th>R</th><th>Grade</th><th>Rules</th><th></th></tr></thead><tbody>
            {filtered.map((trade: Trade) => {
              const tradeChecks: RuleCheck[] = checksByTrade[trade.id] || []
              const followed = tradeChecks.filter((c) => c.status === 'followed').length
              const violated = tradeChecks.filter((c) => c.status === 'violated').length
              const adherence = followed + violated ? Math.round((followed / (followed + violated)) * 100) : 0
              return [
                <tr key={trade.id} onClick={() => setExpanded(expanded === trade.id ? null : trade.id)} className="trade-row">
                  <td>{trade.trade_date}<small>{trade.entry_time?.slice(0, 5) || ''}</small></td>
                  <td><strong>{trade.symbol}</strong><small>{trade.session || ''}</small></td>
                  <td>{strategyMap[trade.strategy_id || '']?.name || '—'}<small>v{trade.strategy_version || '—'}.0</small></td>
                  <td><span className={`direction-text ${trade.direction}`}>{trade.direction}</span></td>
                  <td><ResultPill result={trade.result} /></td>
                  <td className={(trade.actual_r || 0) >= 0 ? 'positive' : 'negative'}>{trade.actual_r == null ? '—' : `${trade.actual_r >= 0 ? '+' : ''}${formatNumber(trade.actual_r)}R`}</td>
                  <td>{trade.grade || '—'}</td>
                  <td><span className="adherence-mini">{adherence}%</span></td>
                  <td><ChevronRight className={expanded === trade.id ? 'rotate' : ''} size={17} /></td>
                </tr>,
                expanded === trade.id ? <tr className="trade-detail-row" key={`${trade.id}-detail`}><td colSpan={9}><TradeDetails trade={trade} checks={tradeChecks} /></td></tr> : null,
              ]
            })}
          </tbody></table></div>
        )}
      </div>
    </div>
  )
}

function TradeDetails({ trade, checks }: { trade: Trade; checks: RuleCheck[] }) {
  return (
    <div className="trade-details">
      <div className="detail-grid"><div><span>Entry / SL / TP</span><strong>{formatNumber(trade.entry_price, 3)} / {formatNumber(trade.stop_loss, 3)} / {formatNumber(trade.take_profit, 3)}</strong></div><div><span>Planned RR</span><strong>{trade.planned_rr ? `1:${formatNumber(trade.planned_rr)}` : '—'}</strong></div><div><span>Emotion</span><strong>{trade.emotion || '—'}</strong></div><div><span>Confidence</span><strong>{trade.confidence ? `${trade.confidence}/5` : '—'}</strong></div></div>
      <div className="detail-columns"><div><h4>Rule compliance</h4>{checks.length ? checks.map((check) => <div className={`rule-history ${check.status}`} key={check.id}>{check.status === 'followed' ? <Check size={14} /> : check.status === 'violated' ? <X size={14} /> : <span>—</span>}<span>{check.rule_text_snapshot}</span></div>) : <p>No rule checks recorded.</p>}</div><div><h4>Journal</h4><p><strong>Observed:</strong> {trade.description || '—'}</p><p><strong>Thesis:</strong> {trade.thesis || '—'}</p><p><strong>Review:</strong> {trade.post_trade_review || '—'}</p></div></div>
    </div>
  )
}

function AnalyticsPage({ trades, strategies, checks, strategyMap, onJson }: any) {
  const metrics = calculateMetrics(trades, checks)
  const stats = strategyPerformance(trades, strategies)
  const curve = equityCurve(trades)
  const ruleStats = rulePerformance(trades, checks)
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">EDGE ANALYSIS</span><h1>Analytics</h1><p>Look beyond win rate: expectancy, rule behavior and sample size tell the more useful story.</p></div><button className="secondary-button" onClick={onJson}><FileJson size={17} /> Export JSON backup</button></div>
      <section className="metric-grid"><MetricCard label="Expectancy" value={`${metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}R`} detail="Average R per closed trade" icon={Activity} trend={metrics.expectancy >= 0 ? 'up' : 'down'} /><MetricCard label="Average Winner" value={`+${metrics.avgWinner.toFixed(2)}R`} detail={`${metrics.wins} winning trades`} icon={TrendingUp} trend="up" /><MetricCard label="Average Loser" value={`${metrics.avgLoser.toFixed(2)}R`} detail={`${metrics.losses} losing trades`} icon={TrendingDown} trend="down" /><MetricCard label="Rule Adherence" value={`${metrics.adherence.toFixed(1)}%`} detail={`${metrics.violations} violations`} icon={ShieldCheck} /></section>

      <section className="panel chart-panel"><PanelHeader title="Cumulative R curve" subtitle="Normalized performance over time" />{curve.length ? <ResponsiveContainer width="100%" height={300}><AreaChart data={curve}><defs><linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="currentColor" stopOpacity={0.28}/><stop offset="95%" stopColor="currentColor" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip /><Area type="monotone" dataKey="r" stroke="currentColor" fill="url(#curveFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <EmptyState text="Add closed trades with Actual R to build your equity curve." />}</section>

      <section className="two-column analytics-columns">
        <div className="panel"><PanelHeader title="Strategy comparison" subtitle="Expectancy is more informative than win rate alone" />{stats.length ? <div className="analytics-table"><div className="analytics-head"><span>Strategy</span><span>Trades</span><span>WR</span><span>Exp.</span></div>{stats.map((row) => <div className="analytics-row" key={row.id}><div><strong>{row.name}</strong><small>{row.trades < 20 ? 'Low sample size' : row.trades < 50 ? 'Developing sample' : 'Stronger sample'}</small></div><span>{row.trades}</span><span>{row.winRate.toFixed(1)}%</span><strong className={row.expectancy >= 0 ? 'positive' : 'negative'}>{row.expectancy >= 0 ? '+' : ''}{row.expectancy.toFixed(2)}R</strong></div>)}</div> : <EmptyState text="Strategy statistics appear after you log trades." />}</div>
        <div className="panel"><PanelHeader title="Rules with the most evidence" subtitle="Correlation signal, not proof of causation" />{ruleStats.length ? <div className="rule-stats">{ruleStats.slice(0, 8).map((row, index) => <div className="rule-stat" key={`${row.rule}-${index}`}><div><strong>{row.rule}</strong><span>{row.total} evaluated trades</span></div><div><span className="good-text">Followed: {row.followedWinRate.toFixed(0)}% WR</span><span className="bad-text">Violated: {row.violatedWinRate.toFixed(0)}% WR</span></div></div>)}</div> : <EmptyState text="Rule-level analytics will appear after trades have checklist data." />}</div>
      </section>
    </div>
  )
}

function calculateMetrics(trades: Trade[], checks: RuleCheck[]) {
  const considered = trades.filter((t) => ['win', 'loss', 'breakeven'].includes(t.result || ''))
  const decisive = considered.filter((t) => ['win', 'loss'].includes(t.result || ''))
  const wins = decisive.filter((t) => t.result === 'win').length
  const losses = decisive.filter((t) => t.result === 'loss').length
  const rValues = considered.map((t) => Number(t.actual_r)).filter((v) => Number.isFinite(v))
  const winners = rValues.filter((r) => r > 0)
  const losers = rValues.filter((r) => r < 0)
  const netR = rValues.reduce((sum, r) => sum + r, 0)
  const grossWins = winners.reduce((sum, r) => sum + r, 0)
  const grossLosses = Math.abs(losers.reduce((sum, r) => sum + r, 0))
  const followed = checks.filter((c) => c.status === 'followed').length
  const violations = checks.filter((c) => c.status === 'violated').length
  return {
    totalTrades: trades.length,
    closedTrades: considered.length,
    wins,
    losses,
    winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0,
    netR,
    expectancy: rValues.length ? netR / rValues.length : 0,
    avgWinner: winners.length ? grossWins / winners.length : 0,
    avgLoser: losers.length ? losers.reduce((sum, r) => sum + r, 0) / losers.length : 0,
    profitFactor: grossLosses ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    adherence: followed + violations ? (followed / (followed + violations)) * 100 : 0,
    violations,
  }
}

function strategyPerformance(trades: Trade[], strategies: Strategy[]) {
  return strategies.map((strategy) => {
    const subset = trades.filter((t) => t.strategy_id === strategy.id && ['win', 'loss', 'breakeven'].includes(t.result || ''))
    const decisive = subset.filter((t) => ['win', 'loss'].includes(t.result || ''))
    const wins = decisive.filter((t) => t.result === 'win').length
    const r = subset.map((t) => Number(t.actual_r)).filter((v) => Number.isFinite(v))
    const expectancy = r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0
    return { id: strategy.id, name: strategy.name, trades: subset.length, winRate: decisive.length ? (wins / decisive.length) * 100 : 0, expectancy }
  }).filter((row) => row.trades > 0).sort((a, b) => b.expectancy - a.expectancy)
}

function equityCurve(trades: Trade[]) {
  const ordered = [...trades].filter((t) => Number.isFinite(Number(t.actual_r))).sort((a, b) => `${a.trade_date}${a.entry_time || ''}`.localeCompare(`${b.trade_date}${b.entry_time || ''}`))
  let cumulative = 0
  return ordered.map((trade, index) => {
    cumulative += Number(trade.actual_r)
    return { label: `${index + 1}`, r: Number(cumulative.toFixed(2)), date: trade.trade_date, symbol: trade.symbol }
  })
}

function rulePerformance(trades: Trade[], checks: RuleCheck[]) {
  const tradeMap = Object.fromEntries(trades.map((t) => [t.id, t]))
  const grouped: Record<string, { rule: string; followed: Trade[]; violated: Trade[] }> = {}
  checks.forEach((check) => {
    if (check.status === 'na') return
    const trade = tradeMap[check.trade_id]
    if (!trade || !['win', 'loss'].includes(trade.result || '')) return
    const key = check.rule_text_snapshot.trim().toLowerCase()
    if (!grouped[key]) grouped[key] = { rule: check.rule_text_snapshot, followed: [], violated: [] }
    grouped[key][check.status === 'followed' ? 'followed' : 'violated'].push(trade)
  })
  const winRate = (items: Trade[]) => items.length ? (items.filter((t) => t.result === 'win').length / items.length) * 100 : 0
  return Object.values(grouped).map((group) => ({ rule: group.rule, total: group.followed.length + group.violated.length, followedWinRate: winRate(group.followed), violatedWinRate: winRate(group.violated) })).sort((a, b) => b.total - a.total)
}

function exportTradesCSV(trades: Trade[], strategyMap: Record<string, Strategy>, checksByTrade: Record<string, RuleCheck[]>) {
  const headers = ['date','entry_time','symbol','direction','strategy','strategy_version','session','timeframe','result','actual_r','pnl','grade','emotion','confidence','rule_adherence_percent','description','thesis','post_trade_review']
  const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = trades.map((trade) => {
    const tradeChecks = checksByTrade[trade.id] || []
    const followed = tradeChecks.filter((c) => c.status === 'followed').length
    const violated = tradeChecks.filter((c) => c.status === 'violated').length
    const adherence = followed + violated ? ((followed / (followed + violated)) * 100).toFixed(1) : ''
    return [trade.trade_date, trade.entry_time, trade.symbol, trade.direction, strategyMap[trade.strategy_id || '']?.name || '', trade.strategy_version, trade.session, trade.timeframe, trade.result, trade.actual_r, trade.pnl, trade.grade, trade.emotion, trade.confidence, adherence, trade.description, trade.thesis, trade.post_trade_review].map(escape).join(',')
  })
  downloadText(`trading-journal-${new Date().toISOString().slice(0,10)}.csv`, [headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8')
}

function exportBackup(strategies: Strategy[], rules: Rule[], trades: Trade[], checks: RuleCheck[]) {
  downloadText(`trading-journal-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ exported_at: new Date().toISOString(), strategies, rules, trades, rule_checks: checks }, null, 2), 'application/json')
}
