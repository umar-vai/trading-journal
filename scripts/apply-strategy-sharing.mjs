import fs from 'node:fs'

const appPath = 'src/App.tsx'
const mainPath = 'src/main.tsx'
let app = fs.readFileSync(appPath, 'utf8')
let main = fs.readFileSync(mainPath, 'utf8')

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

app = replaceOnce(
  app,
  "import { PendingTradeScreenshots, RuleExamplesPanel, uploadPendingTradeScreenshots, type PendingTradeScreenshot } from './ScreenshotFeatures'\n",
  "import { PendingTradeScreenshots, RuleExamplesPanel, uploadPendingTradeScreenshots, type PendingTradeScreenshot } from './ScreenshotFeatures'\nimport { SharedStrategyPage, StrategyShareControls } from './StrategySharing'\n",
  'StrategySharing import',
)

app = replaceOnce(
  app,
  `export default function App() {\n  const [session, setSession] = useState<any>(null)\n  const [loading, setLoading] = useState(true)\n\n  useEffect(() => {\n    supabase.auth.getSession().then(({ data }) => {\n      setSession(data.session)\n      setLoading(false)\n    })\n    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))\n    return () => data.subscription.unsubscribe()\n  }, [])\n\n  if (loading) return <FullScreenLoader />\n  if (!session) return <AuthScreen />\n  return <TradingJournal user={session.user} />\n}\n`,
  `export default function App() {\n  const [session, setSession] = useState<any>(null)\n  const [loading, setLoading] = useState(true)\n  const query = new URLSearchParams(window.location.search)\n  const shareToken = query.get('share')\n  const shareAuthRequested = query.get('auth') === '1'\n\n  useEffect(() => {\n    supabase.auth.getSession().then(({ data }) => {\n      setSession(data.session)\n      setLoading(false)\n    })\n    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))\n    return () => data.subscription.unsubscribe()\n  }, [])\n\n  if (loading) return <FullScreenLoader />\n  if (shareToken && (!shareAuthRequested || session)) {\n    return <SharedStrategyPage token={shareToken} session={session} onRequireAuth={() => {\n      const url = new URL(window.location.href)\n      url.searchParams.set('auth', '1')\n      window.location.assign(url.toString())\n    }} />\n  }\n  if (!session) return <AuthScreen />\n  return <TradingJournal user={session.user} />\n}\n`,
  'App shared page routing',
)

app = replaceOnce(
  app,
  "          emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,",
  "          emailRedirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}` ,",
  'signup redirect',
)

app = replaceOnce(
  app,
  "    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`",
  "    const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`",
  'password reset redirect',
)

app = replaceOnce(
  app,
  '              <RuleExamplesPanel strategy={strategy} rules={strategyRules} userId={user.id} />\n              <div className="strategy-card-actions">',
  '              <StrategyShareControls strategy={strategy} />\n              <RuleExamplesPanel strategy={strategy} rules={strategyRules} userId={user.id} />\n              <div className="strategy-card-actions">',
  'strategy share controls',
)

if (!main.includes("import './strategy-sharing.css'")) {
  main = replaceOnce(
    main,
    "import './screenshot-features.css'\n",
    "import './screenshot-features.css'\nimport './strategy-sharing.css'\n",
    'sharing css import',
  )
}

fs.writeFileSync(appPath, app)
fs.writeFileSync(mainPath, main)
console.log('Strategy sharing integration applied.')
