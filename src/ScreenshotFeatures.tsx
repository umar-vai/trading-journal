import { Clipboard, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { ClipboardEvent, DragEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('Only PNG, JPG and WEBP screenshots are allowed.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Each screenshot must be 10 MB or smaller.')
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-90) || 'screenshot.png'
}

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function readClipboardImageFiles() {
  const clipboard = navigator.clipboard as any
  if (!clipboard?.read) throw new Error('Direct clipboard access is not available here. Click the paste area, then press Ctrl/Cmd + V.')
  const items = await clipboard.read()
  const files: File[] = []
  for (const item of items) {
    const type = (item.types || []).find((candidate: string) => ALLOWED_IMAGE_TYPES.includes(candidate))
    if (!type) continue
    const blob = await item.getType(type)
    files.push(new File([blob], `pasted-${uniqueId()}.${type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1]}`, { type }))
  }
  if (!files.length) throw new Error('No image was found in your clipboard.')
  return files
}

function filesFromPaste(event: ClipboardEvent<HTMLElement>) {
  const files = Array.from(event.clipboardData?.files || []).filter((file) => ALLOWED_IMAGE_TYPES.includes(file.type))
  if (files.length) event.preventDefault()
  return files
}

function PreviewImage({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url ? <img src={url} alt={file.name} /> : null
}

export type PendingTradeScreenshot = {
  id: string
  file: File
  imageType: 'before' | 'exit'
}

function pendingFor(type: 'before' | 'exit', files: File[]) {
  return files.map((file) => {
    validateImage(file)
    return { id: uniqueId(), file, imageType: type } as PendingTradeScreenshot
  })
}

export function PendingTradeScreenshots({ value, onChange }: { value: PendingTradeScreenshot[]; onChange: (next: PendingTradeScreenshot[]) => void }) {
  const [error, setError] = useState('')

  function add(type: 'before' | 'exit', files: File[]) {
    try {
      const next = pendingFor(type, files)
      const sameTypeCount = value.filter((item) => item.imageType === type).length
      if (sameTypeCount + next.length > 6) throw new Error('Keep up to 6 screenshots in each section.')
      onChange([...value, ...next])
      setError('')
    } catch (err: any) {
      setError(err?.message || 'Could not add screenshot.')
    }
  }

  async function paste(type: 'before' | 'exit') {
    try {
      add(type, await readClipboardImageFiles())
    } catch (err: any) {
      setError(err?.message || 'Could not paste screenshot.')
    }
  }

  function onPaste(type: 'before' | 'exit', event: ClipboardEvent<HTMLDivElement>) {
    const files = filesFromPaste(event)
    if (files.length) add(type, files)
  }

  function onDrop(type: 'before' | 'exit', event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files || []).filter((file) => ALLOWED_IMAGE_TYPES.includes(file.type))
    if (files.length) add(type, files)
  }

  function remove(id: string) {
    onChange(value.filter((item) => item.id !== id))
  }

  return (
    <section className="panel pending-screenshot-panel">
      <div className="pending-screenshot-heading">
        <div><span className="eyebrow">VISUAL EVIDENCE</span><h3>Before & after screenshots</h3><p>Upload, drag in, or paste the chart you saw before entry and the chart after the trade.</p></div>
        <span className="pending-count">{value.length} selected</span>
      </div>
      <div className="pending-screenshot-grid">
        <PendingBucket type="before" title="Before entry" subtitle="Your chart before the trade" items={value.filter((item) => item.imageType === 'before')} onAdd={add} onPaste={onPaste} onDrop={onDrop} onPasteButton={paste} onRemove={remove} />
        <PendingBucket type="exit" title="After / exit" subtitle="How the setup played out" items={value.filter((item) => item.imageType === 'exit')} onAdd={add} onPaste={onPaste} onDrop={onDrop} onPasteButton={paste} onRemove={remove} />
      </div>
      {error && <div className="alert error pending-screenshot-error">{error}</div>}
    </section>
  )
}

function PendingBucket({ type, title, subtitle, items, onAdd, onPaste, onDrop, onPasteButton, onRemove }: any) {
  return (
    <div className="pending-bucket">
      <div className="pending-bucket-title"><ImageIcon size={17} /><div><strong>{title}</strong><span>{subtitle}</span></div></div>
      <div className="screenshot-dropzone" tabIndex={0} onPaste={(event) => onPaste(type, event)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(type, event)}>
        <Upload size={20} />
        <strong>Drop screenshot here</strong>
        <span>or focus this box and press Ctrl/Cmd + V</span>
        <div className="screenshot-actions">
          <label className="secondary-button screenshot-file-button"><Upload size={14} /> Upload<input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => { onAdd(type, Array.from(event.target.files || [])); event.currentTarget.value = '' }} /></label>
          <button type="button" className="secondary-button" onClick={() => onPasteButton(type)}><Clipboard size={14} /> Paste</button>
        </div>
      </div>
      {items.length > 0 && <div className="pending-preview-grid">{items.map((item: PendingTradeScreenshot) => <div className="pending-preview" key={item.id}><PreviewImage file={item.file} /><button type="button" title="Remove screenshot" onClick={() => onRemove(item.id)}><Trash2 size={13} /></button><span>{item.file.name}</span></div>)}</div>}
    </div>
  )
}

export async function uploadPendingTradeScreenshots({ screenshots, userId, tradeId }: { screenshots: PendingTradeScreenshot[]; userId: string; tradeId: string }) {
  if (!screenshots.length) return
  const uploadedPaths: string[] = []
  try {
    for (const item of screenshots) {
      validateImage(item.file)
      const path = `${userId}/trades/${tradeId}/${uniqueId()}-${safeName(item.file.name)}`
      const { error: uploadError } = await supabase.storage.from('trade-screenshots').upload(path, item.file, { upsert: false })
      if (uploadError) throw uploadError
      uploadedPaths.push(path)
      const { error: rowError } = await supabase.from('trade_images').insert({
        trade_id: tradeId,
        user_id: userId,
        bucket_path: path,
        image_type: item.imageType,
        notes: item.imageType === 'before' ? 'Before entry screenshot' : 'After / exit screenshot',
      })
      if (rowError) throw rowError
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.from('trade_images').delete().eq('trade_id', tradeId).in('bucket_path', uploadedPaths)
      await supabase.storage.from('trade-screenshots').remove(uploadedPaths)
    }
    throw error
  }
}

type RuleExample = {
  id: string
  user_id: string
  strategy_id: string
  rule_id?: string | null
  rule_text_snapshot: string
  rule_sort_order: number
  bucket_path: string
  caption?: string | null
  created_at: string
}

export function RuleExamplesPanel({ strategy, rules, userId }: { strategy: any; rules: any[]; userId: string }) {
  const [examples, setExamples] = useState<RuleExample[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [busyRule, setBusyRule] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    const { data, error: queryError } = await supabase.from('rule_examples').select('*').eq('strategy_id', strategy.id).order('rule_sort_order').order('created_at')
    if (queryError) { setError(queryError.message); return }
    const next = (data || []) as RuleExample[]
    setExamples(next)
    const pairs = await Promise.all(next.map(async (example) => {
      const { data: signed } = await supabase.storage.from('trade-screenshots').createSignedUrl(example.bucket_path, 3600)
      return [example.id, signed?.signedUrl || ''] as const
    }))
    setSignedUrls(Object.fromEntries(pairs))
  }

  useEffect(() => { load() }, [strategy.id, rules])

  const examplesByRule = useMemo(() => {
    const result: Record<string, RuleExample[]> = {}
    rules.forEach((rule) => {
      result[rule.id] = examples.filter((example) => example.rule_id === rule.id || (!example.rule_id && example.rule_sort_order === rule.sort_order))
    })
    return result
  }, [examples, rules])

  async function upload(rule: any, files: File[]) {
    if (!files.length) return
    setBusyRule(rule.id)
    setError('')
    const uploadedPaths: string[] = []
    try {
      for (const file of files) {
        validateImage(file)
        const path = `${userId}/rules/${strategy.id}/${rule.id}/${uniqueId()}-${safeName(file.name)}`
        const { error: uploadError } = await supabase.storage.from('trade-screenshots').upload(path, file, { upsert: false })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
        const { error: rowError } = await supabase.from('rule_examples').insert({
          user_id: userId,
          strategy_id: strategy.id,
          rule_id: rule.id,
          rule_text_snapshot: rule.rule_text,
          rule_sort_order: rule.sort_order,
          bucket_path: path,
          caption: captions[rule.id]?.trim() || null,
        })
        if (rowError) throw rowError
      }
      setCaptions((current) => ({ ...current, [rule.id]: '' }))
      await load()
    } catch (err: any) {
      if (uploadedPaths.length) await supabase.storage.from('trade-screenshots').remove(uploadedPaths)
      setError(err?.message || 'Could not upload rule example.')
    } finally {
      setBusyRule(null)
    }
  }

  async function paste(rule: any) {
    try {
      await upload(rule, await readClipboardImageFiles())
    } catch (err: any) {
      setError(err?.message || 'Could not paste screenshot.')
    }
  }

  function onRulePaste(rule: any, event: ClipboardEvent<HTMLDivElement>) {
    const files = filesFromPaste(event)
    if (files.length) upload(rule, files)
  }

  async function remove(example: RuleExample) {
    setBusyRule(example.rule_id || `orphan-${example.rule_sort_order}`)
    setError('')
    const { error: storageError } = await supabase.storage.from('trade-screenshots').remove([example.bucket_path])
    if (storageError) { setError(storageError.message); setBusyRule(null); return }
    const { error: rowError } = await supabase.from('rule_examples').delete().eq('id', example.id)
    if (rowError) setError(rowError.message)
    else await load()
    setBusyRule(null)
  }

  const total = examples.length
  return (
    <details className="rule-examples-panel">
      <summary><span><ImageIcon size={15} /> Rule chart examples</span><small>{total ? `${total} screenshot${total === 1 ? '' : 's'}` : 'Add visual references'}</small></summary>
      <div className="rule-example-list">
        {rules.map((rule, index) => {
          const ruleExamples = examplesByRule[rule.id] || []
          return (
            <div className="rule-example-row" key={rule.id}>
              <div className="rule-example-copy"><span>{index + 1}</span><strong>{rule.rule_text}</strong></div>
              {ruleExamples.length > 0 && <div className="rule-example-gallery">{ruleExamples.map((example) => <div className="rule-example-thumb" key={example.id}>{signedUrls[example.id] ? <a href={signedUrls[example.id]} target="_blank" rel="noreferrer"><img src={signedUrls[example.id]} alt={example.caption || rule.rule_text} /></a> : <div className="image-loading">Loading…</div>}<button type="button" title="Delete example" onClick={() => remove(example)}><Trash2 size={12} /></button>{example.caption && <span>{example.caption}</span>}</div>)}</div>}
              <input className="rule-example-caption" value={captions[rule.id] || ''} onChange={(event) => setCaptions((current) => ({ ...current, [rule.id]: event.target.value }))} placeholder="Optional note for this example" />
              <div className="rule-example-dropzone" tabIndex={0} onPaste={(event) => onRulePaste(rule, event)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); upload(rule, Array.from(event.dataTransfer.files || [])) }}>
                <span>Paste a chart here with Ctrl/Cmd + V, or</span>
                <div>
                  <label className="secondary-button screenshot-file-button"><Upload size={13} /> Upload<input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => { upload(rule, Array.from(event.target.files || [])); event.currentTarget.value = '' }} /></label>
                  <button type="button" className="secondary-button" disabled={busyRule === rule.id} onClick={() => paste(rule)}><Clipboard size={13} /> Paste screenshot</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {error && <div className="alert error rule-example-error">{error}</div>}
    </details>
  )
}
