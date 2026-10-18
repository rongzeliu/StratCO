# StratCode

A skills-verification platform where business cases are the assessment. Solvers work through realistic small-business problems in three stages, and are scored against an AI baseline, so a strong result shows judgment that goes beyond what a chatbot produces. Founders review a short list of top candidates and vouch for them.

**Live site:** https://strat-co.vercel.app

> **Status: work in progress.** Built as a hackathon project. See [Project status](#project-status) for what works today and what is planned. All businesses and data in the challenges are fictional.

## Why this exists

Finance and consulting recruiting leans heavily on school prestige, which shuts out strong self-taught candidates. Take-home work is also getting harder to trust now that AI can produce it. StratCode tries to produce a credential that is hard to fake: structured work on a realistic problem, graded partly by deterministic checks and partly by rubric, and compared with what an AI model produces from the same material.

## How a challenge works

Each challenge is a short client brief plus a small dataset. Solvers complete three stages:

| Stage | Solver submits | How it is graded |
|---|---|---|
| 1. Structure | An issue tree (nested outline) | Gemini, against a rubric: MECE-ness, coverage of drivers, prioritization |
| 2. Quantify | Six numeric answers computed from the CSV | Deterministic, against hidden answers with tolerances |
| 3. Recommend | A one-page, answer-first memo | Gemini, against a rubric: clarity, actionability, risks, next step |

The first challenge, **Brew & Co.**, asks why a coffee shop's variable margin fell between two quarters, and asks the solver to split the change into mix, price, and cost effects using a stated method.

## Project status

| Area | Status |
|---|---|
| Database schema with row-level security and column-level grants | Done |
| Seeded challenge 1 (brief, dataset, rubrics) | Done |
| Email and password auth, protected routes | Done |
| Challenge list and detail pages | Done |
| Three-stage workspace with draft saving | Done |
| Submit and grading pipeline (Stage 2 scoring, Gemini for Stages 1 and 3) | Planned |
| AI baseline generation and score-versus-baseline results | Planned |
| Founder dashboard and vouching | Planned |
| Leaderboard and solver profile | Planned |
| Challenges 2 and 3 (pricing, expansion) | Planned |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| UI | Tailwind CSS, shadcn/ui |
| Database and auth | Supabase (PostgreSQL, Auth) |
| AI grading | Gemini API via `@google/genai`, called server-side only |
| Validation | Zod |
| Charts | Recharts |
| Hosting | Vercel |

## Design and security notes

- **Row-level security on every table.** Solvers can read challenges and read and write only their own drafts.
- **Hidden answers.** Correct answers live in their own table with no client access at all, readable only with the server-side secret key.
- **Column-level grants.** Clients can write only the three stage fields of their own draft. Status, scores, feedback and baseline delta are server-only, and so are roles, which prevents self-promotion to founder.
- **Rubrics and baselines are not client-readable.** Queries list columns explicitly; there is no `select *` on `challenges`.
- **Secrets stay on the server.** The Gemini key and the Supabase secret key are never exposed to browser code.

## Repository layout

```
StratCO/
  README.md                  this file
  stratcode/                 the Next.js app (run all commands from here)
    app/                     routes and pages
    components/              UI components (shadcn/ui under components/ui)
    lib/                     config.ts (Gemini model id), Supabase clients, utilities
    public/data/             challenge datasets (CSV)
    supabase/
      migrations/            001_init.sql: schema, security policies, signup trigger
      seed/                  challenge seed SQL (brief, rubrics, questions)
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

### 3. Pick a Gemini model

Set a current model id in `lib/config.ts`:

```ts
export const GEMINI_MODEL = "<model id from Google AI Studio>";
```

### 4. Set up the database

In the Supabase SQL Editor, run these in order:

1. `supabase/migrations/001_init.sql`
2. `supabase/seed/002_challenge_1.sql`
3. Your own answers row for challenge 1 (the private file is not in this repo). Insert one row into `challenge_answers` with the challenge id and a JSON array of `{ "id", "value", "tolerance" }` entries, one per question in `stage2_questions`. Tolerances are absolute.

For local development, turn off email confirmation under Authentication in the Supabase dashboard, since the built-in mailer is rate-limited.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000/challenges. You will be redirected to sign in first.

## Limitations

- Qualitative grading by an LLM is indicative, not certified, and needs calibration against human-scored examples.
- The AI baseline is a moving target: as models improve, the gap shrinks.
- Challenges use fictional, synthetic data only. Handling real business data would need anonymization, access tiers and contracts, none of which exist yet.
- Demand from founders and recruiters is an assumption that has not been validated.
- Security is demo-grade: permissions are enforced in the database, but abuse limits and monitoring are not built.

## License

No license has been chosen yet.
