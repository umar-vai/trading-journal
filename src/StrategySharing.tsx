import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Eye, ExternalLink, RefreshCw, Share2, ShieldCheck, UserPlus, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type ShareMode = 'view' | 'clone'
type RuleImportance = 'mandatory' | 'important' | 'optional'

type ActiveShare = {
  id: string
  token: string
  share_mode: ShareMode
  active: boolean
  created_at: string
}

type SharedRule = {
  source_rule_id?: string | null
  rule_text: string
  sort_order: number
  is_active?: boolean
  importance?: RuleImportance
}

type SharedExample = {
  source_rule_id?: string | null
  rule_text_snapshot?: string | null
  rule_sort_order: number
  caption?: string | null
  imageUrl?: string | null
}

type SharedPayload = {
  mode: ShareMode
  strategyVersion: number
  createdAt: string
  strategy: {
    name: string
    description?: string | null
    status?: string | null
    markets?: string[]
    primary_timeframe?: string | null
    higher_timeframe?: string | null
    min_rr?: number | null
    preferred_session?: string | null
    current_version?: number | null
  }
  rules: SharedRule[]
  examples: SharedExample[]
}

function publicShareUrl(token: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}?share=${encodeURIComponent(token)}`
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const area = document.createElement('textarea')
  area.value = value
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  document.body.removeChild(area)
}

function ImportanceBadge({ importance }: { importance?: RuleImportance }) {
  const value: RuleImportance = importance === 'mandatory' || importance === 'optional' ? importance : 'important'
  const label = value === 'mandatory' ? 'Mandatory' : value === 'important' ? 'High priority' : 'Bonus'
  return <span className={`shared-rule-importance ${value}`}>{label}</span>
}

export function StrategyShareControls({ strategy }: { strategy: any }) {
  const [shares, setShares] = useState<Record<ShareMode, ActiveShare | null>>({ view: null, clone: null })
  const [busy, setBusy] = useState<ShareMode | 'load' | null>('load')
  const [copied, setCopied] = useState<ShareMode | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy('load')
    setError('')
    const { data, error: queryError } = await supabase
      .from('strategy_shares')
      .select('id,token,share_mode,active,created_at')
      .eq('strategy_id', strategy.id)
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (queryError) {
      setError(queryError.message)
    } else {
      const next: Record<ShareMode, ActiveShare | null> = { view: null, clone: null }
      for (const row of (data || []) as ActiveShare[]) {
        if ((row.share_mode === 'view' || row.share_mode === 'clone') && !next[row.share_mode]) next[row.share_mode] = row
      }
      setShares(next)
    }
    setBusy(null)
  }, [strategy.id])

  useEffect(() => { load() }, [load])

  async function create(mode: ShareMode) {
    setBusy(mode)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('strategy-share', {
      body: { action: 'create', strategyId: strategy.id, mode },
    })
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Could not create share link.')
      setBusy(null)
      return
    }
    await load()
    if (data?.token) {
      await copyText(publicShareUrl(data.token)).catch(() => undefined)
      setCopied(mode)
      window.setTimeout(() => setCopied(null), 1800)
    }
    setBusy(null)
  }

  async function revoke(mode: ShareMode) {
    const share = shares[mode]
    if (!share) return
    setBusy(mode)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('strategy-share', {
      body: { action: 'revoke', token: share.token },
    })
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || 'Could not revoke link.')
    else setShares((current) => ({ ...current, [mode]: null }))
    setBusy(null)
  }

  async function copy(mode: ShareMode) {
    const share = shares[mode]
    if (!share) return
    await copyText(publicShareUrl(share.token))
    setCopied(mode)
    window.setTimeout(() => setCopied(null), 1800)
  }

  async function nativeShare(mode: ShareMode) {
    const share = shares[mode]
    if (!share) return
    const url = publicShareUrl(share.token)
    if (navigator.share) {
      await navigator.share({
        title: `${strategy.name} · Trading strategy`,
        text: mode === 'view' ? 'View this trading strategy.' : 'View this trading strategy and add a copy to your profile.',
        url,
      }).catch(() => undefined)
    } else {
      await copy(mode)
    }
  }

  const option = (mode: ShareMode) => {
    const share = shares[mode]
    const isView = mode === 'view'
    return (
      <div className={`strategy-share-option ${mode}`}>
        <div className="strategy-share-option-head">
          <span className="strategy-share-option-icon">{isView ? <Eye size={17} /> : <UserPlus size={17} />}</span>
          <div>
            <strong>{isView ? 'View only' : 'View + add to profile'}</strong>
            <p>{isView ? 'Anyone with the link can inspect the strategy, but cannot import it.' : 'Anyone with the link can inspect it; signed-in users can create their own independent copy.'}</p>
          </div>
        </div>
        {share ? (
          <>
            <div className="strategy-share-link-row">
              <input readOnly value={publicShareUrl(share.token)} aria-label={`${isView ? 'View only' : 'Importable'} share link`} />
              <button type="button" className="secondary-button" onClick={() => copy(mode)}>{copied === mode ? <Check size={14} /> : <Copy size={14} />}{copied === mode ? 'Copied' : 'Copy'}</button>
              <button type="button" className="secondary-button share-native-button" onClick={() => nativeShare(mode)}><Share2 size={14} /> Share</button>
            </div>
            <div className="strategy-share-link-actions">
              <button type="button" className="text-button" disabled={busy === mode} onClick={() => create(mode)}><RefreshCw size={13} /> Refresh snapshot</button>
              <button type="button" className="text-button danger-text" disabled={busy === mode} onClick={() => revoke(mode)}><X size={13} /> Revoke link</button>
            </div>
          </>
        ) : (
          <button type="button" className="secondary-button strategy-share-create" disabled={busy === mode || busy === 'load'} onClick={() => create(mode)}>
            {busy === mode ? <RefreshCw className="spin" size={15} /> : <Share2 size={15} />} Create & copy link
          </button>
        )}
      </div>
    )
  }

  return (
    <details className="strategy-share-panel">
      <summary><span><Share2 size={15} /> Share strategy</span><small>View-only or importable link</small></summary>
      <div className="strategy-share-options">
        {option('view')}
        {option('clone')}
      </div>
      {error && <div className="alert error strategy-share-error">{error}</div>}
    </details>
  )
}

export function SharedStrategyPage({ token, session, onRequireAuth }: { token: string; session: any; onRequireAuth: () => void }) {
  const [payload, setPayload] = useState<SharedPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<{ strategyId: string; copiedExamples: number; warnings?: string[] } | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('strategy-share', {
      body: { action: 'get', token },
    })
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || 'This strategy share could not be loaded.')
    else setPayload(data as SharedPayload)
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  const examplesByRule = useMemo(() => {
    const result: Record<string, SharedExample[]> = {}
    if (!payload) return result
    payload.rules.forEach((rule) => {
      const key = rule.source_rule_id || String(rule.sort_order)
      result[key] = payload.examples.filter((example) => example.source_rule_id
        ? example.source_rule_id === rule.source_rule_id
        : Number(example.rule_sort_order) === Number(rule.sort_order))
    })
    return result
  }, [payload])

  async function importStrategy() {
    if (!session) {
      onRequireAuth()
      return
    }
    setImporting(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('strategy-share', {
      body: { action: 'import', token },
    })
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || 'Could not add this strategy to your profile.')
    else setImported(data)
    setImporting(false)
  }

  function openJournal() {
    window.location.assign(`${window.location.origin}${import.meta.env.BASE_URL}`)
  }

  if (loading) {
    return <div className="shared-strategy-shell"><div className="shared-strategy-loading"><RefreshCw className="spin" size={22} /> Loading shared strategy…</div></div>
  }

  if (error && !payload) {
    return (
      <div className="shared-strategy-shell">
        <div className="shared-strategy-error-card">
          <ShieldCheck size={28} />
          <h1>Share link unavailable</h1>
          <p>{error}</p>
          <button className="primary-button" onClick={openJournal}>Open Trading Journal</button>
        </div>
      </div>
    )
  }

  if (!payload) return null
  const strategy = payload.strategy
  const canClone = payload.mode === 'clone'

  return (
    <div className="shared-strategy-shell">
      <header className="shared-strategy-topbar">
        <div className="shared-brand"><span><Share2 size={18} /></span><div><strong>Trading Journal</strong><small>Shared strategy</small></div></div>
        {session && <button className="secondary-button" onClick={openJournal}>Open my journal <ExternalLink size={14} /></button>}
      </header>

      <main className="shared-strategy-page">
        <section className="shared-strategy-hero">
          <div>
            <span className={`shared-mode-pill ${payload.mode}`}>{canClone ? <UserPlus size={13} /> : <Eye size={13} />}{canClone ? 'Can be added to your profile' : 'View only'}</span>
            <h1>{strategy.name}</h1>
            <p>{strategy.description || 'No strategy description was provided.'}</p>
          </div>
          <div className="shared-strategy-version">Shared version <strong>v{payload.strategyVersion}.0</strong></div>
        </section>

        <section className="shared-strategy-meta-grid">
          <div><span>Markets</span><strong>{strategy.markets?.length ? strategy.markets.join(', ') : 'Flexible'}</strong></div>
          <div><span>Entry timeframe</span><strong>{strategy.primary_timeframe || '—'}</strong></div>
          <div><span>Higher timeframe</span><strong>{strategy.higher_timeframe || '—'}</strong></div>
          <div><span>Minimum RR</span><strong>{strategy.min_rr ? `1:${strategy.min_rr}` : 'Flexible'}</strong></div>
          <div><span>Preferred session</span><strong>{strategy.preferred_session || '—'}</strong></div>
          <div><span>Rules</span><strong>{payload.rules.length}</strong></div>
        </section>

        <section className="shared-strategy-rules">
          <div className="shared-section-heading"><span>EXECUTION PLAN</span><h2>Rules & visual examples</h2><p>The importance badge shows how essential each rule is to the setup.</p></div>
          <div className="shared-rule-list">
            {payload.rules.map((rule, index) => {
              const key = rule.source_rule_id || String(rule.sort_order)
              const examples = examplesByRule[key] || []
              return (
                <article className={`shared-rule-card ${rule.importance || 'important'}`} key={key}>
                  <div className="shared-rule-top"><span className="shared-rule-number">{index + 1}</span><div><strong>{rule.rule_text}</strong><ImportanceBadge importance={rule.importance} /></div></div>
                  {examples.length > 0 && (
                    <div className="shared-rule-gallery">
                      {examples.map((example, exampleIndex) => example.imageUrl ? (
                        <a href={example.imageUrl} target="_blank" rel="noreferrer" key={`${key}-${exampleIndex}`}>
                          <img src={example.imageUrl} alt={example.caption || `Example for ${rule.rule_text}`} />
                          {example.caption && <span>{example.caption}</span>}
                        </a>
                      ) : null)}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section className={`shared-import-card ${canClone ? 'clone' : 'view'}`}>
          {canClone ? (
            imported ? (
              <>
                <div className="shared-import-icon success"><Check size={22} /></div>
                <div><h3>Strategy added to your profile</h3><p>An independent copy was created. {imported.copiedExamples ? `${imported.copiedExamples} chart example${imported.copiedExamples === 1 ? '' : 's'} copied too.` : 'Rules and strategy settings were copied.'}</p>{imported.warnings?.length ? <small>Some chart examples could not be copied, but the strategy itself was added successfully.</small> : null}</div>
                <button className="primary-button" onClick={openJournal}>Open my journal</button>
              </>
            ) : (
              <>
                <div className="shared-import-icon"><UserPlus size={22} /></div>
                <div><h3>Add this strategy to your profile</h3><p>You receive your own copy of the strategy, rule priorities, and available rule chart examples. Your copy will not change if the original owner edits theirs later.</p></div>
                <button className="primary-button" disabled={importing} onClick={importStrategy}>{importing ? <RefreshCw className="spin" size={16} /> : <UserPlus size={16} />}{session ? 'Add to my profile' : 'Sign in to add'}</button>
              </>
            )
          ) : (
            <>
              <div className="shared-import-icon"><Eye size={22} /></div>
              <div><h3>View-only strategy</h3><p>This link lets you study the strategy but does not allow importing it into another profile.</p></div>
              {session && <button className="secondary-button" onClick={openJournal}>Open my journal</button>}
            </>
          )}
        </section>

        {error && <div className="alert error shared-page-error">{error}</div>}
        <p className="shared-strategy-footer">Shared strategies are educational journal content, not financial advice or a promise of future performance.</p>
      </main>
    </div>
  )
}
