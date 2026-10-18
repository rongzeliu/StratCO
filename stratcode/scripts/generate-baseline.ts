import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { GEMINI_MODEL, GEMINI_MODELS } from "../lib/config";
import { createAdminClient } from "../lib/supabase/admin";
import {
  ChallengeAnswerItemSchema,
  Stage1TreeSchema,
  Stage2AnswersSchema,
  Stage3MemoSchema,
  type Stage1Tree,
  type Stage2Answers,
} from "../lib/grading/schemas";
import { scoreStage2 } from "../lib/grading/stage2";
import { gradeStage1, gradeStage3 } from "../lib/grading/gemini";
import { totalScore } from "../lib/grading/total";

// One-off local script to generate and grade the AI baseline for a challenge.
// Never imported by the Next.js app.
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Ignore if .env.local is not present (e.g., env vars already set in shell)
}

const Stage2QuestionItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.string(),
});

const BaselineCandidateOutputSchema = z.object({
  stage1: Stage1TreeSchema,
  stage2: Stage2AnswersSchema,
  stage3: Stage3MemoSchema,
});

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

async function generateBaselineCandidate(
  title: string,
  briefMd: string,
  csvText: string,
  questions: z.infer<typeof Stage2QuestionItemSchema>[]
): Promise<{
  stage1: Stage1Tree;
  stage2: Stage2Answers;
  stage3: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const questionSpec = questions
    .map((q) => `- "${q.id}": ${q.label} (in ${q.unit})`)
    .join("\n");

  const systemInstruction =
    "You are a competent but unremarkable junior business analyst completing a timed case assessment. You have ONLY the case brief and the raw CSV dataset. Give a solid, standard textbook response without insider shortcuts.";

  const prompt = [
    `Case Title: ${title}`,
    "",
    "Case Brief:",
    briefMd,
    "",
    "CSV Dataset:",
    csvText.trim(),
    "",
    "Complete all three stages and return ONLY valid JSON matching the exact structure below:",
    "{",
    '  "stage1": [',
    '    { "id": "n1", "text": "Top-level branch (1-200 chars)", "children": [ { "id": "n1_1", "text": "Sub-branch", "children": [] } ] }',
    "  ],",
    '  "stage2": {',
    questions.map((q) => `    "${q.id}": <number>`).join(",\n"),
    "  },",
    '  "stage3": "<one-page recommendation memo, strictly under 300 words>"',
    "}",
    "",
    "Requirements:",
    "1. stage1: Issue tree in the app's recursive shape ({ id, text, children }). Max depth 4, max 40 nodes total, 1-200 characters per node.",
    "2. stage2: Provide a finite numeric answer (rounded to 2 decimal places) for EVERY question id listed below:",
    questionSpec,
    "3. stage3: Recommendation memo under 300 words.",
  ].join("\n");

  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        });

        const rawText = response.text;
        if (!rawText) {
          throw new Error("Gemini returned an empty response.");
        }

        const parsedJson: unknown = JSON.parse(rawText);
        const parsed = BaselineCandidateOutputSchema.parse(parsedJson);

        for (const q of questions) {
          const v = parsed.stage2[q.id];
          if (typeof v !== "number" || !Number.isFinite(v)) {
            throw new Error(
              `Baseline missing numeric answer for question "${q.id}".`
            );
          }
        }

        if (countWords(parsed.stage3) > 300) {
          throw new Error(
            `Baseline memo exceeded 300 words (${countWords(parsed.stage3)} words).`
          );
        }

        return parsed;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("429") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("404")
        ) {
          break;
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to generate valid baseline candidate output.");
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const challengeId = args.find((a) => !a.startsWith("-"));

  if (!challengeId || !z.uuid().safeParse(challengeId).success) {
    console.error(
      "Usage: npx tsx --env-file=.env.local scripts/generate-baseline.ts <challenge-id> [--force]"
    );
    process.exit(1);
  }

  const admin = createAdminClient();

  // Explicit column list (never select *).
  const { data: challenge, error: chError } = await admin
    .from("challenges")
    .select(
      "id, title, brief_md, csv_url, stage2_questions, rubric_structure, rubric_memo, baseline"
    )
    .eq("id", challengeId)
    .maybeSingle();

  if (chError) {
    throw new Error(`Failed to load challenge: ${chError.message}`);
  }
  if (!challenge) {
    throw new Error(`Challenge not found: ${challengeId}`);
  }

  if (challenge.baseline !== null && !force) {
    console.error(
      `Challenge ${challengeId} already has a baseline. Re-run with --force to overwrite.`
    );
    process.exit(1);
  }

  if (!challenge.csv_url) {
    throw new Error(`Challenge ${challengeId} has no csv_url.`);
  }

  // Read the CSV from the public/ folder on disk using csv_url.
  const relativeCsvPath = challenge.csv_url.replace(/^\/+/, "");
  const csvDiskPath = path.join(process.cwd(), "public", relativeCsvPath);
  const csvText = fs.readFileSync(csvDiskPath, "utf-8");

  const questions = z
    .array(Stage2QuestionItemSchema)
    .parse(challenge.stage2_questions);

  const { data: answerRow, error: ansError } = await admin
    .from("challenge_answers")
    .select("challenge_id, answers")
    .eq("challenge_id", challengeId)
    .single();

  if (ansError || !answerRow) {
    throw new Error(
      `Failed to load challenge_answers for ${challengeId}: ${ansError?.message ?? "missing row"}`
    );
  }

  const answers = z.array(ChallengeAnswerItemSchema).parse(answerRow.answers);

  console.log(
    `Generating AI baseline for "${challenge.title}" (${challengeId}) using ${GEMINI_MODEL}...`
  );

  // 1. Generate the baseline candidate response (given ONLY brief + CSV).
  const candidate = await generateBaselineCandidate(
    challenge.title,
    challenge.brief_md,
    csvText,
    questions
  );

  // 2. Grade it with the same grading library (baseline = null).
  const stage2Result = scoreStage2(candidate.stage2, answers);

  const [grade1, grade3] = await Promise.all([
    gradeStage1(candidate.stage1, challenge, null),
    gradeStage3(candidate.stage3, challenge, null, {
      stage1Tree: candidate.stage1,
      stage2Results: stage2Result.perQuestion,
    }),
  ]);

  const total = totalScore(grade1.score, stage2Result.score, grade3.score);

  const baselineRecord = {
    model: GEMINI_MODEL,
    generated_at: new Date().toISOString(),
    stage1: candidate.stage1,
    stage2: candidate.stage2,
    stage3: candidate.stage3,
    scores: {
      stage1: grade1.score,
      stage2: stage2Result.score,
      stage3: grade3.score,
      total,
    },
  };

  // 3. Save to challenges.baseline.
  const { error: updateError } = await admin
    .from("challenges")
    .update({ baseline: baselineRecord })
    .eq("id", challengeId);

  if (updateError) {
    throw new Error(`Failed to save baseline: ${updateError.message}`);
  }

  console.log("\n=== AI Baseline Scores ===");
  console.log(JSON.stringify(baselineRecord.scores, null, 2));

  console.log("\n=== Raw AI Baseline ===");
  console.log(JSON.stringify(baselineRecord, null, 2));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
