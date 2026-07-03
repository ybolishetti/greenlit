# Greenlit — web prototype

A functional web version of the Greenlit consumer + shop flows described in
the business plan, built so almost nothing requires the native iOS app.

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

## What works in the browser

- **Consumer intake flow** (`/intake`): guided questions, feel sliders,
  in-browser microphone recording (or audio file upload), photo/video
  upload, free-text notes.
- **Mechanic brief** (`/brief/:id`): rules-based mock diagnosis engine
  (`src/lib/mockDiagnosis.js`) generates ranked probable causes, an urgency
  rating, components to inspect, and an estimate range. Downloadable as a
  PDF via `jspdf`.
- **Shop QR landing page** (`/shop/:shopId`): what a customer sees after
  scanning a shop's QR code — links straight into the intake flow with
  `?shop=` context.
- **Shop dashboard** (`/shop/:shopId/dashboard`): lists submitted intakes,
  lets a mechanic rate whether the diagnosis was on target and what repair
  was actually performed (the outcome-labeling loop from the data
  strategy section of the plan).

Data is stored in `localStorage` (`src/lib/storage.js`) — good enough for a
demo/pitch, not a real backend. Swap that module for real API calls when
you're ready to persist data server-side.

## What's intentionally a placeholder

The **lock screen shortcut / one-tap background recording** feature
(`src/components/DownloadAppButton.jsx`) cannot exist on the web — it needs
native iOS APIs (WidgetKit interactive widgets, App Intents / Shortcuts,
the Action Button, background audio capture while the phone is locked). The
"Download the app" button is wired up but intentionally does nothing yet;
replace `handleClick` with a real App Store link once that native build
exists. Everything else on this site is fully functional without it.

## Mock diagnosis engine

`src/lib/mockDiagnosis.js` is a small rules table mapping
category + descriptor → probable causes / urgency / components / cost
range. It stands in for the real multimodal model (Whisper + GPT-4o per the
plan). Swap `generateBrief()` for a real API call when ready — the rest of
the UI just consumes whatever shape that function returns.
