# Shop-facing website (beta)

Covers the marketing surface, admin provisioning, auth routing, and dashboard
layout added for the shop-facing beta. No self-signup, no Stripe, no metering
enforcement — see "Non-goals" below.

## Auth flow

One login, role-based redirect. There is no consumer/shop toggle on sign-in.

1. User clicks "Continue with Google" (same flow for consumers and shop
   staff — `AuthModal` / `signInWithGoogle`).
2. On both the `SIGNED_IN` event and initial page load (`getSession()`),
   `AuthContext` first calls `claimPendingShopMemberships()` (the
   `claim_pending_shop_memberships()` RPC — see "Onboarding flow" below),
   then `getShopMembershipsForUser(user.id)` (`src/lib/db/shopMembership.js`),
   which reads `shop_members` joined to `shops(slug, name)`.
3. If the user has one or more shop memberships:
   - They're treated as shop staff, not a consumer (no `upsertConsumerProfile`,
     no anonymous-intake claim).
   - Unless the current path starts with `/shop/`, `/intake`, `/i/`, or
     `/admin`, they're redirected to `/shop/:slug` for their first shop
     membership (`redirectShopMemberIfNeeded` in `AuthContext.jsx`). This
     runs on every sign-in and every page load with an existing session, not
     just when signing in from `/` or `/account`.
4. If the user has no shop memberships, behavior is unchanged from before
   this PR: consumer profile upsert, pending-intake claim, post-auth redirect.

`shopMemberships` is exposed on `useAuth()` and read by `Navbar` (to swap
"Start intake" / "For shops" for "Go to dashboard" / "Shop dashboard") and by
`TeamTab` (to determine if the current user is an owner).

Membership is fetched on both initial page load (`getSession()`) and the
`SIGNED_IN` event, so a page reload on an already-authenticated shop-staff
session still has `shopMemberships` populated and still redirects.

## Onboarding flow

Shop staff don't need to sign in before they can be added to a shop:

1. An admin (via `/admin/shops`) or shop owner (via the Team tab) invites a
   teammate by email — this inserts a row into `pending_shop_members`
   (`shop_id`, `email`, `role`), added in `0007_shop_onboarding_v2.sql`.
2. The invitee signs in with Google using that email.
3. `claim_pending_shop_memberships()` (SECURITY DEFINER RPC, called from
   `AuthContext` on every sign-in/page-load) matches the signed-in user's
   `auth.users.email` case-insensitively against unclaimed
   `pending_shop_members` rows, marks them claimed, and inserts the
   corresponding `shop_members` row.
4. The membership fetch that follows picks up the new row, and the redirect
   logic above sends them straight to `/shop/:slug`.

If a teammate signs in with a different Google account than the email they
were invited with, nothing is claimed — they need a new invite sent to the
email they'll actually sign in with.

## Shop dashboard tabs

`ShopLayout.jsx` (`/shop/:slug`) is a shell with nested routes per tab, under
`src/pages/shop/`:

- **Overview** (`OverviewTab.jsx`, index route) — 4 metric cards (this week /
  this month / avg turnaround / outcome accuracy) computed client-side from
  the same `listShopIntakes` rows used by the Intakes tab, plus a 5-row
  recent list.
- **Intakes** (`IntakesTab.jsx`) — the original flat intake list + rating
  flow, now with filter chips (All / Unrated / Today / This week / Urgent),
  an urgency color legend, and a "waiting on customer" state for
  in-progress intakes with no brief yet.
- **Kit** (`KitTab.jsx`) — QR code (`QRCodeCanvas`, encodes `/i/<slug>`)
  wrapped in a branded on-screen frame (Greenlit wordmark, shop name,
  headline, footer trust line), plus a matching branded "Download PDF"
  (canvas → `jsPDF.addImage`, accent bars, framed QR, 3-step instructions).
- **Team** (`TeamTab.jsx`) — roster via the `list_shop_members_with_email`
  RPC (needed because `auth.users` isn't exposed to PostgREST directly).
  Owners can remove members (`shop_members_owner_delete` RLS policy) and see
  a "Pending invites" list (unclaimed `pending_shop_members` rows) with a
  revoke button. "Invite teammate" (owner-only) is a real self-serve invite
  — see "Onboarding flow" above.
- **Settings** (`SettingsTab.jsx`) — read-only shop fields (name, slug,
  address, contact info, timezone, plan). Beta shops don't self-edit; copy
  points to support.

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
  plan, address, and contact fields. Slug is read-only. The drawer also shows
  the member roster (`list_shop_members_with_email`), pending invites with a
  revoke button, and an "Add member" form that inserts into
  `pending_shop_members` (email + role) — see "Onboarding flow" above.
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
