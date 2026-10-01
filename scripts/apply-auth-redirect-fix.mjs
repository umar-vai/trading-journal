import fs from 'node:fs'

const appPath = 'src/App.tsx'
let app = fs.readFileSync(appPath, 'utf8')

const oldSnippet = `        options: { data: { display_name: displayName || email.split('@')[0] } },`
const newSnippet = `        options: {
          emailRedirectTo: \`\${window.location.origin}\${import.meta.env.BASE_URL}\`,
          data: { display_name: displayName || email.split('@')[0] },
        },`

if (app.includes('emailRedirectTo:')) {
  console.log('Auth signup redirect is already configured.')
  process.exit(0)
}

if (!app.includes(oldSnippet)) {
  throw new Error('Could not find signup options block in src/App.tsx')
}

app = app.replace(oldSnippet, newSnippet)
fs.writeFileSync(appPath, app)
console.log('Auth signup redirect fix applied successfully.')
