## Summary

- Adds production-ready Supabase backend (schema, RLS, private storage, Postgres-backed LLM rate limiting) with `llm-proxy` Edge Function for secure LLM calls, intake reads, and signed URLs.
- Replaces the linear v1 intake with a 4-modality input picker, media upload, and two-model conversational loop (Interviewer + Diagnostician) with turn limits, Zod validation, and deterministic stub mode for zero-config demos.
- Migrates the UI to the business-plan brand green palette, adds magic-link shop dashboard with outcome ratings, dev debug replay page, and automated prompt sync on build.

## Deviations (justified)

| Deviation | Why |
|-----------|-----|
| **In-memory intake store** when Supabase env is unset | Required for acceptance item #1 (boots with no `.env.local`, stub drives flow) after deleting `localStorage` — session-scoped only, not dual-write. |
| **`stub_brief` Edge Function path** | When Supabase is configured but `VITE_LLM_STUB_MODE=true`, client validates stub output locally and Edge Function persists `intakes.brief` authoritatively — same write path as real AI without exposing LLM keys. |
| **`get_intake` Edge intent** | Anon RLS blocks all SELECT on intake tables; Edge Function uses service role with 30-min window or shop-member auth. Approved in plan review. |

All six required plan changes from review were implemented: UUID+slug shops, Edge Zod validation, Postgres rate limits, automated prompt sync, authoritative brief writes, explicit metadata-only `media_summary`.

## Acceptance walkthrough (18 items)

### Local / no-backend demo

- [x] **1. Boots with no console errors, no `.env.local` — stub drives flow (Chrome)**  
  `npm install && npm run dev` → `/intake` → pick modality → capture → answer 2 stub rounds → name step → `/brief/:id`. No env required; in-memory store used when Supabase unset.

- [x] **2. New palette everywhere; `grep -R "lime" src/` clean**  
  Verified: zero matches. Tokens in `src/index.css`: `--brand #4CAF6B`, `--ink #0F1613`, etc.

- [x] **3. Input picker → 4 modalities**  
  `/intake` shows Record audio · Record video · Take a photo · Describe it cards (`InputPicker.jsx`).

- [x] **4. Media persisted to Storage (with Supabase configured)**  
  `uploadMedia()` writes to `intake-media` bucket at `{intake_id}/{media_id}.{ext}` + `intake_media` row. Text modality writes `kind='text'` with `text_content` directly.

### AI flow & turn limits

- [x] **5. Turn limits: ≤6 questions, ≤3 rounds, ≤3 per round**  
  Enforced in `src/lib/intake/turnLimits.js`; Interviewer payload includes `total_questions_asked` and `force_done`.

- [x] **6. Forced-done at confidence ≥ 0.75**  
  After each Diagnostician hypothesis, `shouldForceDone()` checks confidence; logs `system_event` `forced_done` and skips to name/brief step. Stub round 2 returns 0.78.

- [x] **7. Message contract matches `src/lib/ai/schemas.js`**  
  Canonical Zod schemas; Edge `schemas.ts` mirrors exactly. Roles: user, interviewer, diagnostician, system.

- [x] **8. Stub ↔ real AI via env only**  
  `VITE_LLM_STUB_MODE=true` or missing Supabase URL → stub. Set `false` + deploy Edge Function → real OpenAI. No code changes.

- [x] **9. Zod fail → retry → fallback**  
  Edge Function retries once with schema hint; client `runInterviewer()` falls back to natural_language question on `validation_failed` and logs `system_event`.

- [x] **10. Customer name optional at end**  
  Name step before brief generation → `intakes.customer_name`.

### Security / RLS (verify on linked Supabase project)

- [ ] **11. Anon cannot SELECT intake data**  
  **Verify:** Browser console → `supabase.from('intakes').select()` → RLS error. Reads only via `get_intake` Edge intent.

- [ ] **12. Anon cannot INSERT messages for intake > 30 min old**  
  **Verify:** Backdate `intakes.created_at` in SQL, attempt `appendMessage` → RLS denial.

- [ ] **13. Direct public URL fetch of media returns 403**  
  **Verify:** `curl` storage public URL without signed token → 403. Signed URL from Edge `signed_url` intent works (5-min TTL).

- [ ] **14. Migration applies cleanly to fresh project**  
  **Verify:** `supabase db reset` on new project → all tables, RLS, storage bucket, `demo-shop` seed apply without error.

### Shop dashboard & auth

- [ ] **15. Dashboard requires magic-link login**  
  `/shop/demo-shop/dashboard` → `AuthGate` email OTP. Seed links `yashbolishetti@gmail.com` as demo shop owner (sign up first, re-run seed if needed).

- [ ] **16. Outcome rating loop preserved → `intake_ratings`**  
  Rate outcome on dashboard → `saveRating()` upserts with `rated_by` → visible cross-session.

- [ ] **17. QR / shop landing flow preserved**  
  `/shop/demo-shop` resolves shop name from `shops` table (anon SELECT), QR links to `/intake?shop=demo-shop`.

### Dev tooling

- [x] **18. `/dev/intake/:id` renders full log**  
  Dev mode or `?debug=1` + authed shop member. Shows intake row, media (with signed URLs), hypotheses, system_events, full message log.

### Additional checks

- [x] PDF export uses brand green `[76, 175, 107]`
- [x] `mockDiagnosis.js` preserved; stub uses `generateBrief()`
- [x] `DownloadAppButton` click handler remains inert
- [x] `npm run build` passes; prompt sync gate enforced via `prebuild --check`
- [x] `node scripts/replay-intake.mjs <id>` dumps JSON log (requires service role key)

## Test plan

1. **Zero-config demo:** `npm run dev` (no `.env.local`) → full intake → brief → PDF in Chrome.
2. **Supabase setup:** Link project → `supabase db push` → set `.env.local` → complete intake → verify rows in dashboard tables.
3. **Edge Function:** Deploy `llm-proxy` → set secrets → `VITE_LLM_STUB_MODE=false` → real AI flow.
4. **RLS audit:** Run verification steps 11–14 above in browser console / SQL.
5. **Dashboard:** Magic-link login → list intakes → rate outcome → reload confirms persistence.
6. **Debug:** Complete intake → visit `/dev/intake/:id` → confirm full message log.

## Commits

1. `feat(supabase): initial schema, RLS, storage, and seed`
2. `feat(supabase): llm-proxy edge function with server-side validation`
3. `feat(client): Supabase wiring, db layer, and demo memory store`
4. `feat(ai): stub engine, LLM client, and turn-limit helpers`
5. `feat(intake): AI-driven flow, brand palette, and intake UI`
6. `docs: README v2 setup guide and implementation plan`
