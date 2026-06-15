# Groundwork — Competitive Intelligence Platform

Multi-client competitive-intelligence SaaS by Knots & Dots. Analysts capture
competitor marketing "entries" (ads, pages, videos), enrich them with AI, and
produce reports, dashboards, journey maps and cinematic showcases. Originally
built for Scotiabank ("SB Audit"), now a generic multi-tenant engine driven by
per-project frameworks.

- **Live:** https://groundwork.kad.london (Vercel)
- **Repo:** github.com/kdlondon/sb-audit
- **Backend:** Supabase (Postgres + Auth + Storage + RLS), EU region

## Stack
- Next.js 14 (App Router) · React 18 · Tailwind 3.4 + typography plugin
- Supabase JS / SSR · Recharts · react-globe.gl · TipTap editor
- Anthropic API (Claude) for analysis/chat/copilot · YouTube Data API v3
- No TypeScript, no test suite yet. Plain `.jsx`.

## Commands
```bash
npm run dev      # local dev (needs .env.local — ask Sergio, NOT in repo)
npm run build    # production build — run before pushing anything non-trivial
npm run start    # serve the production build
```
Node 20+ (developed on 24). No lint/test scripts configured.

## Environment
Secrets live in `.env.local` (gitignored, never commit). `.env.staging` is a
**placeholder template only** — safe, no real keys. Required vars:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`. Set in Vercel for deploys.

## Layout
```
app/
  audit/        Main capture tool (entries, multi-image, AI analyze)
  dashboard/    Recharts visualizations
  analytics/    Cross-entry analytics
  reports/      Report templates + Journey Map
  chat/         AI chat over entries (citations → entry sidebar)
  scout/        YouTube content discovery
  showcase/     Cinematic presentations + export (PPTX/PDF/CSV)
  onboarding/   7-step framework setup for new projects
  projects/     Project selector (all data scoped by project_id)
  settings/     Dropdowns + Framework tab
  admin/ users/ profile/ mfa-setup/   Admin, roles, auth
  login/        Groundwork-branded login + MFA
  api/          ai, ai/copilot, analyze, youtube, youtube-scout,
                youtube-frames, suggest-competitors, brand-profile,
                save-report, create-user, mfa-email, reset-mfa, extension
components/      Nav, AuthGuard, ProjectGuard, BrandGuard, editors, inputs
lib/            supabase, framework-loader/-context, options, role-context,
                project-context, brand-context, system-dimensions
middleware.js   Rate limiting + security headers + auth gating
extension/      Browser extension (capture into the platform)
scripts/        seed-staging.js
```

## Key concepts
- **Per-project frameworks.** Each project has a tier (Essential/Enhanced/
  Specialist) and a framework config that drives AI prompts and dynamic audit
  form sections. Loaded via `lib/framework-loader.js`; exposed to pages through
  `useFramework()` (`lib/framework-context.js`). `lib/framework.js` is the old
  static fallback. Scotiabank is a Tier-3 specialist row.
- **Everything is project-scoped** by `project_id`. Data tables: `audit_entries`
  (local) and `audit_global` (global, has brand/country/company_type). Also
  `projects`, `project_frameworks`, `dropdown_options`, `saved_reports`.
- **Multi-select fields** stored comma-separated (chip UI): portrait, entry_door,
  journey_phase, client_lifecycle, moments, business_size, industry_shown,
  channel, brand_archetype, funnel.
- **Citations.** AI emits `[ENTRY:id]`; frontend renders `[label](__cite__id)`
  as clickable spans (needs `urlTransform={(url)=>url}` on react-markdown v9).
- **AI language rule.** All AI output fields are English regardless of source
  language.

## Branches & deploy
- `main` is the source of truth and what's deployed (auto-deploy on push to Vercel).
- `staging`, `feature/multi-client-platform`, `claude/focused-lovelace` are stale
  (fully behind main) — safe to delete once confirmed.
- DB changes: run the `MIGRATION_*.sql` files in Supabase SQL Editor.

## Conventions
- Preserve existing functionality when adding features.
- Keep secrets out of git. Never hardcode keys in `.jsx`/`.js`.
- Run `npm run build` before pushing.
