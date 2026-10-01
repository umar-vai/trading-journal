import fs from 'node:fs'

const appPath = 'src/App.tsx'
const cssPath = 'src/styles.css'
let app = fs.readFileSync(appPath, 'utf8')
let css = fs.readFileSync(cssPath, 'utf8')

if (app.includes('Dashboard strategy') && app.includes('strategyTrades')) {
  console.log('Dashboard strategy filtering is already applied.')
  process.exit(0)
}

const oldDashboardStart = `function Dashboard({ metrics, trades, strategies, strategyMap, onNewTrade }: any) {
  const recent = trades.slice(0, 6)
  const strategyStats = strategyPerformance(trades, strategies)`

const newDashboardStart = `function Dashboard({ trades, strategies, checks, strategyMap, userId, onNewTrade }: any) {
  const storageKey = \`trading-journal:dashboard-strategy:\${userId}\`
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(() => {
    try { return window.localStorage.getItem(storageKey) || '' } catch { return '' }
  })

  useEffect(() => {
    if (!strategies.length) return
    const selectedStillExists = strategies.some((strategy: Strategy) => strategy.id === selectedStrategyId)
    if (!selectedStillExists) {
      const fallback = strategies.find((strategy: Strategy) => strategy.status === 'active')
        || strategies.find((strategy: Strategy) => strategy.status === 'testing')
        || strategies[0]
      if (fallback) setSelectedStrategyId(fallback.id)
    }
  }, [strategies, selectedStrategyId])

  useEffect(() => {
    if (!selectedStrategyId) return
    try { window.localStorage.setItem(storageKey, selectedStrategyId) } catch { /* local storage can be unavailable */ }
  }, [selectedStrategyId, storageKey])

  const selectedStrategy = strategies.find((strategy: Strategy) => strategy.id === selectedStrategyId)
  const strategyTrades = selectedStrategyId
    ? trades.filter((trade: Trade) => trade.strategy_id === selectedStrategyId)
    : []
  const strategyTradeIds = new Set(strategyTrades.map((trade: Trade) => trade.id))
  const strategyChecks = checks.filter((check: RuleCheck) => strategyTradeIds.has(check.trade_id))
  const metrics = calculateMetrics(strategyTrades, strategyChecks)
  const decisiveTrades = metrics.wins + metrics.losses
  const lossRate = decisiveTrades ? (metrics.losses / decisiveTrades) * 100 : 0
  const winLossRatio = metrics.losses ? metrics.wins / metrics.losses : metrics.wins > 0 ? Infinity : 0
  const recent = strategyTrades.slice(0, 6)
  const strategyStats = selectedStrategy ? strategyPerformance(strategyTrades, [selectedStrategy]) : []`

if (!app.includes(oldDashboardStart)) throw new Error('Could not find the current Dashboard function signature.')
app = app.replace(oldDashboardStart, newDashboardStart)

const oldDashboardInvocation = `{view === 'dashboard' && <Dashboard metrics={metrics} trades={trades} strategies={strategies} strategyMap={strategyMap} onNewTrade={() => navigate('new-trade')} />}`
const newDashboardInvocation = `{view === 'dashboard' && <Dashboard trades={trades} strategies={strategies} checks={checks} strategyMap={strategyMap} userId={user.id} onNewTrade={() => navigate('new-trade')} />}`
if (!app.includes(oldDashboardInvocation)) throw new Error('Could not find the Dashboard invocation.')
app = app.replace(oldDashboardInvocation, newDashboardInvocation)

app = app.replace(`  const metrics = useMemo(() => calculateMetrics(trades, checks), [trades, checks])\n\n`, '')

const oldHeroButton = `        <button className="primary-button" onClick={onNewTrade}><Plus size={18} /> Log a new trade</button>`
const newHeroControls = `        <div className="dashboard-hero-actions">
          <label className="dashboard-strategy-select">
            <span>Dashboard strategy</span>
            <select value={selectedStrategyId} onChange={(e) => setSelectedStrategyId(e.target.value)} disabled={!strategies.length}>
              {strategies.map((strategy: Strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name}{strategy.status === 'archived' ? ' · Archived' : ''}</option>)}
            </select>
            <small>Stats below are scoped to this strategy. Your last selection is remembered.</small>
          </label>
          <button className="primary-button" onClick={onNewTrade}><Plus size={18} /> Log a new trade</button>
        </div>`
if (!app.includes(oldHeroButton)) throw new Error('Could not find the dashboard hero action.')
app = app.replace(oldHeroButton, newHeroControls)

app = app.replace(`      <section className="metric-grid">\n        <MetricCard label="Total Trades"`, `      <section className="metric-grid dashboard-metrics">\n        <MetricCard label="Total Trades"`)

const oldWinCard = `        <MetricCard label="Win Rate" value={\`${'${metrics.winRate.toFixed(1)}'}%\`} detail={\`${'${metrics.wins}'} wins / ${'${metrics.losses}'} losses\`} icon={Target} trend={metrics.winRate >= 50 ? 'up' : 'down'} />`
const newWinCards = `        <MetricCard label="Win Rate" value={\`${'${metrics.winRate.toFixed(1)}'}%\`} detail={\`${'${metrics.wins}'} wins / ${'${metrics.losses}'} losses\`} icon={Target} trend={metrics.winRate >= 50 ? 'up' : 'down'} />
        <MetricCard label="Loss Rate" value={\`${'${lossRate.toFixed(1)}'}%\`} detail={decisiveTrades ? \`${'${metrics.losses}'} of ${'${decisiveTrades}'} decisive trades\` : 'No decisive trades yet'} icon={TrendingDown} trend={lossRate <= 50 ? 'up' : 'down'} />
        <MetricCard label="W/L Ratio" value={Number.isFinite(winLossRatio) ? winLossRatio.toFixed(2) : '∞'} detail={\`${'${metrics.wins}'} wins : ${'${metrics.losses}'} losses\`} icon={Activity} trend={winLossRatio >= 1 ? 'up' : 'down'} />`
if (!app.includes(oldWinCard)) throw new Error('Could not find the dashboard Win Rate card.')
app = app.replace(oldWinCard, newWinCards)

app = app.replace(`<PanelHeader title="Recent trades" subtitle="Your latest executions" />`, `<PanelHeader title="Recent trades" subtitle={\`${'${selectedStrategy?.name || \'Selected strategy\'}'} · latest executions\`} />`)
app = app.replace(`<EmptyState text="No trades yet. Log your first trade to start the journal." />`, `<EmptyState text={selectedStrategy ? \`No trades logged for ${'${selectedStrategy.name}'} yet.\` : 'Create a strategy to start tracking strategy-specific performance.'} />`)
app = app.replace(`<PanelHeader title="Strategy leaderboard" subtitle="Ranked by expectancy" />`, `<PanelHeader title="Selected strategy" subtitle="Current strategy performance" />`)
app = app.replace(`<EmptyState text="Create a strategy and start tagging trades to compare performance." />`, `<EmptyState text="The selected strategy does not have enough closed trades yet." />`)

const cssMarker = '/* dashboard-strategy-filter */'
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.dashboard-hero-actions { position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: flex-end; gap: 14px; min-width: min(100%, 440px); }\n.dashboard-strategy-select { display: flex; flex-direction: column; gap: 6px; min-width: 280px; margin: 0; color: var(--text); font-size: 12px; font-weight: 600; }\n.dashboard-strategy-select > span { color: #9aa8b8; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }\n.dashboard-strategy-select select { min-height: 43px; background: rgba(8, 13, 19, .88); border-color: #2a3745; }\n.dashboard-strategy-select small { color: #6f7d8e; font-size: 10px; font-weight: 400; line-height: 1.35; }\n.dashboard-metrics { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }\n@media (max-width: 900px) {\n  .hero-card { align-items: stretch; }\n  .dashboard-hero-actions { width: 100%; min-width: 0; flex-direction: column; align-items: stretch; }\n  .dashboard-strategy-select { width: 100%; min-width: 0; }\n}\n`
}

fs.writeFileSync(appPath, app)
fs.writeFileSync(cssPath, css)
console.log('Dashboard strategy filtering patch applied successfully.')
