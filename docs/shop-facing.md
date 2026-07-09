# Shop-facing website (beta)

Covers the marketing surface, admin provisioning, auth routing, and dashboard
layout added for the shop-facing beta. No self-signup, no Stripe, no metering
enforcement — see "Non-goals" below.

## Auth flow

One login, role-based redirect. There is no consumer/shop toggle on sign-in.

1. User clicks "Continue with Google" (same flow for consumers and shop
   staff — `AuthModal` / `signInWithGoogle`).
2. On the `SIGNED_IN` event, `AuthContext` calls
   `getShopMembershipsForUser(user.id)` (`src/lib/db/shopMembership.js`),
   which reads `shop_members` joined to `shops(slug, name)`.
3. If the user has one or more shop memberships:
   - They're treated as shop staff, not a consumer (no `upsertConsumerProfile`,
     no anonymous-intake claim).
   - If they signed in from `/` or `/account`, they're redirected to
     `/shop/:slug/dashboard` for their first shop membership.
   - If they signed in from somewhere under `/shop/...`, they're left alone.
4. If the user has no shop memberships, behavior is unchanged from before
   this PR: consumer profile upsert, pending-intake claim, post-auth redirect.

`shopMemberships` is exposed on `useAuth()` and read by `Navbar` (to swap
"Start intake" / "For shops" for "Go to dashboard" / "Shop dashboard") and by
`ShopDashboard`'s Team tab (to determine if the current user is an owner).

Membership is also fetched on initial page load (`getSession()`), not just on
the `SIGNED_IN` event, so a page reload on an already-authenticated shop-staff
session still has `shopMemberships` populated.

## Shop dashboard tabs

`ShopDashboard.jsx` (`/shop/:shopId/dashboard`) is a single page with 5 tabs,
switched via the `?tab=` query param (default `overview`):

- **Overview** — 4 metric cards (this week / this month / avg turnaround /
  outcome accuracy) computed client-side from the same `listShopIntakes` rows
  used by the Intakes tab, plus a 5-row recent list.
- **Intakes** — the original flat intake list + rating flow, now with filter
  chips (All / Unrated / Today / This week / Urgent), an urgency color
  legend, and a "waiting on customer" state for in-progress intakes with no
  brief yet.
- **Kit** — QR code (`QRCodeCanvas`, encodes `/intake?shop=<slug>`) with a
  working "Letter PDF" download (canvas → `jsPDF.addImage`). "Counter card"
  and "Table tent" are stubbed with a disabled button + tooltip.
- **Team** — roster via the `list_shop_members_with_email` RPC (needed
  because `auth.users` isn't exposed to PostgREST directly). Owners can
  remove members (`shop_members_owner_delete` RLS policy); "Invite teammate"
  is a modal that tells the owner to email `hello@greenlit.co` for now — no
  real invite send in this PR.
- **Settings** — read-only shop fields (name, slug, address, contact info,
  timezone, plan). Beta shops don't self-edit; copy points to support.

## Admin provisioning (`/admin/shops`)

Two independent gates, both required:

1. **Frontend allowlist (UX only)** — `isAdminEmail()` checks
   `VITE_ADMIN_EMAILS` (comma-separated) against the signed-in user's email.
   This only controls whether the page renders; it does not protect data.
2. **RLS (actual access control)** — `public.admin_emails` table +
   `public.is_admin()` SECURITY DEFINER function, checked by the
   `shop_leads_admin_all`, `shops_admin_all`, and `shop_members_admin_all`
   policies added in `0005_shop_facing.sql`. A user who isn't in
   `admin_emails` gets empty query results / write failures from Supabase
   even if they somehow load the page.

The panel has three sections:

- **Inbound leads** — `shop_leads` rows with a status dropdown
  (`new → contacted → pilot → active → churned/rejected`).
- **Active shops** — `shops` + a member count (queried separately from
  `shop_members`, joined client-side). "Manage" opens a drawer to edit name,
  plan, address, and contact fields. Slug is read-only. "Add member" in the
  drawer is a placeholder pointing at the Supabase dashboard — no self-serve
  invite yet.
- **Provision new shop** — name + auto-suggested (editable) kebab-case slug,
  optional "convert from lead" dropdown that also sets the lead's
  `converted_shop_id` and `status = 'active'`.

## Pricing model (display only)

Flat platform fee + usage-based intake pricing, unlimited staff seats on
every plan. Nothing here is enforced — `shops.plan` / `included_intakes` are
nullable columns Yash sets by hand during onboarding, and `/for-shops`'
pricing table is static copy. See the PR description or `ForShops.jsx` for
the current public numbers (Standard $149/mo, Growth $349/mo, High-volume
custom — Pilot is a 30-day/50-intake on-ramp, not on the public table).

## Non-goals (this PR)

Stripe/billing enforcement, metering, self-serve shop signup, real email
invite sends, multi-location support, and a public shop directory are all
explicitly out of scope — see the PR description for the full list.
