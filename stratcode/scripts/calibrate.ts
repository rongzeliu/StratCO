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

// Local calibration script verifying that the grader ranks weak < medium < strong
// on the total score and on Stage 1 and Stage 3 separately.
// Never imported by the Next.js app.
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Ignore if .env.local is not present (e.g., env vars already set in shell)
}

const DEFAULT_CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";

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
  })
  .nullable()
  .optional();

async function main() {
  const challengeId = process.argv[2] ?? DEFAULT_CHALLENGE_ID;
  if (!z.uuid().safeParse(challengeId).success) {
    console.error(
      "Usage: npx tsx --env-file=.env.local scripts/calibrate.ts [challenge-id]"
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

  console.log(`Calibrating "${challenge.title}" (${challengeId})...\n`);

  const resultsByLabel = new Map<
    "weak" | "medium" | "strong",
    { stage1: number; stage2: number; stage3: number; total: number }
  >();

  for (const ex of exemplars) {
    const s2 = scoreStage2(ex.stage2, answers);
    const [g1, g3] = await Promise.all([
      gradeStage1(ex.stage1, challenge, baseline?.stage1 ?? null),
      gradeStage3(ex.stage3, challenge, baseline?.stage3 ?? null, {
        stage1Tree: ex.stage1,
        stage2Results: s2.perQuestion,
      }),
    ]);

    const total = totalScore(g1.score, s2.score, g3.score);
    resultsByLabel.set(ex.label, {
      stage1: g1.score,
      stage2: s2.score,
      stage3: g3.score,
      total,
    });
  }

  const weak = resultsByLabel.get("weak");
  const medium = resultsByLabel.get("medium");
  const strong = resultsByLabel.get("strong");

  if (!weak || !medium || !strong) {
    throw new Error("Exemplar file must include weak, medium, and strong.");
  }

  console.table([
    { label: "weak", ...weak },
    { label: "medium", ...medium },
    { label: "strong", ...strong },
  ]);

  const stage1Ordered = weak.stage1 < medium.stage1 && medium.stage1 < strong.stage1;
  const stage3Ordered = weak.stage3 < medium.stage3 && medium.stage3 < strong.stage3;
  const totalOrdered = weak.total < medium.total && medium.total < strong.total;

  const passed = stage1Ordered && stage3Ordered && totalOrdered;

  console.log(
    `\nOrder checks: Stage1=${stage1Ordered ? "OK" : "FAIL"}, Stage3=${stage3Ordered ? "OK" : "FAIL"}, Total=${totalOrdered ? "OK" : "FAIL"}`
  );
  console.log(passed ? "PASS" : "FAIL");

  if (!passed) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
