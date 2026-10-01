import fs from 'node:fs'

const appPath = 'src/App.tsx'
const cssPath = 'src/styles.css'
let app = fs.readFileSync(appPath, 'utf8')
let css = fs.readFileSync(cssPath, 'utf8')

if (!app.includes('NewsPage({ strategies')) {
  app = app.replace('  Menu,\n  Plus,', '  Menu,\n  Newspaper,\n  ExternalLink,\n  Plus,')
  app = app.replace("type View = 'dashboard' | 'strategies' | 'new-trade' | 'journal' | 'analytics' | 'reports'", "type View = 'dashboard' | 'strategies' | 'new-trade' | 'journal' | 'news' | 'analytics' | 'reports'")
  app = app.replace("    { id: 'journal', label: 'Journal', icon: BookOpen },\n    { id: 'analytics', label: 'Analytics', icon: BarChart3 },", "    { id: 'journal', label: 'Journal', icon: BookOpen },\n    { id: 'news', label: 'News', icon: Newspaper },\n    { id: 'analytics', label: 'Analytics', icon: BarChart3 },")
  app = app.replace("              {view === 'journal' && <JournalPage user={user}", "              {view === 'news' && <NewsPage strategies={strategies} />}\n              {view === 'journal' && <JournalPage user={user}")

  const marker = 'function SectionLoader() {'
  const newsPage = `function NewsPage({ strategies }: { strategies: Strategy[] }) {
  const [category, setCategory] = useState('all')
  const [symbol, setSymbol] = useState('')
  const [articles, setArticles] = useState<any[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [refreshingNews, setRefreshingNews] = useState(false)
  const [error, setError] = useState('')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [cacheMinutes, setCacheMinutes] = useState<number | null>(null)
  const [cached, setCached] = useState(false)

  const strategySymbols = useMemo(() => {
    const values = strategies.flatMap((strategy) => Array.isArray(strategy.markets) ? strategy.markets : [])
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
    return [...new Set([...values, ...popularPairs])]
  }, [strategies])

  const loadNews = useCallback(async (silent = false) => {
    if (!silent) setRefreshingNews(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('market-news', {
      body: { category, symbol },
    })
    if (invokeError) {
      setError('Live news is not available yet. The news provider may still need to be configured.')
    } else if (data?.error) {
      setError(data.error)
    } else {
      setArticles(Array.isArray(data?.articles) ? data.articles : [])
      setFetchedAt(data?.fetchedAt || null)
      setCacheMinutes(Number(data?.cacheMinutes) || null)
      setCached(Boolean(data?.cached))
    }
    setLoadingNews(false)
    setRefreshingNews(false)
  }, [category, symbol])

  useEffect(() => { loadNews() }, [loadNews])
  useEffect(() => {
    const timer = window.setInterval(() => loadNews(true), 60_000)
    return () => window.clearInterval(timer)
  }, [loadNews])

  function sentimentMeta(value: any) {
    const score = Number(value)
    if (!Number.isFinite(score)) return { label: 'Unrated', tone: 'neutral' }
    if (score >= 0.12) return { label: 'Positive', tone: 'positive' }
    if (score <= -0.12) return { label: 'Negative', tone: 'negative' }
    return { label: 'Neutral', tone: 'neutral' }
  }

  function relativeTime(value: string) {
    const time = new Date(value).getTime()
    if (!Number.isFinite(time)) return ''
    const seconds = Math.round((time - Date.now()) / 1000)
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second')
    const minutes = Math.round(seconds / 60)
    if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
    const hours = Math.round(minutes / 60)
    if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
    return formatter.format(Math.round(hours / 24), 'day')
  }

  return (
    <div className="page-stack news-page">
      <div className="page-heading news-heading">
        <div>
          <span className="eyebrow">LIVE MARKET CONTEXT</span>
          <h1>Trading news</h1>
          <p>Follow macro, forex, metals, indices and crypto headlines without leaving your journal.</p>
        </div>
        <button className="secondary-button" onClick={() => loadNews()} disabled={refreshingNews}>
          <RefreshCw className={refreshingNews ? 'spin' : ''} size={16} /> Refresh
        </button>
      </div>

      <section className="panel news-filter-panel">
        <div className="news-filter-grid">
          <label>Market focus
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All trading news</option>
              <option value="macro">Macro & central banks</option>
              <option value="forex">Forex</option>
              <option value="metals">Gold & metals</option>
              <option value="indices">Indices & equities</option>
              <option value="crypto">Crypto</option>
            </select>
          </label>
          <label>Instrument
            <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
              <option value="">All instruments</option>
              {strategySymbols.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="news-feed-status">
          <span className="live-dot" />
          <span>{fetchedAt ? \`Feed checked \${relativeTime(fetchedAt)}\` : 'Connecting to market feed'}</span>
          {cacheMinutes && <span>· server refresh window {cacheMinutes} min</span>}
          {cached && <span>· cached</span>}
        </div>
      </section>

      {error && (
        <div className="panel news-setup-state">
          <Newspaper size={28} />
          <div><h3>News feed needs one final connection</h3><p>{error}</p></div>
        </div>
      )}

      {loadingNews && !error ? <SectionLoader /> : !error && articles.length === 0 ? (
        <div className="panel"><EmptyState text="No matching headlines were returned for this filter yet." /></div>
      ) : !error && (
        <div className="news-grid">
          {articles.map((article) => {
            const sentiment = sentimentMeta(article.sentiment)
            return (
              <article className="news-card" key={article.id || article.url}>
                {article.imageUrl ? <img src={article.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="news-image-placeholder"><Newspaper size={24} /></div>}
                <div className="news-card-body">
                  <div className="news-meta-row">
                    <span className="news-source">{article.source || 'Market source'}</span>
                    <span className={\`news-sentiment \${sentiment.tone}\`}>{sentiment.label}</span>
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.description || 'Open the source to read the full market update.'}</p>
                  {Array.isArray(article.entities) && article.entities.length > 0 && <div className="news-entity-row">{article.entities.slice(0, 5).map((entity: any) => <span key={entity.symbol || entity.name}>{entity.symbol || entity.name}</span>)}</div>}
                  <div className="news-card-footer">
                    <span>{relativeTime(article.publishedAt)}</span>
                    <a href={article.url} target="_blank" rel="noreferrer">Read source <ExternalLink size={13} /></a>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <p className="news-disclaimer">News and sentiment are informational context only, not trading signals or financial advice.</p>
    </div>
  )
}

`
  app = app.replace(marker, newsPage + marker)
}

if (!css.includes('/* live-market-news */')) {
  css += `\n\n/* live-market-news */\n.news-heading { align-items: center; }\n.news-filter-panel { display: grid; gap: 14px; }\n.news-filter-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }\n.news-feed-status { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; color: var(--muted); font-size: 10px; }\n.live-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--accent); box-shadow: 0 0 0 4px rgba(99,230,190,.08), 0 0 14px rgba(99,230,190,.35); }\n.news-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }\n.news-card { overflow: hidden; border: 1px solid var(--line); border-radius: 15px; background: var(--panel); min-width: 0; display: flex; flex-direction: column; }\n.news-card > img, .news-image-placeholder { width: 100%; aspect-ratio: 16/8.5; object-fit: cover; background: #0a1017; }\n.news-image-placeholder { display: grid; place-items: center; color: #415061; }\n.news-card-body { padding: 15px; display: grid; gap: 10px; height: 100%; }\n.news-meta-row, .news-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; }\n.news-source { color: #8c9aaa; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.news-sentiment { flex: 0 0 auto; border-radius: 999px; padding: 4px 7px; font-size: 9px; font-weight: 700; }\n.news-sentiment.positive { background: var(--accent-soft); color: var(--accent) !important; }\n.news-sentiment.negative { background: var(--red-soft); color: var(--red) !important; }\n.news-sentiment.neutral { background: #151d27; color: #95a2b1; }\n.news-card h3 { margin: 0; font-size: 15px; line-height: 1.4; letter-spacing: -.015em; }\n.news-card p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }\n.news-entity-row { display: flex; flex-wrap: wrap; gap: 5px; }\n.news-entity-row span { border: 1px solid #263343; background: #111821; color: #9cabb9; padding: 4px 6px; border-radius: 6px; font-size: 9px; font-weight: 700; }\n.news-card-footer { margin-top: auto; padding-top: 5px; color: #627080; font-size: 10px; }\n.news-card-footer a { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); text-decoration: none; font-weight: 700; }\n.news-card-footer a:hover { text-decoration: underline; }\n.news-setup-state { min-height: 140px; display: flex; align-items: center; gap: 14px; color: var(--accent); }\n.news-setup-state h3 { color: var(--text); margin: 0 0 5px; }\n.news-setup-state p { color: var(--muted); margin: 0; font-size: 12px; }\n.news-disclaimer { text-align: center; color: #556271; font-size: 10px; margin: 0; }\n@media (max-width: 1100px) { .news-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }\n@media (max-width: 680px) { .news-filter-grid, .news-grid { grid-template-columns: 1fr; } .news-heading { align-items: stretch; } .news-heading .secondary-button { width: 100%; } .news-card > img, .news-image-placeholder { aspect-ratio: 16/7.8; } }\n`
}

fs.writeFileSync(appPath, app)
fs.writeFileSync(cssPath, css)
