# StratCode

A skills-verification platform where business cases are the assessment. Solvers work through realistic small-business problems in three stages and are scored against an AI baseline, so a strong result shows judgment beyond what a chatbot produces. Founders review a short list of top candidates and vouch for them.

**Live site:** https://strat-co.vercel.app

> **Status: feature-complete prototype.** Built as a hackathon project. See [Project status](#project-status) for what is built. All businesses and data in the challenges are fictional.

## Why this exists

Finance and consulting recruiting leans heavily on school prestige, which shuts out strong self-taught candidates. Take-home work is also getting harder to trust now that AI can produce it. StratCode aims to produce a credential that is hard to fake: structured work on a realistic problem, graded partly by deterministic checks and partly by rubric, and compared with what an AI model produces from the same material.

## How a challenge works

Each challenge is a short client brief plus a small dataset. Solvers complete three stages:

| Stage | Solver submits | How it is graded |
|---|---|---|
| 1. Issue tree | A nested outline that structures the problem | Gemini, against a rubric: MECE-ness, coverage of drivers, prioritization |
| 2. Numbers | Six numeric answers computed from the CSV | Deterministic, against hidden answers with absolute tolerances |
| 3. Memo | A one-page, answer-first recommendation | Gemini, against a rubric: clarity, actionability, risks, next step |

Three challenges are included:

1. **Brew & Co.** — Diagnose why a coffee shop's variable margin fell between two quarters and decompose the change into mix, price, and unit-cost effects.
2. **Crumb & Crust** — Evaluate whether a neighbourhood bakery's 10% across-the-board price increase raised variable profit and compute break-even volume loss.
3. **Pressed & Proper** — Decide whether a sandwich and juice shop should sign a second-location lease by modeling unit economics and standalone vs. cannibalization-adjusted payback.

Scoring: each stage is scored 0 to 10, and the total out of 100 is `3 × Stage 1 + 3 × Stage 2 + 4 × Stage 3`. Results compare the solver's stage and total scores against a pregenerated AI baseline for the same challenge, alongside per-criterion feedback and the two-sentence summary shown to founders.

## Project status

| Area | Status |
|---|---|
| Database schema with row-level security and column-level grants | Done |
| Challenge 1: Brew & Co. (margin bridge) | Done |
| Challenge 2: Crumb & Crust (pricing & elasticity) | Done |
| Challenge 3: Pressed & Proper (retail expansion & cannibalization) | Done |
| Email and password auth, protected routes | Done |
| Challenge list and detail pages | Done |
| Three-stage workspace with draft saving | Done |
| Minimalist interface pass (system font, neutral palette, light and dark) | Done |
| Submit and grading pipeline (Stage 2 scoring, Gemini for Stages 1 and 3) | Done |
| AI baseline generation and score-versus-baseline results view | Done |
| Founder dashboard (top 3 per challenge) and vouching | Done |
| Leaderboard (ranked scores, percentiles, vouches) and solver profile | Done |
| Grader calibration exemplars, demo seeding, and RLS verification scripts | Done |
| Deployed on Vercel | Done |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI | Tailwind CSS v4, shadcn/ui |
| Database and auth | Supabase (PostgreSQL, Auth) |
| AI grading | Gemini API via `@google/genai`, called server-side only |
| Validation | Zod |
| Charts | Recharts |
| Hosting | Vercel |

## Design

The interface follows a minimalist, Apple-inspired approach drawn from Apple's WWDC design talks, translated for the web:

- System font stack, size-specific tracking and leading, tabular numerals for data.
- A neutral palette that follows the system light or dark setting, with one accent color reserved for the primary action, links and the keyboard focus ring.
- Hairline borders instead of shadows; no gradients, glows or decorative icons.
- Short opacity and transform transitions only, with press feedback on pointer-down.
- Respect for reduced motion, reduced transparency and increased contrast settings.

## Security design

- **Row-level security on every table.** Solvers can read challenges and read and write only their own drafts.
- **Hidden answers.** Correct answers live in their own table with no client access, readable only with the server-side secret key.
- **Column-level grants.** Clients can write only the three stage fields of their own draft and their profile `display_name`. Status, scores, feedback, and baseline delta are server-only, and so are roles, which prevents self-promotion to founder.
- **Rubrics and baselines are not client-readable.** Queries list columns explicitly; there is no `select *` on `challenges`.
- **Atomic submission locking.** Submitting atomically transitions a row from `draft` to `grading` before invoking Gemini, preventing duplicate grading runs, and rolls back to `draft` if an upstream error occurs.
- **Secrets stay on the server.** The Gemini key and the Supabase secret key are never exposed to browser code.

## Repository layout

```
StratCO/
  README.md                  this file
  stratcode/                 the Next.js app (run all commands from here)
    app/                     routes, pages, server actions, and API routes
      api/submissions/[id]/submit/   server-side grading endpoint
      challenges/            challenge list and 3-stage workspace / results
      founder/               founder review dashboard and vouch actions
      leaderboard/           per-challenge leaderboard and percentiles
      login/                 email/password authentication
      profile/               solver profile, display name, and vouches received
    components/              UI components (shadcn/ui under components/ui)
    lib/                     config.ts, Supabase clients, data loaders, grading/
    public/data/             challenge datasets (CSV)
    scripts/                 CLI scripts for baselines, calibration, demo seed, and RLS checks
    supabase/
      migrations/            001_init.sql, 002_display_names.sql
      seed/                  challenge seed SQL (002_challenge_1 through 004_challenge_3)
    CLAUDE.md, AGENTS.md     project rules for AI coding assistants
```

An answers file for each challenge lives in `supabase/seed-private/`, which is git-ignored and not part of this repository.

## Getting started

### Prerequisites

- Node.js 20 or newer
- A [Supabase](https://supabase.com) project
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)

### 1. Install

```bash
git clone https://github.com/rongzeliu/StratCO.git
cd StratCO/stratcode
npm install
```

### 2. Environment variables

Create `stratcode/.env.local` (it is git-ignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<secret key, server only>
GEMINI_API_KEY=<Gemini key, server only>
```

Only the `NEXT_PUBLIC_` variables are exposed to the browser. Never commit the secret key or the Gemini key.

### 3. Pick a Gemini model (optional)

`lib/config.ts` defaults to `gemini-2.5-flash-lite` (with automatic fallback across `GEMINI_MODELS`) and can be overridden via the `GEMINI_MODEL` environment variable or edited directly in `lib/config.ts`.

### 4. Set up the database

In the Supabase SQL Editor, run these in order:

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_display_names.sql`
3. `supabase/seed/002_challenge_1.sql`
4. `supabase/seed/003_challenge_2.sql`
5. `supabase/seed/004_challenge_3.sql`
6. Your answers rows for each challenge (the private files in `supabase/seed-private/` are not in this repo). Insert one row per challenge into `challenge_answers` with the challenge id and a JSON array of `{ "id", "value", "tolerance" }` entries, one per question in `stage2_questions`. Tolerances are absolute.

For local development, turn off email confirmation under Authentication in the Supabase dashboard, since the built-in mailer is rate-limited.

### 5. Utility scripts (optional)

From `stratcode/`, you can run these local scripts against your Supabase project:

```bash
# Generate and store the AI baseline for a challenge
npx tsx --env-file=.env.local scripts/generate-baseline.ts <challenge-id>

# Verify grader ordering (weak < medium < strong) on calibration exemplars
npx tsx --env-file=.env.local scripts/calibrate.ts [challenge-id]

# Seed three demo solvers and grade their exemplar submissions
npx tsx --env-file=.env.local scripts/seed-demo.ts [challenge-id]

# Run the 11-check RLS and column-grant security test suite
npx tsx --env-file=.env.local scripts/rls-check.ts
```

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000/challenges. You will be redirected to sign in first.

## Deployment

The app is deployed on Vercel. To deploy your own copy:

1. Import the repository in Vercel and set **Root Directory** to `stratcode` (the app lives in a subfolder).
2. Add the four environment variables above in the Vercel project settings.
3. In Supabase, set the Site URL (under Authentication) to your Vercel URL.
4. Redeploy after changing any environment variable.

## Limitations

- Qualitative grading by an LLM is indicative, not certified, and needs calibration against human-scored examples.
- The AI baseline is a moving target: as models improve, the gap shrinks.
- Challenges use fictional, synthetic data only. Handling real business data would need anonymization, access tiers and contracts, none of which exist yet.
- The challenge rubrics and reference facts are in the public seed SQL, so this repository should be treated as a demo, not a secret test.
- Demand from founders and recruiters is an assumption that has not been validated.
- Security is demo-grade: permissions are enforced in the database, but abuse limits and monitoring are not built.

## License

No license has been chosen yet.
