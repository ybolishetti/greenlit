# Consumer Auth — Current State

**Status:** Live (Option 1 — auth free for all, no paywall).
**Landed:** 2026-07-06 (commit dccc76e)

## What works
- Google OAuth via Supabase (GCP project: greenlit-prod, under yashbolishetti@gmail.com)
- Anonymous intake → `saveConsumerIntake` with `device_id`
- Sign in mid-intake → `claim_anonymous_intake` RPC transfers ownership
- `/account` route lists a signed-in user's briefs
- Session cap: 1 anonymous intake per browser session (soft — reload resets)

## What's deliberately NOT built (yet)
- Paywall / intake counter enforcement
- Stripe integration
- Free vs Premium tier gates
- Monthly intake limits
- Cost estimates + repair history (Premium features per business plan)

## When paywall lands
1. Populate `consumer_profiles.subscription_tier` on signup (default `'free'`, existing beta users → `'beta_lifetime'`)
2. Add server-side monthly intake counter (edge function)
3. Gate Premium features behind `tier IN ('premium', 'beta_lifetime')`
4. Add Stripe checkout flow

## Admin tools
- `/dev/consumer-intakes` — lists all consumer intakes (email allowlist, dev-only)
