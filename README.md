# Instagram Analytics (MVP)

A single-user dashboard for your own Meta Business account. It shows **organic
Instagram** performance (Reels, posts, carousels) and **paid Meta Ads** with
Instagram placement breakdowns — side by side but never mixed.

Built with Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Recharts and
TanStack Table. One manually supplied Meta access token, stored server-side in
an environment variable. **No OAuth, no login, no database, no demo data.**

---

## Decision-making features

The dashboard is built to answer "what worked, why, and what to make more of":

- **Clickable column sorting** on every metric — descending first, then
  ascending, with a sort arrow on the active column. Missing metrics always sort
  to the bottom. The "Sort by / Direction" selects stay in sync with header
  clicks.
- **Best-performer chips** (Most viewed, Best share rate, Most saved, Potential
  paid winner, Best overall…) instantly sort + highlight the table and explain
  what's being ranked.
- **Overall score (0-100)** — a transparent weighted blend benchmarked *against
  comparable content only* (Reels vs Reels, Carousels vs Carousels, image vs
  image, video vs video): 30% engagement rate, 25% share rate, 20% save rate,
  15% profile-visit rate, 10% follow rate. Weights renormalise when a metric is
  missing so absent data never unfairly lowers a score. Toggle the Score,
  Percentile and "vs average" columns on/off.
- **Content-type benchmarking** — every post is rated against the average for
  its own type, with "2.4x average", "38% above average" and "Top 5/10/25%"
  labels and percentiles.
- **Media lightbox** — click any thumbnail for a large preview with carousel
  navigation, Reel/video playback, keyboard controls (Esc / ← →), full-screen,
  copy-link and open-on-Instagram.
- **Post detail drawer** — click a row for performance, benchmarks vs your
  average, engagement-composition and snapshot trend charts, rule-based insight
  cards, and tag editing.
- **Content tagging** — label posts (Product launch, Lifestyle, UGC…), filter by
  tag, manage the tag list in Settings, and see tag performance on Insights.
- **Insights page** — best content lists, content-type comparison, tag
  performance, best posting windows, and rule-based opportunity cards.
- **Time-normalised periods** — First 24h / 3d / 7d / 30d / Lifetime. Built from
  metric **snapshots captured automatically on each refresh**. Posts with no
  early history are honestly labelled "Lifetime only" — never back-filled.
- **Paid** — sortable columns, placement + campaign + ad-set filters, and "best
  paid ad" quick ranks. Organic and paid stay strictly separate.

### Local persistence (no database)

Tags and snapshots are stored as JSON under `./.data` (git-ignored):
`tags.json`, `tag-catalog.json`, `snapshots.json`. This keeps the MVP
database-free while still persisting across restarts. Snapshot history starts
accumulating from the first run, so first-24h/7d comparisons get richer over
time.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the four values (see below)
npm run dev                  # http://localhost:3000
```

Pages:

- `/` — dashboard with **Organic** and **Paid** tabs, KPI cards, filters,
  charts and tables.
- `/settings` — connection status, test buttons, refresh, and raw Meta error
  output for debugging.

---

## Environment variables

Create `.env.local` (never commit it) with:

```
META_ACCESS_TOKEN=        # REQUIRED: Instagram user access token
META_API_VERSION=         # e.g. v21.0 (optional; defaults to v21.0)
INSTAGRAM_ACCOUNT_ID=     # optional: leave blank to use the token's account
META_AD_ACCOUNT_ID=       # optional: only for the deferred Paid/Ads tab
```

The token is read only on the server (`lib/meta/client.ts`) and is **never**
shipped to the browser. All Meta calls happen inside API routes / server code.

---

## How to find each value

> **Current setup: Organic only, via Instagram Login.** The Organic tab uses the
> Instagram API with Instagram Login (`graph.instagram.com`) and needs only
> `META_ACCESS_TOKEN`. The Paid tab is deferred — see the note at the end.

### 1. Access token (the only required value)

You need an **Instagram user access token** with these scopes:
`instagram_business_basic` and `instagram_business_manage_insights`.

1. Go to **developers.facebook.com** → open your **Business** app.
2. Make sure the app has the **"Manage messaging & content on Instagram"** use
   case (Instagram API with **Instagram login**).
3. Open **Tools → Graph API Explorer**.
4. Select your app. Tick the two scopes above.
5. Click **Generate Instagram Access Token** and log in with your Instagram
   account to approve.
6. Copy the token from the **Access Token** box into `META_ACCESS_TOKEN`.
7. (Recommended) Exchange it for a **long-lived token** (~60 days):
   ```
   https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=APP_SECRET&access_token=SHORT_LIVED_TOKEN
   ```
   Paste the returned token into `META_ACCESS_TOKEN`.

> When the token expires, the Settings page shows Meta's error. Generate a new
> one and update `.env.local`. (Automatic refresh is out of scope for this MVP.)

### 2. Instagram Account ID — optional

Leave `INSTAGRAM_ACCOUNT_ID` **blank**. With an Instagram-login token the app
uses `me`, which resolves to the token's own account. (If you ever want to pin a
specific account, run `GET /me?fields=user_id` in the Explorer and paste the
`user_id`.)

### 3. Meta Ad Account ID — deferred

Leave `META_AD_ACCOUNT_ID` **blank** for now. The Paid tab will show a friendly
"not enabled" message. See the deferred-paid note below to turn it on later.

### 4. API version

Use a current Graph API version such as `v21.0`. If you leave
`META_API_VERSION` blank, the app defaults to `v21.0`.

---

## Architecture

```
app/
  page.tsx                 Dashboard (Organic / Paid tabs + refresh)
  settings/page.tsx        Connection tests, refresh, error debugging
  api/
    organic/route.ts       GET organic media + insights
    paid/route.ts          GET paid ad x placement rows
    test/instagram/route.ts
    test/ads/route.ts
    refresh/route.ts       POST clears the in-memory cache
lib/meta/
  client.ts                Server-side Graph API fetch + pagination + errors
  cache.ts                 10-minute in-memory TTL cache
  metrics.ts               Safe maths + formatters (null-aware)
  instagram.ts             Organic fetch (resilient per-media insights)
  ads.ts                   Paid insights with placement breakdowns
  types.ts                 Shared types + MetaApiError
components/
  ui/                      shadcn/ui primitives
  dashboard/               KPI cards, filters, tables, charts, tabs, states
```

### Key behaviours

- **Server-only token.** `lib/meta/*` imports `server-only`; nothing there can
  be bundled into client code.
- **10-minute cache.** Responses are cached in-process. The **Refresh data**
  button (dashboard and Settings) clears it via `POST /api/refresh`.
- **Pagination.** `graphGetPaged` follows Meta `paging.next` cursors (capped).
- **Null, never fake zero.** If Meta doesn't return a metric for a given media
  type, it is stored as `null` and rendered as `—`. Derived metrics
  (engagement, engagement/share/save rate) return `null` when inputs are
  missing or the denominator is 0.
- **Organic vs paid are separate** — they are fetched, summarised and displayed
  independently and never summed together.

### Metric definitions

- `engagement = likes + comments + shares + saves` (any available subset)
- `engagement rate = engagement / reach`
- `share rate = shares / reach`
- `save rate = saves / reach`
- Reel `avg watch time` comes from `ig_reels_avg_watch_time` (ms → seconds).

### Notes / known Meta limits

- **`impressions`** is deprecated for newer Instagram media; Meta returns
  **`views`** instead. The app requests both and shows whatever is available.
- **Skip rate** is not exposed by the Instagram Graph API, so it always shows
  `—`.
- **Paid `profile visits`, `results` and `cost per result`** are not returned
  by the ad Insights endpoint in an objective-agnostic way at ad×placement
  level, so they render as `—`. Spend, impressions, reach, frequency, clicks,
  CTR, CPC, CPM, video views, engagement and website clicks are populated from
  the Insights `actions` breakdowns.
- Paid data is **Instagram placements only** by default
  (`publisher_platform = instagram`). Pass `?instagramOnly=0` to
  `/api/paid` to include everything.

### Enabling the Paid tab later

The ads code (`lib/meta/ads.ts`) is built and wired up, just not configured. The
Marketing API needs a **Facebook** token (the Instagram-login token can't read
ads), so to switch it on:

1. In Graph API Explorer, switch **User or Page → Get User Access Token**,
   tick `ads_read` and `business_management`, and **Generate Access Token**
   (this is a Facebook token, separate from the Instagram-login one).
2. Find your ad account ID in **Ads Manager** (top-left `act_…` dropdown).
3. Set these env vars (in `.env.local` locally, or in Vercel for the live site):
   - `META_ADS_TOKEN` = the Facebook token from step 1
   - `META_AD_ACCOUNT_ID` = `act_…`
4. Redeploy. The Paid tab now reads Instagram ad placements.

The app keeps two tokens: `META_ACCESS_TOKEN` (Instagram, organic) and
`META_ADS_TOKEN` (Facebook, paid). If `META_ADS_TOKEN` is unset the app falls
back to `META_ACCESS_TOKEN`, which can't read ads — so set it explicitly.

---

## Build order (as implemented)

1. Live organic Instagram table.
2. Paid ad reporting with placement breakdowns.
3. Charts and visual polish.
```bash
npm run typecheck   # type-check the whole project
npm run build       # production build
```
