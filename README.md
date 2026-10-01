# Trading Journal

A strategy-first trading journal for tracking rule compliance, execution quality and performance.

## Current MVP

- Supabase email/password authentication
- User-isolated data with PostgreSQL Row Level Security
- Strategy creation, editing, archiving and versioning
- Editable strategy rules
- Trade entry with Followed / Violated / N/A rule checks
- Date, time, timezone, session, timeframe and trade notes
- Entry, stop, target, planned RR, actual R and P/L
- Execution grade, emotion and confidence tracking
- Dashboard metrics: win rate, net R, expectancy, profit factor and rule adherence
- Strategy comparison and cumulative R analytics
- Rule-level followed-vs-violated win-rate analysis
- CSV trade export and JSON full-data backup
- Private Supabase Storage bucket prepared for trade screenshots
- Responsive GitHub Pages deployment workflow

## Architecture

- Frontend: React + TypeScript + Vite
- Database/Auth/Storage: Supabase
- Hosting: GitHub Pages
- Charts: Recharts

## Supabase

The production project is already configured and migrations are versioned under `supabase/migrations`.

The client uses the project's publishable key. Database security is enforced with RLS; no service-role secret is exposed to the browser.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Pushes to `main` trigger the GitHub Pages deployment workflow.
