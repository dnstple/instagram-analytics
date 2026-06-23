# Deploying to Vercel (with a shared password)

This hosts the dashboard at a URL you can open anywhere and share with a few
people via one password. Free tier is plenty for a single account.

## What you'll end up with

- A live URL like `https://your-app.vercel.app`.
- A **password prompt** on first visit (HTTP Basic Auth). Anyone you give the
  password to can get in; everyone else is blocked.
- Your Meta token stays **server-side** in Vercel's encrypted env vars — never
  shipped to the browser.

> Note on data: tags and time-snapshots are stored on the server's temporary
> disk, so on Vercel they reset on each redeploy/cold start. The live Instagram
> dashboard works fully regardless. Ask me to wire a managed store (Vercel KV or
> a free Postgres) if you want that history to persist.

---

## Step 1 — Put the code on GitHub

1. Create a free account at github.com if you don't have one.
2. Make a new **private** repository (e.g. `instagram-analytics`).
3. From the project folder, push the code:
   ```bash
   git init
   git add .
   git commit -m "Instagram analytics dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/instagram-analytics.git
   git push -u origin main
   ```
   `.env.local` and `.data` are git-ignored, so your token and local data are
   NOT uploaded. Good.

## Step 2 — Import into Vercel

1. Go to **vercel.com** and sign in with GitHub.
2. **Add New… → Project** → import your `instagram-analytics` repo.
3. Vercel auto-detects Next.js. Leave the build settings as default.

## Step 3 — Set environment variables

Before deploying, open **Environment Variables** and add:

| Name | Value |
|------|-------|
| `META_ACCESS_TOKEN` | your Instagram token (the long `IGAA…` string) |
| `META_API_VERSION` | `v21.0` |
| `DASHBOARD_PASSWORD` | a password you choose for access |
| `INSTAGRAM_ACCOUNT_ID` | leave blank |
| `META_AD_ACCOUNT_ID` | leave blank (paid tab) |

Set each for **Production** (and Preview if you want password-protected
previews too).

## Step 4 — Deploy

Click **Deploy**. After ~1 minute you'll get your URL. Open it — your browser
will ask for a username and password:

- **Username:** anything (e.g. `team`)
- **Password:** the `DASHBOARD_PASSWORD` you set

Share that password with the people you want to have access.

---

## Keeping it running

- **Token expiry:** the Instagram token lasts ~60 days. When it expires the
  Settings page shows Meta's error. Generate a new one, then update
  `META_ACCESS_TOKEN` in **Vercel → Settings → Environment Variables** and
  redeploy (Deployments → … → Redeploy).
- **Updating the app:** push to GitHub `main` and Vercel redeploys automatically.
- **Changing the password:** update `DASHBOARD_PASSWORD` in Vercel and redeploy.

## Security notes

- The password protects every page and API route.
- Never commit `.env.local`; never paste the token into chats or screenshots.
- If the token or password leaks, regenerate the token (Meta) and change
  `DASHBOARD_PASSWORD`.
