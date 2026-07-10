import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hard-coded for pilot — later this becomes a proper admin_emails-driven query.
const RECIPIENTS = ['yashbolishetti@gmail.com', 'alexmoldovean12@gmail.com']

const ADMIN_PANEL_URL = 'https://greenlit-six.vercel.app/admin/shops'

// Called from two paths (Postgres trigger + client) — send-twice is acceptable for pilot.
// Never throws: always resolves { ok, error? } so callers can log-and-continue and never
// block shop signup on notification delivery.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { shop_id } = await req.json()
    if (!shop_id) {
      return jsonResult({ ok: false, error: 'shop_id is required' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id, name, slug, contact_email, timezone, signup_source, created_by')
      .eq('id', shop_id)
      .single()

    if (shopError || !shop) {
      console.error('notify_new_shop: failed to load shop', shopError)
      return jsonResult({ ok: false, error: 'Shop not found' })
    }

    // Safety net: this endpoint could accidentally be called with any shop_id — only
    // self-serve signups should page Yash/Alex.
    if (shop.signup_source !== 'self_serve') {
      return jsonResult({ ok: true, skipped: true })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('notify_new_shop: RESEND_API_KEY not configured')
      return jsonResult({ ok: false, error: 'RESEND_API_KEY not configured' })
    }

    let createdByEmail = 'unknown'
    if (shop.created_by) {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(shop.created_by)
      if (userError) {
        console.error('notify_new_shop: failed to load creator email', userError)
      } else {
        createdByEmail = userData?.user?.email ?? 'unknown'
      }
    }

    const fields = {
      shopName: shop.name,
      slug: shop.slug,
      createdByEmail,
      contactEmail: shop.contact_email || 'unknown',
      timezone: shop.timezone || 'unknown',
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Greenlit <onboarding@resend.dev>',
        to: RECIPIENTS,
        subject: `🆕 New Greenlit shop: ${fields.shopName}`,
        html: buildHtml(fields),
        text: buildText(fields),
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      console.error('notify_new_shop: Resend request failed', resendRes.status, errBody)
      return jsonResult({ ok: false, error: `Resend request failed: ${resendRes.status}` })
    }

    return jsonResult({ ok: true })
  } catch (err) {
    console.error('notify_new_shop: unexpected error', err)
    return jsonResult({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

function jsonResult(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

type EmailFields = {
  shopName: string
  slug: string
  createdByEmail: string
  contactEmail: string
  timezone: string
}

function buildHtml({ shopName, slug, createdByEmail, contactEmail, timezone }: EmailFields) {
  const name = escapeHtml(shopName)
  const s = escapeHtml(slug)
  const owner = escapeHtml(createdByEmail)
  const contact = escapeHtml(contactEmail)
  const tz = escapeHtml(timezone)

  return `<!doctype html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 24px; background: #fafafa;">
    <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      <div style="height: 6px; background: #4CAF6B;"></div>
      <div style="padding: 32px;">
        <div style="font-size: 11px; font-weight: bold; letter-spacing: 0.2em; color: #4CAF6B; text-transform: uppercase;">● Greenlit — New Shop Signup</div>
        <h1 style="margin: 16px 0 8px; font-size: 22px; color: #1e1e1e;">${name}</h1>
        <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px;">
          A new shop just self-signed up on Greenlit. They're on the pilot plan and marked <b>pending review</b>.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #6a6a6a; font-size: 13px; width: 120px;">Shop name</td>
            <td style="padding: 8px 0; color: #1e1e1e; font-size: 13px; font-weight: 500;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6a6a6a; font-size: 13px;">Slug</td>
            <td style="padding: 8px 0; color: #1e1e1e; font-size: 13px; font-family: monospace;">/${s}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6a6a6a; font-size: 13px;">Owner email</td>
            <td style="padding: 8px 0; color: #1e1e1e; font-size: 13px;">${owner}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6a6a6a; font-size: 13px;">Contact email</td>
            <td style="padding: 8px 0; color: #1e1e1e; font-size: 13px;">${contact}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6a6a6a; font-size: 13px;">Timezone</td>
            <td style="padding: 8px 0; color: #1e1e1e; font-size: 13px;">${tz}</td>
          </tr>
        </table>
        <p style="color: #4a4a4a; line-height: 1.6; margin: 16px 0;">
          <b>Reach out within 24 hours</b> to qualify them and close a deal — they're on the free 30-day pilot until manually upgraded.
        </p>
        <a href="${ADMIN_PANEL_URL}" style="display: inline-block; margin-top: 8px; padding: 12px 24px; background: #4CAF6B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Review in admin panel</a>
        <p style="margin-top: 24px; font-size: 12px; color: #8a8a8a;">
          Sent automatically when a self-serve shop is created via /for-shops/signup.
        </p>
      </div>
    </div>
    <p style="text-align: center; font-size: 11px; color: #8a8a8a; margin-top: 16px;">Greenlit • greenlit-six.vercel.app</p>
  </body>
</html>`
}

function buildText({ shopName, slug, createdByEmail, contactEmail, timezone }: EmailFields) {
  return `New Greenlit shop: ${shopName}

A new shop just self-signed up on Greenlit. They're on the pilot plan and marked pending review.

  Shop name:      ${shopName}
  Slug:           /${slug}
  Owner email:    ${createdByEmail}
  Contact email:  ${contactEmail}
  Timezone:       ${timezone}

Reach out within 24 hours to qualify them and close a deal — they're on the free 30-day pilot until manually upgraded.

Review in admin panel: ${ADMIN_PANEL_URL}

Sent automatically when a self-serve shop is created via /for-shops/signup.`
}
