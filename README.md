# Greenlit — web

Greenlit turns a car owner's vague symptom description into a mechanic-ready diagnostic brief. This is the web pitch/demo surface; the native iOS lock-screen shortcut is deferred.

**Recommended browser:** Google Chrome (desktop or Android). iOS Safari has known `MediaRecorder` limitations that are not addressed until the native app ships.

## Quick start (demo, no backend)

```bash
npm install
npm run dev
```

With no `.env.local`, the app runs in **stub mode** — a deterministic 2-round intake script drives the flow with no Supabase or LLM keys required.

## Full stack setup

### 1. Supabase

See [supabase/README.md](./supabase/README.md) for schema, RLS, environments, and prod checklist.

```bash
supabase link --project-ref <ref>
supabase db push
```

### 2. Environment variables

Copy `.env.example` to `.env.local`:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_LLM_STUB_MODE=true   # set false when Edge Function + OpenAI are ready
```

Configure the same vars per environment in Vercel (`greenlit-dev`, `greenlit-staging`, `greenlit-prod`).

### 3. Edge Function

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase functions deploy llm-proxy
```

Set `VITE_LLM_STUB_MODE=false` to use real AI. The Diagnostician endpoint is env-swappable — see TODO markers in `supabase/functions/llm-proxy/index.ts` for the future fine-tuned model swap.

### 4. Prompt sync

System prompts live in `src/lib/ai/prompts/`. Before every build:

```bash
npm run sync-prompts    # copy to Edge Function bundle
npm run build           # fails if prompts drift (--check via prebuild)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Sync prompts + production build |
| `npm run sync-prompts` | Copy prompts to Edge Function |
| `npm run replay-intake <id>` | Dump intake log as JSON (needs service role key) |

## Routes

| Path | Description |
|------|-------------|
| `/intake` | Input picker + capture |
| `/intake/:id` | AI conversational loop |
| `/brief/:id` | Mechanic brief + PDF export |
| `/shop/:slug` | Shop QR landing page |
| `/shop/:slug/dashboard` | Magic-link shop dashboard + outcome ratings |
| `/dev/intake/:id` | Debug replay (dev or `?debug=1` + authed shop member) |
| `/dev/annotate` | Training annotation UI (annotator/admin only) |

## Architecture notes

- **Anon never SELECTs intake data** — reads go through the `llm-proxy` Edge Function (`get_intake` intent).
- **Edge Function is authoritative** for `intakes.brief`, `status`, `urgency`, `category` on final diagnosis.
- **LLM keys** live only in Edge Function secrets, never in the browser bundle.
- **Message contract** is defined in `src/lib/ai/schemas.js` (canonical); Edge validators mirror it.
- **`mockDiagnosis.js`** is kept for the stub engine and as a future Diagnostician prior.

### v2.1 architecture (implemented)

The v2 codebase implements the Interviewer + Diagnostician + rules-layer architecture. v2.1 formalizes remaining decisions:

- **[docs/architecture-v2.1.md](./docs/architecture-v2.1.md)** — canonical architecture spec
- **[docs/architecture-v2.1-business-context.md](./docs/architecture-v2.1-business-context.md)** — business plan amendment

Key v2.1 features: vehicle context (Step 0), deterministic `uiRules.js`, streaming final brief, env-swappable model IDs, training export + annotation UI stub.

## Known limitations (v2)

- No Whisper or vision — LLMs receive metadata + text `media_summary` only.
- 30-minute anon INSERT window for messages/media (see supabase README).
- iOS Safari recording is unsupported on web.
- `DownloadAppButton` is inert until the native app ships.

## Before public launch

See the checklist in [supabase/README.md](./supabase/README.md): audit anon policies, rotate service role key, enable Sentry, schedule `llm_call_log` cleanup.
