# Publishing & deployment

Two separate pipelines:

1. **The SDK packages** (`@clndr-pro/sdk`, `@clndr-pro/react`) → GitHub + npm.
2. **The clndr.pro app itself** → a public URL so the SDK has an API to call.

---

## 1. Push the SDK to GitHub (`clndr-pro` org)

### 1.1 Create the repo on GitHub

On <https://github.com/organizations/clndr-pro/repositories/new>:

- **Name:** `clndr-pro-sdk` (matches the local directory and the SDK's
  `repository.url` in both `packages/*/package.json` files).
- **Visibility:** Public
- **Initialize:** nothing — don't add a README/license/gitignore (we already
  have them).

### 1.2 Push

From inside the `clndr-pro-sdk/` repo root:

```bash
git init                                 # only if it's a fresh clone without git
git add .
git commit -m "Initial commit — @clndr-pro/sdk and @clndr-pro/react v0.1.3"
git branch -M main
git remote add origin git@github.com:clndr-pro/clndr-pro-sdk.git
git push -u origin main
```

### 1.3 Enable CI

The workflow at `.github/workflows/ci.yml` runs on every push — it will
appear under the repo's **Actions** tab once you push. No config needed.

### 1.4 Repo settings

On the repo's **Settings → General**:

- Description: `Official TypeScript SDK and React components for clndr.pro`
- Website: <https://clndr.pro>
- Topics: `scheduling`, `calendar`, `booking`, `react`, `sdk`, `shadcn`

On **Settings → Code security and analysis**: enable Dependabot alerts +
security updates.

---

## 2. Publish to npm (scoped `@clndr-pro/*`)

**npm does not track GitHub.** Pushing commits to `main` does **not** change
what appears on [npmjs.com](https://www.npmjs.com/package/@clndr-pro/sdk?activeTab=versions).
A new version shows up only after a successful **`npm publish`** (manual) or
after the **Publish** GitHub Action runs (see § 2.3). That action only runs
when you **push a git tag** matching `v*` (e.g. `v0.1.3`) or start it from
the Actions tab, and only once both packages trust it on npmjs.com (§ 2.3).
Until then, the registry stays on the last published version even if
`package.json` in the repo is already bumped.

### 2.1 Claim the scope

```bash
npm login
# If @clndr-pro doesn't exist yet, creating the first public scoped package
# auto-creates it under your user scope. If you want it owned by an npm
# organization, first:
#   https://www.npmjs.com/org/create → create "clndr-pro" organization
# then add yourself / collaborators.
```

### 2.2 Manual publish (first release)

```bash
# From the clndr-pro-sdk/ repo root:
npm ci
npm run build --workspace @clndr-pro/sdk --workspace @clndr-pro/react
npm publish --workspace @clndr-pro/sdk  --access public
npm publish --workspace @clndr-pro/react --access public
```

Verify:

- <https://www.npmjs.com/package/@clndr-pro/sdk>
- <https://www.npmjs.com/package/@clndr-pro/react>

### 2.3 Automated publish (subsequent releases)

The `.github/workflows/publish.yml` workflow publishes both packages when a
tag matching `v*` is pushed. It publishes the **version strings in
`packages/sdk/package.json` and `packages/react/package.json`** — bump those
**before** tagging so npm gets the version you intend (the tag name and
`package.json` `version` should match, e.g. tag `v0.1.4` with `"version":
"0.1.4"` in both packages).

It uses **npm trusted publishing**: npm accepts GitHub's OIDC token for
this workflow, so there's no `NPM_TOKEN` secret to expire and no 2FA prompt.
Set up once, for **each** package (`@clndr-pro/sdk` and `@clndr-pro/react`):

1. On npmjs.com open the package → **Settings** → **Trusted Publisher** →
   **GitHub Actions**.
2. Organization or user: `devsForFun`. Repository: `clndr-pro-sdk`.
   Workflow filename: `publish.yml`. Environment: leave empty.
3. Save. Optionally, under **Publishing access**, require 2FA and disallow
   tokens: trusted publishing keeps working, and a leaked token can't publish.

To retry a release that failed, open **Actions → Publish → Run workflow**
on `main`. Versions already on npm are skipped.

Release flow:

```bash
# bump both package versions in packages/*/package.json (keep them in sync)
git commit -am "Release v0.2.0"
git tag v0.2.0
git push && git push --tags
# GitHub Actions runs publish.yml automatically
```

Both packages publish with **npm provenance**, so `npmjs.com` shows a
verified badge linking back to the GitHub Actions run.

### 2.4 Deprecating a bad release

```bash
npm deprecate @clndr-pro/sdk@0.1.2 "Use 0.1.3 or later"
```

Never `unpublish` 24h+ after release — it breaks everyone who installed it.

---

## 3. Deploy the clndr.pro app itself

> The SDK targets `https://www.clndr.pro` by default (0.1.5+; earlier
> versions used the apex `https://clndr.pro`, which redirects to `www`, and
> `fetch` drops the `Authorization` header on that redirect). Until the app is
> deployed to that origin, SDK consumers must pass `baseUrl` explicitly. Once
> it's live, the default works out of the box.

clndr.pro is a satellite of [devsforfun ID](https://github.com/devsForFun/id) —
it consumes the hub for authentication and ALL Google API access (Calendar
sync, Meet link creation). There is no Google OAuth client configured on
the clndr.pro side; the dfid hub owns Google. Two preconditions:

1. **devsforfun ID must already be deployed** to `https://devsforfun.app`
   (or your hub's prod URL). Follow the hub's
   `id/docs/PRODUCTION_DEPLOY.md` first.
2. **`@devsforfun/id-sdk` must be published** to GitHub Packages at the
   version clndr-pro's `package.json` pins. Follow the hub's
   `id/packages/id-sdk/PUBLISH.md`.

Then deploy clndr.pro from the `clndr-pro/` sibling repo (NOT this SDK
repo). The clndr-pro README has the canonical step-by-step; the short
version is below.

### 3.1 Vercel (recommended)

From the `clndr-pro/` repo root:

```bash
npx vercel link        # link to a new or existing Vercel project
npx vercel env add     # one at a time, or paste via the dashboard
npx vercel --prod
```

**Required env vars on Vercel** (matches `clndr-pro/.env.example`):

```
# Where the dfid hub lives
DEVSFORFUN_ID_URL=https://devsforfun.app

# Project + OAuth client credentials minted on the hub's /gotham/projects/new.
# All five are shown ONCE — copy them before the success panel closes.
DEVSFORFUN_ID_PROJECT_ID=<uuid>
DEVSFORFUN_ID_HMAC_SECRET=<signing_secret>
DEVSFORFUN_ID_OAUTH_CLIENT_ID=<dff_…>
DEVSFORFUN_ID_OAUTH_CLIENT_SECRET=<plaintext oauth secret>
DEVSFORFUN_ID_COOKIE_SECRET=<openssl rand -hex 32>

# The satellite's OWN public origin. The dfid hub validates returnTo
# origins against this project's registered redirect_uri origins.
NEXT_PUBLIC_SITE_URL=https://clndr.pro

# The satellite's OWN Supabase (per-satellite Supabase model). clndr.pro
# re-mints hub JWTs with its OWN signing key — set SUPABASE_JWT_SIGNING_KEY
# to that key and import it into the project's JWKS. Do NOT copy the hub's
# key (org-wide kid uniqueness 409s). See clndr-pro/README.md + §2.7(b).
NEXT_PUBLIC_SUPABASE_URL=<satellite-prod-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<satellite-prod-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<satellite-prod-service-role-key>
SUPABASE_JWT_SIGNING_KEY=<satellite-prod-signing-key-private-jwk>

# Optional but recommended in prod
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Transactional email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@clndr.pro

# Cron secret (for /api/cron/*)
CRON_SECRET=<openssl rand -hex 32>

# INSTALL-TIME ONLY (NOT a runtime env var): read:packages PAT so
# `npm install` can fetch @devsforfun/id-sdk from GitHub Packages.
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

`GITHUB_TOKEN` is the one Vercel-specific quirk: clndr-pro's `.npmrc`
declares `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`, so the
build's `npm install` step needs it in the env. Set it as a regular
Project Environment Variable — Vercel exposes env vars to install
scripts automatically.

### 3.2 Custom domain

Add `clndr.pro` as a custom domain in Vercel → Settings → Domains. Update
DNS (A/CNAME records per Vercel's instructions).

Once the domain resolves, register `https://clndr.pro/auth/callback` as
a redirect URI on the dfid hub's OAuth client for this project (hub UI
→ Gotham → Projects → your project → OAuth client → redirect URIs).
There is no Google Cloud OAuth client to update on the clndr.pro side —
the hub holds Google credentials.

### 3.3 Verify the deployed API from the SDK

```bash
curl -H "Authorization: Bearer clndr_sk_..." https://www.clndr.pro/api/v1/booking-pages | jq
```

With no `baseUrl` override, the SDK now talks to production out of the box:

```ts
const clndr = new Clndr(process.env.CLNDR_SECRET_KEY!);
// → hits https://www.clndr.pro by default
```

### 3.4 Self-host users

Anyone running their own fork of clndr.pro passes `baseUrl` explicitly:

```ts
new Clndr({ apiKey: '...', baseUrl: 'https://bookings.myco.com' });
```

and in React:

```tsx
<ClndrProvider publishableKey="..." baseUrl="https://bookings.myco.com">
```

---

## 4. Version + docs site (optional)

- **Versioning tool:** consider [Changesets](https://github.com/changesets/changesets)
  once multiple people are cutting releases. For now, hand-bumping two
  `package.json`s is fine.
- **Docs site:** the current README is enough for v0. For a dedicated docs
  site, [Nextra](https://nextra.site) or [Mintlify](https://mintlify.com)
  both work well and can live in a `docs/` folder or a separate repo.

---

## 5. Post-launch checklist

- [ ] npm pages show READMEs and the GitHub repo link.
- [ ] `npm i @clndr-pro/react` in a fresh Next.js app resolves both packages.
- [ ] GitHub Actions CI is green on `main`.
- [ ] Publish workflow ran successfully on the first `v0.1.3` tag.
- [ ] A booking created via the deployed API appears in clndr.pro's
      production Supabase `meetings` table.
- [ ] Google Meet end-to-end works against the deployed app — confirms
      the dfid hub proxy is wired and the booking page owner has Google
      linked at the hub (hub's `/settings/connected-accounts/google`).
- [ ] CORS preflight + GET from a third-party origin succeeds with a
      publishable key.
