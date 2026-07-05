#!/usr/bin/env node
/**
 * Dump full intake log as JSON to stdout.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/replay-intake.mjs <intake_id>
 */
import { createClient } from '@supabase/supabase-js'

const intakeId = process.argv[2]
if (!intakeId) {
  console.error('Usage: node scripts/replay-intake.mjs <intake_id>')
  process.exit(1)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key)

const [intake, messages, media, rating] = await Promise.all([
  admin.from('intakes').select('*').eq('id', intakeId).maybeSingle(),
  admin.from('intake_messages').select('*').eq('intake_id', intakeId).order('created_at'),
  admin.from('intake_media').select('*').eq('intake_id', intakeId).order('created_at'),
  admin.from('intake_ratings').select('*').eq('intake_id', intakeId).maybeSingle(),
])

console.log(
  JSON.stringify(
    {
      intake: intake.data,
      messages: messages.data ?? [],
      media: media.data ?? [],
      rating: rating.data,
      errors: [intake.error, messages.error, media.error, rating.error].filter(Boolean),
    },
    null,
    2
  )
)
