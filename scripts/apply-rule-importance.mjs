import fs from 'node:fs'

const path = 'src/App.tsx'
let source = fs.readFileSync(path, 'utf8')

function mustReplace(from, to, label) {
  if (!source.includes(from)) throw new Error(`Could not find patch target: ${label}`)
  source = source.replace(from, to)
}

mustReplace(
  "type RuleStatus = 'followed' | 'violated' | 'na'\n",
  "type RuleStatus = 'followed' | 'violated' | 'na'\ntype RuleImportance = 'mandatory' | 'important' | 'optional'\n",
  'RuleImportance type',
)

mustReplace(
  "  rule_text: string\n  sort_order: number\n  is_active: boolean\n}",
  "  rule_text: string\n  sort_order: number\n  importance: RuleImportance\n  is_active: boolean\n}",
  'Rule importance field',
)

mustReplace(
  "  rule_text_snapshot: string\n  rule_sort_order: number\n  status: RuleStatus\n}",
  "  rule_text_snapshot: string\n  rule_sort_order: number\n  rule_importance_snapshot: RuleImportance\n  status: RuleStatus\n}",
  'RuleCheck importance snapshot',
)

const resultPill = `function ResultPill({ result }: { result?: string | null }) {\n  return <span className={\`result-pill \${result || 'open'}\`}>{result || 'open'}</span>\n}\n`
const importanceHelpers = `function ResultPill({ result }: { result?: string | null }) {\n  return <span className={\`result-pill \${result || 'open'}\`}>{result || 'open'}</span>\n}\n\nfunction RuleImportanceBadge({ importance }: { importance?: RuleImportance | null }) {\n  const value: RuleImportance = importance || 'important'\n  const labels: Record<RuleImportance, string> = { mandatory: 'Mandatory', important: 'High priority', optional: 'Bonus' }\n  return <span className={\`rule-importance-badge \${value}\`}>{labels[value]}</span>\n}\n`
mustReplace(resultPill, importanceHelpers, 'importance badge helper')

const start = source.indexOf('function StrategiesPage(')
const end = source.indexOf('\nfunction NewTradePage(', start)
if (start < 0 || end < 0) throw new Error('Could not locate StrategiesPage boundaries')

const strategiesPage = `function StrategiesPage({ user, strategies, rulesByStrategy, onChanged }: any) {
  const emptyForm = {
    name: '', description: '', markets: '', primary_timeframe: '5M', higher_timeframe: '1H', min_rr: '2', preferred_session: 'London', status: 'active',
    rules: ['', '', ''],
    rule_ids: [null, null, null],
    rule_importance: ['important', 'important', 'important'] as RuleImportance[],
  }
  const [form, setForm] = useState<any>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function freshEmptyForm() {
    return { ...emptyForm, rules: [...emptyForm.rules], rule_ids: [...emptyForm.rule_ids], rule_importance: [...emptyForm.rule_importance] }
  }

  function startCreate() {
    setEditingId(null)
    setForm(freshEmptyForm())
    setShowForm(true)
  }

  function startEdit(strategy: Strategy) {
    const existingRules: Rule[] = rulesByStrategy[strategy.id] || []
    const targetLength = Math.max(existingRules.length + 1, 3)
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
      rules: Array.from({ length: targetLength }, (_, index) => existingRules[index]?.rule_text || ''),
      rule_ids: Array.from({ length: targetLength }, (_, index) => existingRules[index]?.id || null),
      rule_importance: Array.from({ length: targetLength }, (_, index) => existingRules[index]?.importance || 'important'),
    })
    setShowForm(true)
  }

  function updateRule(index: number, value: string) {
    setForm((prev: any) => ({ ...prev, rules: prev.rules.map((r: string, i: number) => i === index ? value : r) }))
  }

  function updateRuleImportance(index: number, importance: RuleImportance) {
    setForm((prev: any) => ({ ...prev, rule_importance: prev.rule_importance.map((value: RuleImportance, i: number) => i === index ? importance : value) }))
  }

  function addRule() {
    setForm((prev: any) => ({
      ...prev,
      rules: [...prev.rules, ''],
      rule_ids: [...prev.rule_ids, null],
      rule_importance: [...prev.rule_importance, 'important'],
    }))
  }

  function removeRule(index: number) {
    setForm((prev: any) => ({
      ...prev,
      rules: prev.rules.filter((_: string, i: number) => i !== index),
      rule_ids: prev.rule_ids.filter((_: string | null, i: number) => i !== index),
      rule_importance: prev.rule_importance.filter((_: RuleImportance, i: number) => i !== index),
    }))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const cleanedEntries = form.rules
      .map((value: string, index: number) => ({
        id: form.rule_ids?.[index] || null,
        rule_text: value.trim(),
        importance: (form.rule_importance?.[index] || 'important') as RuleImportance,
      }))
      .filter((entry: any) => Boolean(entry.rule_text))
      .map((entry: any, index: number) => ({ ...entry, sort_order: index }))

    if (!form.name.trim()) { setError('Strategy name is required.'); setBusy(false); return }
    if (cleanedEntries.length === 0) { setError('Add at least one rule.'); setBusy(false); return }

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

      const ruleRows = cleanedEntries.map((entry: any) => ({
        strategy_id: created.id,
        user_id: user.id,
        rule_text: entry.rule_text,
        sort_order: entry.sort_order,
        importance: entry.importance,
      }))
      const { error: ruleError } = await supabase.from('strategy_rules').insert(ruleRows)
      if (ruleError) { setError(ruleError.message); setBusy(false); return }

      await supabase.from('strategy_versions').insert({
        strategy_id: created.id,
        user_id: user.id,
        version: 1,
        strategy_snapshot: { ...payload, current_version: 1 },
        rules_snapshot: cleanedEntries.map(({ rule_text, sort_order, importance }: any) => ({ rule_text, sort_order, importance })),
        change_note: 'Initial strategy version',
      })
    } else {
      const current = strategies.find((s: Strategy) => s.id === editingId)
      const nextVersion = (current?.current_version || 1) + 1
      const { error: updateError } = await supabase.from('strategies').update({ ...payload, current_version: nextVersion }).eq('id', editingId)
      if (updateError) { setError(updateError.message); setBusy(false); return }

      const currentRules: Rule[] = rulesByStrategy[editingId] || []
      const keptIds = new Set(cleanedEntries.map((entry: any) => entry.id).filter(Boolean))
      const removedIds = currentRules.filter((rule) => !keptIds.has(rule.id)).map((rule) => rule.id)
      if (removedIds.length) {
        const { error: deleteError } = await supabase.from('strategy_rules').delete().in('id', removedIds)
        if (deleteError) { setError(deleteError.message); setBusy(false); return }
      }

      for (const entry of cleanedEntries.filter((item: any) => item.id)) {
        const { error: ruleUpdateError } = await supabase
          .from('strategy_rules')
          .update({ rule_text: entry.rule_text, sort_order: entry.sort_order, importance: entry.importance, is_active: true })
          .eq('id', entry.id)
          .eq('strategy_id', editingId)
        if (ruleUpdateError) { setError(ruleUpdateError.message); setBusy(false); return }
      }

      const newEntries = cleanedEntries.filter((entry: any) => !entry.id)
      if (newEntries.length) {
        const { error: insertError } = await supabase.from('strategy_rules').insert(newEntries.map((entry: any) => ({
          strategy_id: editingId,
          user_id: user.id,
          rule_text: entry.rule_text,
          sort_order: entry.sort_order,
          importance: entry.importance,
        })))
        if (insertError) { setError(insertError.message); setBusy(false); return }
      }

      const { error: versionError } = await supabase.from('strategy_versions').insert({
        strategy_id: editingId,
        user_id: user.id,
        version: nextVersion,
        strategy_snapshot: { ...payload, current_version: nextVersion },
        rules_snapshot: cleanedEntries.map(({ rule_text, sort_order, importance }: any) => ({ rule_text, sort_order, importance })),
        change_note: \`Updated to version \${nextVersion}\`,
      })
      if (versionError) { setError(versionError.message); setBusy(false); return }
    }

    setBusy(false)
    setShowForm(false)
    setEditingId(null)
    setForm(freshEmptyForm())
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
          <PanelHeader title={editingId ? 'Edit strategy' : 'Create strategy'} subtitle={editingId ? 'Rule IDs and chart examples stay attached while this creates a new version.' : 'Start with the setup and its non-negotiable rules.'} action={<button type="button" className="icon-button" onClick={() => setShowForm(false)}><X size={18} /></button>} />
          <div className="form-grid two">
            <label>Strategy name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="London Liquidity Sweep" /></label>
            <label>Markets<input value={form.markets} onChange={(e) => setForm({ ...form, markets: e.target.value })} placeholder="XAUUSD, NAS100" /></label>
            <label>Primary timeframe<select value={form.primary_timeframe} onChange={(e) => setForm({ ...form, primary_timeframe: e.target.value })}>{timeframes.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label><InfoLabel label="Higher timeframe" /><select value={form.higher_timeframe} onChange={(e) => setForm({ ...form, higher_timeframe: e.target.value })}>{timeframes.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Minimum RR<input type="number" min="0" step="0.1" value={form.min_rr} onChange={(e) => setForm({ ...form, min_rr: e.target.value })} /></label>
            <label>Preferred session<select value={form.preferred_session} onChange={(e) => setForm({ ...form, preferred_session: e.target.value })}>{sessions.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="testing">Testing</option><option value="archived">Archived</option></select></label>
            <label className="span-two">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What market condition and setup defines this strategy?" /></label>
          </div>

          <div className="rules-builder">
            <div className="rules-builder-head"><div><h4>Execution rules</h4><p>Classify every rule by how essential it is to the setup.</p></div><button type="button" className="secondary-button" onClick={addRule}><Plus size={16} /> Add rule</button></div>
            <div className="rule-input-list">
              {form.rules.map((rule: string, index: number) => {
                const importance: RuleImportance = form.rule_importance?.[index] || 'important'
                return (
                  <div className="rule-input rule-input-with-priority" key={form.rule_ids?.[index] || index}>
                    <span>{index + 1}</span>
                    <input value={rule} onChange={(e) => updateRule(index, e.target.value)} placeholder={\`Rule \${index + 1}\`} />
                    <div className="rule-priority-selector" role="group" aria-label={\`Importance for rule \${index + 1}\`}>
                      <button type="button" title="100% mandatory — this must be present" className={importance === 'mandatory' ? 'selected mandatory' : ''} onClick={() => updateRuleImportance(index, 'mandatory')}>Mandatory</button>
                      <button type="button" title="Highly important — strongly preferred" className={importance === 'important' ? 'selected important' : ''} onClick={() => updateRuleImportance(index, 'important')}>Important</button>
                      <button type="button" title="Nice to have — trade can still be valid without it" className={importance === 'optional' ? 'selected optional' : ''} onClick={() => updateRuleImportance(index, 'optional')}>Bonus</button>
                    </div>
                    <button type="button" onClick={() => removeRule(index)} aria-label={\`Remove rule \${index + 1}\`}><X size={16} /></button>
                  </div>
                )
              })}
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
            <article className={\`strategy-card \${strategy.status === 'archived' ? 'archived' : ''}\`} key={strategy.id}>
              <div className="strategy-card-top"><div><span className={\`status-dot \${strategy.status}\`} /> <span className="status-label">{strategy.status}</span></div><span className="version-badge">v{strategy.current_version}.0</span></div>
              <h3>{strategy.name}</h3>
              <p>{strategy.description || 'No description yet.'}</p>
              <div className="strategy-meta"><span>{strategy.primary_timeframe || '—'} entry</span><span>{strategy.higher_timeframe || '—'} HTF</span><span>{strategy.min_rr ? \`Min 1:\${strategy.min_rr}\` : 'RR flexible'}</span></div>
              <div className="rule-preview">
                {strategyRules.slice(0, 4).map((rule: Rule) => <div key={rule.id}><Check size={14} /><span>{rule.rule_text}</span><RuleImportanceBadge importance={rule.importance} /></div>)}
                {strategyRules.length > 4 && <small>+{strategyRules.length - 4} more rules</small>}
              </div>
              <RuleExamplesPanel strategy={strategy} rules={strategyRules} userId={user.id} />
              <div className="strategy-card-actions"><button className="secondary-button" onClick={() => startEdit(strategy)}>Edit rules</button><button className="text-button" onClick={() => archive(strategy)}>{strategy.status === 'archived' ? 'Restore' : 'Archive'}</button></div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
`

source = source.slice(0, start) + strategiesPage + source.slice(end)

mustReplace(
  "  const adherencePreview = useMemo(() => {\n    const values = Object.values(ruleStates)\n    const followed = values.filter((v) => v === 'followed').length\n    const violated = values.filter((v) => v === 'violated').length\n    return followed + violated === 0 ? 0 : (followed / (followed + violated)) * 100\n  }, [ruleStates])\n",
  "  const adherencePreview = useMemo(() => {\n    const values = Object.values(ruleStates)\n    const followed = values.filter((v) => v === 'followed').length\n    const violated = values.filter((v) => v === 'violated').length\n    return followed + violated === 0 ? 0 : (followed / (followed + violated)) * 100\n  }, [ruleStates])\n  const mandatoryViolationCount = useMemo(() => strategyRules.filter((rule) => rule.importance === 'mandatory' && ruleStates[rule.id] === 'violated').length, [strategyRules, ruleStates])\n",
  'mandatory violation count',
)

mustReplace(
  "        rule_text_snapshot: rule.rule_text,\n        rule_sort_order: rule.sort_order,\n        status: ruleStates[rule.id] || 'na',",
  "        rule_text_snapshot: rule.rule_text,\n        rule_sort_order: rule.sort_order,\n        rule_importance_snapshot: rule.importance || 'important',\n        status: ruleStates[rule.id] || 'na',",
  'trade rule importance snapshot',
)

mustReplace(
  "              <div className=\"rule-copy\"><span>{index + 1}</span><strong>{rule.rule_text}</strong></div>",
  "              <div className=\"rule-copy\"><span>{index + 1}</span><div className=\"rule-copy-text\"><strong>{rule.rule_text}</strong><RuleImportanceBadge importance={rule.importance} /></div></div>",
  'trade checklist importance badge',
)

mustReplace(
  "        </div>\n      </section>\n\n      <section className=\"panel\">\n        <PanelHeader title=\"Risk & result\"",
  "        </div>\n        {mandatoryViolationCount > 0 && <div className=\"mandatory-rule-warning\">{mandatoryViolationCount} mandatory rule{mandatoryViolationCount > 1 ? 's were' : ' was'} violated. The trade can still be logged so the journal records the process failure.</div>}\n      </section>\n\n      <section className=\"panel\">\n        <PanelHeader title=\"Risk & result\"",
  'mandatory violation warning',
)

mustReplace(
  "<div className={`rule-history ${check.status}`} key={check.id}>{check.status === 'followed' ? <Check size={14} /> : check.status === 'violated' ? <X size={14} /> : <span>—</span>}<span>{check.rule_text_snapshot}</span></div>",
  "<div className={`rule-history ${check.status}`} key={check.id}>{check.status === 'followed' ? <Check size={14} /> : check.status === 'violated' ? <X size={14} /> : <span>—</span>}<span>{check.rule_text_snapshot}</span><RuleImportanceBadge importance={check.rule_importance_snapshot} /></div>",
  'journal rule importance badge',
)

fs.writeFileSync(path, source)
console.log('Rule importance integration applied successfully.')
