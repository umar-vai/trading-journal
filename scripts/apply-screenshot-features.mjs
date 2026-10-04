import fs from 'node:fs'

const path = 'src/App.tsx'
let app = fs.readFileSync(path, 'utf8')

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Could not find patch target: ${label}`)
  return source.replace(from, to)
}

app = replaceOnce(
  app,
  "import { InfoLabel, InfoTip } from './InfoTip'\n",
  "import { InfoLabel, InfoTip } from './InfoTip'\nimport { PendingTradeScreenshots, RuleExamplesPanel, uploadPendingTradeScreenshots, type PendingTradeScreenshot } from './ScreenshotFeatures'\n",
  'screenshot feature import',
)

app = replaceOnce(
  app,
  '              <div className="strategy-card-actions"><button className="secondary-button" onClick={() => startEdit(strategy)}>Edit rules</button><button className="text-button" onClick={() => archive(strategy)}>{strategy.status === \'archived\' ? \'Restore\' : \'Archive\'}</button></div>',
  '              <RuleExamplesPanel strategy={strategy} rules={strategyRules} userId={user.id} />\n              <div className="strategy-card-actions"><button className="secondary-button" onClick={() => startEdit(strategy)}>Edit rules</button><button className="text-button" onClick={() => archive(strategy)}>{strategy.status === \'archived\' ? \'Restore\' : \'Archive\'}</button></div>',
  'strategy rule examples panel',
)

app = replaceOnce(
  app,
  "  const [customMistake, setCustomMistake] = useState('')\n  const [useCustomSymbol, setUseCustomSymbol] = useState(false)",
  "  const [customMistake, setCustomMistake] = useState('')\n  const [pendingScreenshots, setPendingScreenshots] = useState<PendingTradeScreenshot[]>([])\n  const [useCustomSymbol, setUseCustomSymbol] = useState(false)",
  'pending trade screenshot state',
)

app = replaceOnce(
  app,
  "    if (selectedMistakes.length) {\n      const mistakeRows = selectedMistakes.map((mistake) => ({ trade_id: trade.id, user_id: user.id, mistake }))\n      const { error: mistakeError } = await supabase.from('trade_mistakes').insert(mistakeRows)\n      if (mistakeError) { await supabase.from('trades').delete().eq('id', trade.id); setError(mistakeError.message); setBusy(false); return }\n    }\n    setBusy(false)\n    onSaved()",
  "    if (selectedMistakes.length) {\n      const mistakeRows = selectedMistakes.map((mistake) => ({ trade_id: trade.id, user_id: user.id, mistake }))\n      const { error: mistakeError } = await supabase.from('trade_mistakes').insert(mistakeRows)\n      if (mistakeError) { await supabase.from('trades').delete().eq('id', trade.id); setError(mistakeError.message); setBusy(false); return }\n    }\n    if (pendingScreenshots.length) {\n      try {\n        await uploadPendingTradeScreenshots({ screenshots: pendingScreenshots, userId: user.id, tradeId: trade.id })\n      } catch (screenshotError: any) {\n        await supabase.from('trades').delete().eq('id', trade.id)\n        setError(`Screenshot upload failed: ${screenshotError?.message || 'Please try again.'}`)\n        setBusy(false)\n        return\n      }\n    }\n    setBusy(false)\n    onSaved()",
  'trade screenshot upload transaction',
)

app = replaceOnce(
  app,
  "      <section className=\"panel\">\n        <PanelHeader title=\"Journal notes\" subtitle=\"Record what you saw before the result can influence your memory\" />",
  "      <PendingTradeScreenshots value={pendingScreenshots} onChange={setPendingScreenshots} />\n\n      <section className=\"panel\">\n        <PanelHeader title=\"Journal notes\" subtitle=\"Record what you saw before the result can influence your memory\" />",
  'trade screenshot picker',
)

fs.writeFileSync(path, app)
console.log('Screenshot features integrated into App.tsx')
