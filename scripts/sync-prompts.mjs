#!/usr/bin/env node
/**
 * Syncs src/lib/ai/prompts/*.md → supabase/functions/llm-proxy/prompts/*.md
 *
 *   node scripts/sync-prompts.mjs         copy source → dest
 *   node scripts/sync-prompts.mjs --check   exit 1 if dest differs from source (build gate)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'src/lib/ai/prompts')
const destDir = path.join(root, 'supabase/functions/llm-proxy/prompts')
const checkOnly = process.argv.includes('--check')

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md'))
const mismatches = []

for (const file of files) {
  const srcPath = path.join(srcDir, file)
  const destPath = path.join(destDir, file)
  const src = fs.readFileSync(srcPath, 'utf8')

  if (!fs.existsSync(destPath)) {
    mismatches.push(`${file} (missing in dest)`)
    continue
  }

  const dest = fs.readFileSync(destPath, 'utf8')
  if (src !== dest) mismatches.push(file)
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
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file))
}
console.log(`Synced ${files.length} prompt(s) → ${destDir}`)
