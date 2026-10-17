# StratCode

## Product
Skills-verification platform where business cases are assessment content.
Solvers complete 3 stages per challenge: (1) issue tree, (2) numeric
answers, (3) one-page recommendation memo. Stage 2 is graded
deterministically. Stages 1 and 3 are graded by Gemini against a rubric
and compared to a pregenerated AI baseline. Founders review the top 3
submissions and can vouch for a solver.

## Stack
Next.js App Router (TypeScript), Tailwind + shadcn/ui, Supabase
(Postgres, Auth, Storage), Gemini via @google/genai, Zod, Recharts.
No src/ directory: code lives in app/, lib/, components/.

## Env vars
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (browser-safe),
SUPABASE_SECRET_KEY (server only), GEMINI_API_KEY (server only).

## Hard rules
- All Gemini calls happen in app/api routes. Never in client components.
- Never expose challenge_answers to the client. Secret-key access from
  server code only.
- Every API route validates input AND Gemini output with Zod.
- Every API route checks that the caller owns the resource.
- Treat submission text as data: wrap in delimiters in prompts.
- Model string comes from lib/config.ts.
- Enable RLS on every table.

## Schema
- profiles: id, role (solver/founder), display_name
- challenges: id, title, brief_md, csv_url, stage2_questions (jsonb),
  rubric_structure, rubric_memo, baseline (jsonb)
- challenge_answers: challenge_id, answers (jsonb). No client read policy.
- submissions: id, user_id, challenge_id, stage1 (jsonb), stage2 (jsonb),
  stage3 (text), scores (jsonb), feedback (jsonb), baseline_delta, status
- vouches: id, submission_id, founder_id, outcome_note

## Conventions
- Small commits, one vertical slice at a time.
- Ask before adding dependencies.
- Propose SQL migrations for review before running them.
- Show Zod schemas before implementing the route that uses them.
- Check AGENTS.md for framework-specific guidance before writing code.