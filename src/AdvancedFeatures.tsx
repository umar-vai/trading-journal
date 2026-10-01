import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { supabase } from './lib/supabase'

export const DEFAULT_MISTAKES = [
  'Early Entry',
  'Late Entry',
  'FOMO Entry',
  'Revenge Trade',
  'Moved Stop Loss',
  'Over Risked',
  'Exited Early',
  'Ignored News',
  'Overtrading',
  'Wrong Lot Size',
]

function toNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function metricsFor(trades: any[], checks: any[] = []) {
  const decisive = trades.filter((trade) => ['win', 'loss'].includes(trade.result || ''))
  const evaluated = trades.filter((trade) => ['win', 'loss', 'breakeven'].includes(trade.result || ''))
  const wins = decisive.filter((trade) => trade.result === 'win').length
  const losses = decisive.filter((trade) => trade.result === 'loss').length
  const rValues = evaluated.map((trade) => Number(trade.actual_r)).filter(Number.isFinite)
  const winners = rValues.filter((r) => r > 0)
  const losers = rValues.filter((r) => r < 0)
  const netR = rValues.reduce((sum, value) => sum + value, 0)
  const grossWins = winners.reduce((sum, value) => sum + value, 0)
  const grossLosses = Math.abs(losers.reduce((sum, value) => sum + value, 0))
  const relevantIds = new Set(trades.map((trade) => trade.id))
  const scopedChecks = checks.filter((check) => relevantIds.has(check.trade_id))
  const followed = scopedChecks.filter((check) => check.status === 'followed').length
  const violated = scopedChecks.filter((check) => check.status === 'violated').length
  return {
    trades: trades.length,
    wins,
    losses,
    winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0,
    lossRate: wins + losses ? (losses / (wins + losses)) * 100 : 0,
    netR,
    expectancy: rValues.length ? netR / rValues.length : 0,
    profitFactor: grossLosses ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    adherence: followed + violated ? (followed / (followed + violated)) * 100 : 0,
  }
}

function aggregate(trades: any[], getKey: (trade: any) => string) {
  const groups = new Map<string, any[]>()
  trades.forEach((trade) => {
    const key = getKey(trade) || 'Unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(trade)
  })
  return [...groups.entries()].map(([label, items]) => ({ label, ...metricsFor(items) }))
    .sort((a, b) => b.trades - a.trades)
}

function streakStats(trades: any[]) {
  const ordered = [...trades]
    .filter((trade) => ['win', 'loss'].includes(trade.result || ''))
    .sort((a, b) => `${a.trade_date}${a.entry_time || ''}`.localeCompare(`${b.trade_date}${b.entry_time || ''}`))
  let currentWin = 0
  let currentLoss = 0
  let bestWin = 0
  let worstLoss = 0
  ordered.forEach((trade) => {
    if (trade.result === 'win') {
      currentWin += 1
      currentLoss = 0
      bestWin = Math.max(bestWin, currentWin)
    } else {
      currentLoss += 1
      currentWin = 0
      worstLoss = Math.max(worstLoss, currentLoss)
    }
  })
  return { bestWin, worstLoss }
}

function maxDrawdownR(trades: any[]) {
  const ordered = [...trades]
    .filter((trade) => Number.isFinite(Number(trade.actual_r)))
    .sort((a, b) => `${a.trade_date}${a.entry_time || ''}`.localeCompare(`${b.trade_date}${b.entry_time || ''}`))
  let cumulative = 0
  let peak = 0
  let maxDrawdown = 0
  ordered.forEach((trade) => {
    cumulative += Number(trade.actual_r)
    peak = Math.max(peak, cumulative)
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative)
  })
  return maxDrawdown
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet'
}

export function exportJournalXlsx({ trades, strategies, checks, mistakes, images, filename }: any) {
  const strategyMap = Object.fromEntries((strategies || []).map((strategy: any) => [strategy.id, strategy]))
  const checkMap: Record<string, any[]> = {}
  ;(checks || []).forEach((check: any) => {
    if (!checkMap[check.trade_id]) checkMap[check.trade_id] = []
    checkMap[check.trade_id].push(check)
  })
  const mistakeMap: Record<string, any[]> = {}
  ;(mistakes || []).forEach((mistake: any) => {
    if (!mistakeMap[mistake.trade_id]) mistakeMap[mistake.trade_id] = []
    mistakeMap[mistake.trade_id].push(mistake)
  })

  const tradeRows = (trades || []).map((trade: any) => {
    const tradeChecks = checkMap[trade.id] || []
    const followed = tradeChecks.filter((check) => check.status === 'followed').length
    const violated = tradeChecks.filter((check) => check.status === 'violated').length
    return {
      Date: trade.trade_date,
      'Entry Time': trade.entry_time || '',
      'Exit Time': trade.exit_time || '',
      Timezone: trade.timezone || '',
      Symbol: trade.symbol,
      Direction: trade.direction,
      Strategy: strategyMap[trade.strategy_id]?.name || '',
      'Strategy Version': trade.strategy_version || '',
      Session: trade.session || '',
      Timeframe: trade.timeframe || '',
      'Higher Timeframe': trade.higher_timeframe || '',
      'Entry Price': trade.entry_price ?? '',
      'Stop Loss': trade.stop_loss ?? '',
      'Take Profit': trade.take_profit ?? '',
      'Exit Price': trade.exit_price ?? '',
      'Risk %': trade.risk_percent ?? '',
      'Planned RR': trade.planned_rr ?? '',
      'Actual R': trade.actual_r ?? '',
      'P/L': trade.pnl ?? '',
      Result: trade.result || '',
      Grade: trade.grade || '',
      Emotion: trade.emotion || '',
      Confidence: trade.confidence ?? '',
      'Rule Adherence %': followed + violated ? Number(((followed / (followed + violated)) * 100).toFixed(1)) : '',
      Mistakes: (mistakeMap[trade.id] || []).map((item) => item.mistake).join(' | '),
      Observed: trade.description || '',
      Thesis: trade.thesis || '',
      Review: trade.post_trade_review || '',
    }
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tradeRows), safeSheetName('Trades'))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((checks || []).map((check: any) => ({
    'Trade ID': check.trade_id,
    Rule: check.rule_text_snapshot,
    Status: check.status,
    Order: check.rule_sort_order,
  }))), safeSheetName('Rule Checks'))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((mistakes || []).map((item: any) => ({
    'Trade ID': item.trade_id,
    Mistake: item.mistake,
    'Created At': item.created_at,
  }))), safeSheetName('Mistakes'))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((images || []).map((item: any) => ({
    'Trade ID': item.trade_id,
    Type: item.image_type,
    Notes: item.notes || '',
    'Storage Path': item.bucket_path,
    'Created At': item.created_at,
  }))), safeSheetName('Evidence'))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((strategies || []).map((strategy: any) => ({
    Strategy: strategy.name,
    Status: strategy.status,
    Version: strategy.current_version,
    Markets: (strategy.markets || []).join(', '),
    'Primary TF': strategy.primary_timeframe || '',
    'Higher TF': strategy.higher_timeframe || '',
    'Minimum RR': strategy.min_rr ?? '',
    'Preferred Session': strategy.preferred_session || '',
  }))), safeSheetName('Strategies'))

  XLSX.writeFile(workbook, filename || `trading-journal-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function AdvancedAnalytics({ trades }: { trades: any[] }) {
  const closed = useMemo(() => trades.filter((trade) => ['win', 'loss', 'breakeven'].includes(trade.result || '')), [trades])
  const sessionRows = useMemo(() => aggregate(closed, (trade) => trade.session || 'Unknown'), [closed])
  const timeframeRows = useMemo(() => aggregate(closed, (trade) => trade.timeframe || 'Unknown'), [closed])
  const emotionRows = useMemo(() => aggregate(closed, (trade) => trade.emotion || 'Unknown'), [closed])
  const weekdayRows = useMemo(() => aggregate(closed, (trade) => {
    const date = new Date(`${trade.trade_date}T12:00:00`)
    return date.toLocaleDateString(undefined, { weekday: 'long' })
  }), [closed])
  const streaks = useMemo(() => streakStats(closed), [closed])
  const drawdown = useMemo(() => maxDrawdownR(closed), [closed])

  return (
    <section className="advanced-analytics-stack">
      <div className="advanced-summary-grid">
        <div className="mini-stat"><span>Max drawdown</span><strong>{drawdown.toFixed(2)}R</strong></div>
        <div className="mini-stat"><span>Best win streak</span><strong>{streaks.bestWin}</strong></div>
        <div className="mini-stat"><span>Longest loss streak</span><strong>{streaks.worstLoss}</strong></div>
        <div className="mini-stat"><span>Closed sample</span><strong>{closed.length}</strong></div>
      </div>
      <div className="analytics-breakdown-grid">
        <Breakdown title="Session performance" rows={sessionRows} />
        <Breakdown title="Timeframe performance" rows={timeframeRows} />
        <Breakdown title="Day-of-week performance" rows={weekdayRows} />
        <Breakdown title="Emotion performance" rows={emotionRows} />
      </div>
    </section>
  )
}

function Breakdown({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="panel compact-analytics-panel">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="muted-copy">No closed trades yet.</p> : (
        <div className="breakdown-table">
          <div className="breakdown-head"><span>Group</span><span>N</span><span>WR</span><span>Exp.</span></div>
          {rows.slice(0, 8).map((row) => (
            <div className="breakdown-row" key={row.label}>
              <strong>{row.label}</strong><span>{row.trades}</span><span>{row.winRate.toFixed(0)}%</span><span className={row.expectancy >= 0 ? 'positive' : 'negative'}>{row.expectancy >= 0 ? '+' : ''}{row.expectancy.toFixed(2)}R</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReportsPage({ trades, strategies, checks, mistakes, images }: any) {
  const months = useMemo<string[]>(() => {
    const values = Array.from(new Set<string>((trades || []).map((trade: any) => String(trade.trade_date || '').slice(0, 7)).filter(Boolean)))
    const current = new Date().toISOString().slice(0, 7)
    if (!values.includes(current)) values.push(current)
    return values.sort().reverse()
  }, [trades])
  const [month, setMonth] = useState(months[0] || new Date().toISOString().slice(0, 7))
  const [strategyId, setStrategyId] = useState('all')

  useEffect(() => {
    if (!months.includes(month) && months.length) setMonth(months[0])
  }, [months, month])

  const scopedTrades = useMemo(() => (trades || []).filter((trade: any) => {
    const monthMatch = String(trade.trade_date || '').startsWith(month)
    const strategyMatch = strategyId === 'all' || trade.strategy_id === strategyId
    return monthMatch && strategyMatch
  }), [trades, month, strategyId])
  const scopedIds = useMemo(() => new Set(scopedTrades.map((trade: any) => trade.id)), [scopedTrades])
  const scopedChecks = useMemo(() => (checks || []).filter((check: any) => scopedIds.has(check.trade_id)), [checks, scopedIds])
  const scopedMistakes = useMemo(() => (mistakes || []).filter((item: any) => scopedIds.has(item.trade_id)), [mistakes, scopedIds])
  const scopedImages = useMemo(() => (images || []).filter((item: any) => scopedIds.has(item.trade_id)), [images, scopedIds])
  const metrics = useMemo(() => metricsFor(scopedTrades, scopedChecks), [scopedTrades, scopedChecks])
  const byStrategy = useMemo(() => {
    const map = Object.fromEntries((strategies || []).map((strategy: any) => [strategy.id, strategy.name]))
    return aggregate(scopedTrades, (trade) => map[trade.strategy_id] || 'No strategy')
  }, [scopedTrades, strategies])
  const daily = useMemo(() => aggregate(scopedTrades, (trade) => trade.trade_date || 'Unknown').sort((a, b) => a.label.localeCompare(b.label)), [scopedTrades])
  const mistakeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    scopedMistakes.forEach((item: any) => counts.set(item.mistake, (counts.get(item.mistake) || 0) + 1))
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }, [scopedMistakes])

  function exportMonth() {
    exportJournalXlsx({
      trades: scopedTrades,
      strategies,
      checks: scopedChecks,
      mistakes: scopedMistakes,
      images: scopedImages,
      filename: `trading-journal-${month}${strategyId === 'all' ? '' : '-strategy'}.xlsx`,
    })
  }

  return (
    <div className="page-stack">
      <div className="page-heading reports-heading">
        <div><span className="eyebrow">MONTH-END REVIEW</span><h1>Monthly reports</h1><p>Review one month at a time, isolate a strategy, and export a clean research workbook.</p></div>
        <div className="report-actions">
          <select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={strategyId} onChange={(event) => setStrategyId(event.target.value)}><option value="all">All strategies</option>{(strategies || []).map((strategy: any) => <option key={strategy.id} value={strategy.id}>{strategy.name}</option>)}</select>
          <button className="secondary-button" onClick={exportMonth}><FileSpreadsheet size={17} /> Export XLSX</button>
        </div>
      </div>

      <section className="metric-grid report-metrics">
        <ReportMetric label="Trades" value={metrics.trades} />
        <ReportMetric label="Win rate" value={`${metrics.winRate.toFixed(1)}%`} />
        <ReportMetric label="Loss rate" value={`${metrics.lossRate.toFixed(1)}%`} />
        <ReportMetric label="Net R" value={`${metrics.netR >= 0 ? '+' : ''}${metrics.netR.toFixed(2)}R`} tone={metrics.netR >= 0 ? 'positive' : 'negative'} />
        <ReportMetric label="Expectancy" value={`${metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}R`} tone={metrics.expectancy >= 0 ? 'positive' : 'negative'} />
        <ReportMetric label="Rule adherence" value={`${metrics.adherence.toFixed(1)}%`} />
      </section>

      <section className="two-column analytics-columns">
        <div className="panel">
          <div className="panel-title-icon"><CalendarDays size={18} /><div><h3>Daily performance</h3><p>Net R and win rate by trading day</p></div></div>
          {daily.length ? <div className="daily-report-list">{daily.map((row) => <div className="daily-report-row" key={row.label}><span>{row.label}</span><span>{row.trades} trades</span><span>{row.winRate.toFixed(0)}% WR</span><strong className={row.netR >= 0 ? 'positive' : 'negative'}>{row.netR >= 0 ? '+' : ''}{row.netR.toFixed(2)}R</strong></div>)}</div> : <p className="muted-copy">No trades in this period.</p>}
        </div>
        <div className="panel">
          <div className="panel-title-icon"><AlertTriangle size={18} /><div><h3>Mistake frequency</h3><p>What repeatedly cost execution quality</p></div></div>
          {mistakeCounts.length ? <div className="mistake-frequency">{mistakeCounts.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>)}</div> : <p className="muted-copy">No mistakes tagged in this period.</p>}
        </div>
      </section>

      <section className="panel">
        <h3>Strategy breakdown</h3>
        {byStrategy.length ? <div className="analytics-table"><div className="analytics-head"><span>Strategy</span><span>Trades</span><span>WR</span><span>Exp.</span></div>{byStrategy.map((row) => <div className="analytics-row" key={row.label}><div><strong>{row.label}</strong><small>{row.trades < 20 ? 'Low sample size' : row.trades < 50 ? 'Developing sample' : 'Stronger sample'}</small></div><span>{row.trades}</span><span>{row.winRate.toFixed(1)}%</span><strong className={row.expectancy >= 0 ? 'positive' : 'negative'}>{row.expectancy >= 0 ? '+' : ''}{row.expectancy.toFixed(2)}R</strong></div>)}</div> : <p className="muted-copy">No strategy data for this period.</p>}
      </section>
    </div>
  )
}

function ReportMetric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span></div><strong className={tone || ''}>{value}</strong></div>
}

export function TradeEvidencePanel({ trade, images, mistakes, userId, onChanged }: any) {
  const [imageType, setImageType] = useState('chart')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [customMistake, setCustomMistake] = useState('')
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function sign() {
      const pairs = await Promise.all((images || []).map(async (image: any) => {
        const { data } = await supabase.storage.from('trade-screenshots').createSignedUrl(image.bucket_path, 3600)
        return [image.id, data?.signedUrl || ''] as const
      }))
      if (!cancelled) setSignedUrls(Object.fromEntries(pairs))
    }
    sign()
    return () => { cancelled = true }
  }, [images])

  async function upload() {
    if (!files.length) return
    setBusy(true)
    setError('')
    try {
      for (const file of files) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Only PNG, JPG and WEBP images are allowed.')
        if (file.size > 10 * 1024 * 1024) throw new Error('Each screenshot must be 10 MB or smaller.')
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-90)
        const path = `${userId}/${trade.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${cleanName}`
        const { error: uploadError } = await supabase.storage.from('trade-screenshots').upload(path, file, { upsert: false })
        if (uploadError) throw uploadError
        const { error: rowError } = await supabase.from('trade_images').insert({ trade_id: trade.id, user_id: userId, bucket_path: path, image_type: imageType, notes: notes.trim() || null })
        if (rowError) {
          await supabase.storage.from('trade-screenshots').remove([path])
          throw rowError
        }
      }
      setFiles([])
      setNotes('')
      await onChanged()
    } catch (err: any) {
      setError(err?.message || 'Could not upload screenshot.')
    } finally {
      setBusy(false)
    }
  }

  async function removeImage(image: any) {
    setBusy(true)
    setError('')
    const { error: storageError } = await supabase.storage.from('trade-screenshots').remove([image.bucket_path])
    if (storageError) { setError(storageError.message); setBusy(false); return }
    const { error: rowError } = await supabase.from('trade_images').delete().eq('id', image.id)
    if (rowError) setError(rowError.message)
    else await onChanged()
    setBusy(false)
  }

  async function addMistake(label: string) {
    const value = label.trim()
    if (!value || (mistakes || []).some((item: any) => String(item.mistake).toLowerCase() === value.toLowerCase())) return
    setBusy(true)
    const { error: insertError } = await supabase.from('trade_mistakes').insert({ trade_id: trade.id, user_id: userId, mistake: value })
    if (insertError) setError(insertError.message)
    else { setCustomMistake(''); await onChanged() }
    setBusy(false)
  }

  async function removeMistake(id: string) {
    setBusy(true)
    const { error: deleteError } = await supabase.from('trade_mistakes').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await onChanged()
    setBusy(false)
  }

  return (
    <div className="evidence-panel">
      <div className="evidence-column">
        <div className="evidence-heading"><Camera size={17} /><div><h4>Chart evidence</h4><p>Stored privately in Supabase Storage.</p></div></div>
        <div className="evidence-upload-row">
          <select value={imageType} onChange={(event) => setImageType(event.target.value)}><option value="before">Before entry</option><option value="entry">Entry</option><option value="exit">Exit</option><option value="chart">Chart</option><option value="other">Other</option></select>
          <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
        </div>
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional screenshot note" />
        <button type="button" className="secondary-button" disabled={busy || !files.length} onClick={upload}><Upload size={15} /> Upload {files.length ? `${files.length} screenshot${files.length > 1 ? 's' : ''}` : 'screenshots'}</button>
        <div className="evidence-grid">
          {(images || []).map((image: any) => <div className="evidence-card" key={image.id}>{signedUrls[image.id] ? <a href={signedUrls[image.id]} target="_blank" rel="noreferrer"><img src={signedUrls[image.id]} alt={image.notes || image.image_type} /></a> : <div className="image-loading">Loading…</div>}<div><span>{image.image_type}</span><button type="button" onClick={() => removeImage(image)} title="Delete screenshot"><Trash2 size={14} /></button></div>{image.notes && <p>{image.notes}</p>}</div>)}
        </div>
      </div>

      <div className="evidence-column">
        <div className="evidence-heading"><AlertTriangle size={17} /><div><h4>Mistake tracker</h4><p>Tag execution errors separately from strategy rules.</p></div></div>
        <div className="mistake-chip-grid">{DEFAULT_MISTAKES.map((item) => <button type="button" key={item} disabled={busy} onClick={() => addMistake(item)}>{item}</button>)}</div>
        <div className="custom-mistake-row"><input value={customMistake} onChange={(event) => setCustomMistake(event.target.value)} placeholder="Custom mistake" /><button type="button" className="icon-button" disabled={!customMistake.trim() || busy} onClick={() => addMistake(customMistake)}><Plus size={15} /></button></div>
        <div className="active-mistakes">{(mistakes || []).length ? (mistakes || []).map((item: any) => <span key={item.id}>{item.mistake}<button type="button" onClick={() => removeMistake(item.id)}><Trash2 size={12} /></button></span>) : <p className="muted-copy">No mistakes tagged.</p>}</div>
      </div>
      {error && <div className="alert error evidence-error">{error}</div>}
    </div>
  )
}

export function ExportAllXlsxButton({ trades, strategies, checks, mistakes, images }: any) {
  return <button className="secondary-button" onClick={() => exportJournalXlsx({ trades, strategies, checks, mistakes, images })}><Download size={16} /><FileSpreadsheet size={16} /> XLSX</button>
}
