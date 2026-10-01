import fs from 'node:fs'

const appPath = 'src/App.tsx'
const cssPath = 'src/styles.css'
let app = fs.readFileSync(appPath, 'utf8')
let css = fs.readFileSync(cssPath, 'utf8')

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) {
    if (source.includes(newText)) return source
    throw new Error(`Could not find patch target: ${label}`)
  }
  return source.replace(oldText, newText)
}

app = replaceOnce(
  app,
  "const emotions = ['Calm', 'Focused', 'FOMO', 'Fear', 'Greed', 'Revenge', 'Overconfident', 'Tired', 'Distracted']\n",
  "const emotions = ['Calm', 'Focused', 'FOMO', 'Fear', 'Greed', 'Revenge', 'Overconfident', 'Tired', 'Distracted']\nconst popularPairs = ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'GBPJPY', 'EURJPY', 'EURGBP', 'AUDJPY', 'NAS100', 'US30', 'SPX500', 'GER40', 'BTCUSD', 'BTCUSDT', 'ETHUSD', 'ETHUSDT']\n",
  'popular pairs constant',
)

app = replaceOnce(
  app,
  "  const navItems: { id: View; label: string; icon: any }[] = [\n    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },\n    { id: 'strategies', label: 'Strategies', icon: Target },\n    { id: 'new-trade', label: 'New Trade', icon: Plus },\n    { id: 'journal', label: 'Journal', icon: BookOpen },\n    { id: 'analytics', label: 'Analytics', icon: BarChart3 },\n    { id: 'reports', label: 'Reports', icon: CalendarDays },\n  ]\n",
  "  const navItems: { id: View; label: string; icon: any }[] = [\n    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },\n    { id: 'strategies', label: 'Strategies', icon: Target },\n    { id: 'new-trade', label: 'New Trade', icon: Plus },\n    { id: 'journal', label: 'Journal', icon: BookOpen },\n    { id: 'analytics', label: 'Analytics', icon: BarChart3 },\n    { id: 'reports', label: 'Reports', icon: CalendarDays },\n  ]\n  const mobileBottomItems = navItems.filter((item) => ['dashboard', 'strategies', 'new-trade', 'journal'].includes(item.id))\n",
  'mobile nav items',
)

app = replaceOnce(
  app,
  "      </main>\n    </div>\n  )\n}\n\nfunction SectionLoader()",
  "      </main>\n\n      <nav className=\"mobile-bottom-nav\" aria-label=\"Primary mobile navigation\">\n        {mobileBottomItems.map((item) => {\n          const Icon = item.icon\n          return (\n            <button\n              key={item.id}\n              type=\"button\"\n              className={`${view === item.id ? 'active' : ''} ${item.id === 'new-trade' ? 'mobile-bottom-action' : ''}`}\n              onClick={() => navigate(item.id)}\n              aria-current={view === item.id ? 'page' : undefined}\n            >\n              <span className=\"mobile-bottom-icon\"><Icon size={item.id === 'new-trade' ? 22 : 19} /></span>\n              <span>{item.id === 'new-trade' ? 'New' : item.label}</span>\n            </button>\n          )\n        })}\n        <button type=\"button\" className={mobileMenu ? 'active' : ''} onClick={() => setMobileMenu(true)}>\n          <span className=\"mobile-bottom-icon\"><Menu size={19} /></span>\n          <span>More</span>\n        </button>\n      </nav>\n    </div>\n  )\n}\n\nfunction SectionLoader()",
  'mobile bottom navigation markup',
)

app = replaceOnce(
  app,
  "  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([])\n  const [customMistake, setCustomMistake] = useState('')\n",
  "  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([])\n  const [customMistake, setCustomMistake] = useState('')\n  const [useCustomSymbol, setUseCustomSymbol] = useState(false)\n",
  'custom symbol state',
)

app = replaceOnce(
  app,
  "  const selectedStrategy = activeStrategies.find((s: Strategy) => s.id === form.strategy_id)\n  const strategyRules: Rule[] = rulesByStrategy[form.strategy_id] || []\n",
  "  const selectedStrategy = activeStrategies.find((s: Strategy) => s.id === form.strategy_id)\n  const strategyRules: Rule[] = rulesByStrategy[form.strategy_id] || []\n  const pairOptions = useMemo(() => {\n    const strategyMarkets = (selectedStrategy?.markets || []).map((market: string) => market.trim().toUpperCase()).filter(Boolean)\n    return Array.from(new Set([...strategyMarkets, ...popularPairs]))\n  }, [selectedStrategy])\n",
  'pair options',
)

app = replaceOnce(
  app,
  "          <label>Symbol<input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder=\"XAUUSD\" /></label>\n",
  "          <label>Pair / instrument<div className=\"pair-select-stack\"><select value={useCustomSymbol ? '__CUSTOM__' : form.symbol} onChange={(e) => { const value = e.target.value; if (value === '__CUSTOM__') { setUseCustomSymbol(true); setForm({ ...form, symbol: '' }) } else { setUseCustomSymbol(false); setForm({ ...form, symbol: value }) } }}>{pairOptions.map((pair) => <option key={pair} value={pair}>{pair}</option>)}<option value=\"__CUSTOM__\">Other / custom symbol…</option></select>{useCustomSymbol && <input autoFocus value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} placeholder=\"Type broker symbol, e.g. USOIL\" />}</div></label>\n",
  'pair selector',
)

const themeCss = `\n\n/* mobile-navigation-and-control-theme-v3 */\n:root { color-scheme: dark; }\n::selection { background: rgba(99,230,190,.28); color: #f5fffb; }\ninput, select, textarea, button { -webkit-tap-highlight-color: transparent; }\ninput, select, textarea { color-scheme: dark; }\nselect {\n  appearance: none;\n  -webkit-appearance: none;\n  cursor: pointer;\n  padding-right: 40px;\n  background-color: #0a0f16;\n  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237e8a99' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\");\n  background-repeat: no-repeat;\n  background-position: right 12px center;\n  background-size: 16px;\n}\nselect:hover { border-color: #344356; background-color: #0d131c; }\nselect option, select optgroup { background: #0d141d; color: #e8eef6; }\nselect option:checked { background: #173128; color: #9bf3d6; }\ninput[type='date'], input[type='time'], input[type='datetime-local'] { color-scheme: dark; }\ninput[type='date']::-webkit-calendar-picker-indicator, input[type='time']::-webkit-calendar-picker-indicator, input[type='datetime-local']::-webkit-calendar-picker-indicator { filter: invert(.72) sepia(.08) saturate(.7); cursor: pointer; opacity: .9; }\n.pair-select-stack { display: grid; gap: 8px; }\n.pair-select-stack select { font-weight: 700; letter-spacing: .025em; }\n.mobile-bottom-nav { display: none; }\n\n@media (max-width: 680px) {\n  .mobile-menu-button { display: none; }\n  .main-content { padding-bottom: calc(82px + env(safe-area-inset-bottom)); }\n  .page-content { padding-bottom: 22px; }\n  .sticky-save { bottom: calc(76px + env(safe-area-inset-bottom)); }\n  .mobile-bottom-nav {\n    position: fixed;\n    left: 10px;\n    right: 10px;\n    bottom: calc(8px + env(safe-area-inset-bottom));\n    z-index: 45;\n    display: grid;\n    grid-template-columns: repeat(5, minmax(0, 1fr));\n    align-items: end;\n    min-height: 64px;\n    padding: 7px 6px 6px;\n    border: 1px solid rgba(42,55,69,.92);\n    border-radius: 20px;\n    background: rgba(10,15,22,.91);\n    backdrop-filter: blur(22px) saturate(145%);\n    -webkit-backdrop-filter: blur(22px) saturate(145%);\n    box-shadow: 0 14px 46px rgba(0,0,0,.46), inset 0 1px rgba(255,255,255,.025);\n  }\n  .mobile-bottom-nav button {\n    min-width: 0;\n    height: 50px;\n    border: 0;\n    border-radius: 13px;\n    background: transparent;\n    color: #778596;\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    gap: 3px;\n    font-size: 9px;\n    font-weight: 700;\n    line-height: 1;\n    transition: transform .16s ease, color .16s ease, background .16s ease;\n  }\n  .mobile-bottom-nav button.active:not(.mobile-bottom-action) { color: var(--accent); background: rgba(99,230,190,.075); }\n  .mobile-bottom-icon { height: 22px; display: grid; place-items: center; }\n  .mobile-bottom-action {\n    position: relative;\n    color: #07100d !important;\n    background: transparent !important;\n    overflow: visible;\n  }\n  .mobile-bottom-action .mobile-bottom-icon {\n    width: 45px;\n    height: 45px;\n    margin-top: -24px;\n    margin-bottom: 2px;\n    border-radius: 15px;\n    color: #07100d;\n    background: linear-gradient(135deg, var(--accent), #8ef1d3);\n    border: 4px solid #0a0f16;\n    box-shadow: 0 8px 24px rgba(56,217,169,.28);\n  }\n  .mobile-bottom-action > span:last-child { color: #9cebd3; }\n  .mobile-bottom-nav button:active { transform: scale(.94); }\n  .topbar { padding-left: 17px; }\n}\n\n@media (max-width: 380px) {\n  .mobile-bottom-nav { left: 6px; right: 6px; border-radius: 18px; }\n  .mobile-bottom-nav button { font-size: 8px; }\n}\n`

if (!css.includes('/* mobile-navigation-and-control-theme-v3 */')) css += themeCss

fs.writeFileSync(appPath, app)
fs.writeFileSync(cssPath, css)
console.log('Applied mobile bottom navigation, themed native controls, and popular pair selector.')
