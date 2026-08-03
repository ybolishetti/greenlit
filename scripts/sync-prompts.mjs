#!/usr/bin/env node
/**
 * Syncs src/lib/ai/prompts/*.md → supabase/functions/llm-proxy/prompts/*.md
 * and generates supabase/functions/llm-proxy/prompts/*.ts (base64-inlined)
 * so the Edge Function bundler ships the prompt content (it cannot trace
 * runtime Deno.readTextFile calls, so bare .md files never get deployed).
 *
 *   node scripts/sync-prompts.mjs         copy source → dest, regenerate .ts
 *   node scripts/sync-prompts.mjs --check   exit 1 if dest .md or generated .ts differ (build gate)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'src/lib/ai/prompts')
const destDir = path.join(root, 'supabase/functions/llm-proxy/prompts')
const checkOnly = process.argv.includes('--check')

const CONST_NAMES = {
  'interviewer.md': 'INTERVIEWER_PROMPT',
  'diagnostician.md': 'DIAGNOSTICIAN_PROMPT',
}

function tsFileName(mdFile) {
  return mdFile.replace(/\.md$/, '.ts')
}

function renderTsModule(mdFile, content) {
  const constName = CONST_NAMES[mdFile]
  if (!constName) {
    throw new Error(`No const name mapping for ${mdFile} — add it to CONST_NAMES in scripts/sync-prompts.mjs`)
  }
  const b64 = Buffer.from(content, 'utf8').toString('base64')
  return `// Auto-generated from ${mdFile} — do not edit. Run: node scripts/sync-prompts.mjs
const B64 =
  '${b64}'
export const ${constName} = new TextDecoder().decode(
  Uint8Array.from(atob(B64), (c) => c.charCodeAt(0))
)
`
}

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md'))
const mismatches = []

for (const file of files) {
  const srcPath = path.join(srcDir, file)
  const destPath = path.join(destDir, file)
  const src = fs.readFileSync(srcPath, 'utf8')

  if (!fs.existsSync(destPath)) {
    mismatches.push(`${file} (missing in dest)`)
  } else {
    const dest = fs.readFileSync(destPath, 'utf8')
    if (src !== dest) mismatches.push(file)
  }

  const tsPath = path.join(destDir, tsFileName(file))
  const expectedTs = renderTsModule(file, src)
  if (!fs.existsSync(tsPath)) {
    mismatches.push(`${tsFileName(file)} (missing in dest)`)
  } else if (fs.readFileSync(tsPath, 'utf8') !== expectedTs) {
    mismatches.push(`${tsFileName(file)} (stale)`)
  }
}

if (checkOnly) {
  if (mismatches.length > 0) {
    console.error('Prompt sync required. Run: npm run sync-prompts')
    console.error('Drift:', mismatches.join(', '))
    process.exit(1)
  }
  console.log('Prompts in sync.')
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
for (const file of files) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8')
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file))
  fs.writeFileSync(path.join(destDir, tsFileName(file)), renderTsModule(file, content))
}
console.log(`Synced ${files.length} prompt(s) + generated ${files.length} .ts module(s) → ${destDir}`)
