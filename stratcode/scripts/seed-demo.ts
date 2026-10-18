import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createAdminClient } from "../lib/supabase/admin";
import {
  ChallengeAnswerItemSchema,
  Stage1TreeSchema,
  Stage2AnswersSchema,
  Stage3MemoSchema,
} from "../lib/grading/schemas";
import { scoreStage2 } from "../lib/grading/stage2";
import { gradeStage1, gradeStage3 } from "../lib/grading/gemini";
import { totalScore } from "../lib/grading/total";

// Local demo-seeding script that creates three confirmed demo users, sets their
// display names, writes their draft submissions from the calibration exemplars,
// and grades + saves them identically to the submit route.
// Safe to re-run: skips users/submissions that already exist.
// Never imported by the Next.js app.
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Ignore if .env.local is not present (e.g., env vars already set in shell)
}

const DEFAULT_CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";

const DEMO_USERS: Array<{
  label: "weak" | "medium" | "strong";
  email: string;
  displayName: string;
}> = [
  {
    label: "weak",
    email: "demo-weak@example.com",
    displayName: "Demo Solver A",
  },
  {
    label: "medium",
    email: "demo-medium@example.com",
    displayName: "Demo Solver B",
  },
  {
    label: "strong",
    email: "demo-strong@example.com",
    displayName: "Demo Solver C",
  },
];

const ExemplarItemSchema = z.object({
  label: z.enum(["weak", "medium", "strong"]),
  stage1: Stage1TreeSchema,
  stage2: Stage2AnswersSchema,
  stage3: Stage3MemoSchema,
});

const ExemplarFileSchema = z.object({
  exemplars: z.array(ExemplarItemSchema).length(3),
});

const BaselineSchema = z
  .object({
    stage1: Stage1TreeSchema.optional(),
    stage3: z.string().optional(),
    scores: z
      .object({
        total: z.number().finite(),
      })
      .optional(),
  })
  .nullable()
  .optional();

async function main() {
  const challengeId = process.argv[2] ?? DEFAULT_CHALLENGE_ID;
  if (!z.uuid().safeParse(challengeId).success) {
    console.error(
      "Usage: npx tsx --env-file=.env.local scripts/seed-demo.ts [challenge-id]"
    );
    process.exit(1);
  }

  const filePath = path.join(
    process.cwd(),
    "scripts",
    "calibration",
    `${challengeId}.json`
  );
  const rawFile = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  const { exemplars } = ExemplarFileSchema.parse(rawFile);
  const exemplarByLabel = new Map(exemplars.map((e) => [e.label, e]));

  const admin = createAdminClient();
  const [{ data: challenge, error: chErr }, { data: ansRow, error: ansErr }] =
    await Promise.all([
      admin
        .from("challenges")
        .select(
          "id, title, brief_md, rubric_structure, rubric_memo, baseline"
        )
        .eq("id", challengeId)
        .single(),
      admin
        .from("challenge_answers")
        .select("challenge_id, answers")
        .eq("challenge_id", challengeId)
        .single(),
    ]);

  if (chErr || !challenge || ansErr || !ansRow) {
    throw new Error("Failed to load challenge or challenge_answers.");
  }

  const answers = z.array(ChallengeAnswerItemSchema).parse(ansRow.answers);
  const parsedBaseline = BaselineSchema.safeParse(challenge.baseline);
  const baseline = parsedBaseline.success ? parsedBaseline.data : null;

  const { data: existingUsersList, error: listErr } =
    await admin.auth.admin.listUsers();
  if (listErr) {
    throw new Error(`Failed to list users: ${listErr.message}`);
  }

  for (const demo of DEMO_USERS) {
    const ex = exemplarByLabel.get(demo.label);
    if (!ex) continue;

    let userId = existingUsersList.users.find(
      (u) => u.email?.toLowerCase() === demo.email.toLowerCase()
    )?.id;

    if (!userId) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: demo.email,
          password: `DemoPass_${demo.label}_2026!`,
          email_confirm: true,
        });

      if (createErr || !created.user) {
        throw new Error(
          `Failed to create demo user ${demo.email}: ${createErr?.message ?? "unknown"}`
        );
      }
      userId = created.user.id;
      console.log(`Created demo user: ${demo.email} (${demo.displayName})`);
    } else {
      console.log(
        `Skipped creating user ${demo.email} (already exists as ${demo.displayName})`
      );
    }

    // Ensure profile exists and set display_name with a server-side update.
    await admin
      .from("profiles")
      .update({ display_name: demo.displayName })
      .eq("id", userId);

    // Check if submission already exists for this user + challenge.
    const { data: existingSub } = await admin
      .from("submissions")
      .select("id, status, scores")
      .eq("user_id", userId)
      .eq("challenge_id", challengeId)
      .maybeSingle();

    if (existingSub && existingSub.status === "graded") {
      console.log(
        `Skipped grading ${demo.displayName}: submission ${existingSub.id} is already graded (${JSON.stringify(existingSub.scores)}).`
      );
      continue;
    }

    let submissionId = existingSub?.id;
    if (!submissionId) {
      const { data: draft, error: draftErr } = await admin
        .from("submissions")
        .insert({
          user_id: userId,
          challenge_id: challengeId,
          stage1: ex.stage1,
          stage2: ex.stage2,
          stage3: ex.stage3,
          status: "draft",
        })
        .select("id")
        .single();

      if (draftErr || !draft) {
        throw new Error(
          `Failed to insert draft for ${demo.displayName}: ${draftErr?.message ?? "unknown"}`
        );
      }
      submissionId = draft.id;
    }

    console.log(`Grading ${demo.displayName} (${demo.label} exemplar)...`);
    const s2Result = scoreStage2(ex.stage2, answers);
    const [grade1, grade3] = await Promise.all([
      gradeStage1(ex.stage1, challenge, baseline?.stage1 ?? null),
      gradeStage3(ex.stage3, challenge, baseline?.stage3 ?? null, {
        stage1Tree: ex.stage1,
        stage2Results: s2Result.perQuestion,
      }),
    ]);

    const total = totalScore(grade1.score, s2Result.score, grade3.score);
    const baselineTotal = baseline?.scores?.total;
    const baselineDelta =
      typeof baselineTotal === "number" && Number.isFinite(baselineTotal)
        ? Math.round((total - baselineTotal) * 100) / 100
        : null;

    const scores = {
      stage1: grade1.score,
      stage2: s2Result.score,
      stage3: grade3.score,
      total,
    };

    const { score: _s1, ...grade1Feedback } = grade1;
    const { score: _s3, ...grade3Feedback } = grade3;
    void _s1;
    void _s3;

    const feedback = {
      stage1: grade1Feedback,
      stage2: { perQuestion: s2Result.perQuestion },
      stage3: grade3Feedback,
      founder_summary: grade3.founder_summary,
    };

    const { error: saveErr } = await admin
      .from("submissions")
      .update({
        scores,
        feedback,
        baseline_delta: baselineDelta,
        status: "graded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (saveErr) {
      throw new Error(
        `Failed to save graded submission for ${demo.displayName}: ${saveErr.message}`
      );
    }

    console.log(
      `Saved graded submission for ${demo.displayName}: total=${total}/100 (delta=${baselineDelta ?? "n/a"})`
    );
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
