import fs from 'node:fs'

const path = 'src/AdvancedFeatures.tsx'
let source = fs.readFileSync(path, 'utf8')

const oldBlock = `  const months = useMemo(() => {\n    const values = [...new Set((trades || []).map((trade: any) => String(trade.trade_date || '').slice(0, 7)).filter(Boolean))]\n    const current = new Date().toISOString().slice(0, 7)\n    if (!values.includes(current)) values.push(current)\n    return values.sort().reverse()\n  }, [trades])`

const newBlock = `  const months = useMemo<string[]>(() => {\n    const values = Array.from(new Set<string>((trades || []).map((trade: any) => String(trade.trade_date || '').slice(0, 7)).filter(Boolean)))\n    const current = new Date().toISOString().slice(0, 7)\n    if (!values.includes(current)) values.push(current)\n    return values.sort().reverse()\n  }, [trades])`

if (source.includes(newBlock)) {
  console.log('Advanced report types are already fixed.')
  process.exit(0)
}
if (!source.includes(oldBlock)) throw new Error('Could not find ReportsPage month-list block.')
source = source.replace(oldBlock, newBlock)
fs.writeFileSync(path, source)
console.log('Advanced report TypeScript inference fixed.')
