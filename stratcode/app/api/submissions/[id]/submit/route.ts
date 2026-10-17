import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ChallengeAnswerItemSchema,
  Stage1TreeSchema,
  Stage2AnswersSchema,
  Stage3MemoSchema,
  countTreeNodes,
} from "@/lib/grading/schemas";
import { scoreStage2 } from "@/lib/grading/stage2";
import { gradeStage1, gradeStage3 } from "@/lib/grading/gemini";
import { totalScore } from "@/lib/grading/total";

export const maxDuration = 60;

const SUBMISSION_COLUMNS =
  "id, user_id, challenge_id, stage1, stage2, stage3, status";
const CHALLENGE_COLUMNS =
  "id, title, brief_md, rubric_structure, rubric_memo, baseline, stage2_questions";
const ANSWERS_COLUMNS = "challenge_id, answers";

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

function notFoundResponse() {
  return NextResponse.json({ error: "Submission not found." }, { status: 404 });
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Identify the caller with the normal cookie-based server client and getUser().
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return notFoundResponse();
  }

  // 2. Load the submission with the admin client.
  // If not found OR user_id is not the caller's id, return the SAME 404 response.
  const admin = createAdminClient();
  const { data: submission, error: loadError } = await admin
    .from("submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (loadError || !submission || submission.user_id !== user.id) {
    return notFoundResponse();
  }

  // 3. Validate stage1, stage2, stage3 with the Zod schemas and minimum requirements.
  const s1Parsed = Stage1TreeSchema.safeParse(submission.stage1);
  if (!s1Parsed.success) {
    return NextResponse.json(
      {
        error:
          s1Parsed.error.issues[0]?.message ??
          "Stage 1 issue tree is invalid (make sure every node has non-empty text).",
      },
      { status: 400 }
    );
  }
  if (countTreeNodes(s1Parsed.data) < 2) {
    return NextResponse.json(
      { error: "Stage 1 requires at least 2 nodes in your issue tree." },
      { status: 400 }
    );
  }

  const s2Parsed = Stage2AnswersSchema.safeParse(submission.stage2);
  if (!s2Parsed.success) {
    return NextResponse.json(
      { error: "Stage 2 numeric answers are invalid." },
      { status: 400 }
    );
  }
  const hasNonNullStage2 = Object.values(s2Parsed.data).some(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  if (!hasNonNullStage2) {
    return NextResponse.json(
      { error: "Stage 2 requires at least one numeric answer." },
      { status: 400 }
    );
  }

  const s3Parsed = Stage3MemoSchema.safeParse(submission.stage3);
  if (!s3Parsed.success) {
    return NextResponse.json(
      {
        error:
          s3Parsed.error.issues[0]?.message ??
          "Stage 3 recommendation memo is invalid.",
      },
      { status: 400 }
    );
  }
  if (s3Parsed.data.trim().length < 50) {
    return NextResponse.json(
      {
        error:
          "Stage 3 recommendation memo must be at least 50 characters long.",
      },
      { status: 400 }
    );
  }

  // 4. Atomically claim the submission: single conditional update where id = X and status = 'draft'.
  const { data: claimed, error: claimError } = await admin
    .from("submissions")
    .update({ status: "grading", updated_at: new Date().toISOString() })
    .eq("id", submission.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) {
    return NextResponse.json(
      { error: "This submission has already been submitted or is being graded." },
      { status: 409 }
    );
  }

  // 5-9. Everything after the claim is wrapped in try/catch; if ANY step throws,
  // reset status back to 'draft' and return 500 with a generic message.
  try {
    // 5. Load the challenge and challenge_answers row with the admin client.
    const [{ data: challenge, error: chError }, { data: answerRow, error: ansError }] =
      await Promise.all([
        admin
          .from("challenges")
          .select(CHALLENGE_COLUMNS)
          .eq("id", submission.challenge_id)
          .single(),
        admin
          .from("challenge_answers")
          .select(ANSWERS_COLUMNS)
          .eq("challenge_id", submission.challenge_id)
          .single(),
      ]);

    if (chError || !challenge || ansError || !answerRow) {
      throw new Error("Failed to load challenge grading data.");
    }

    const answerList = z
      .array(ChallengeAnswerItemSchema)
      .parse(answerRow.answers);

    const parsedBaseline = BaselineSchema.safeParse(challenge.baseline);
    const baseline = parsedBaseline.success ? parsedBaseline.data : null;

    // 6. scoreStage2, then run gradeStage1 and gradeStage3 in parallel.
    const stage2Result = scoreStage2(s2Parsed.data, answerList);

    const [grade1, grade3] = await Promise.all([
      gradeStage1(
        s1Parsed.data,
        challenge,
        baseline?.stage1 ?? null
      ),
      gradeStage3(
        s3Parsed.data,
        challenge,
        baseline?.stage3 ?? null,
        {
          stage1Tree: s1Parsed.data,
          stage2Results: stage2Result.perQuestion,
        }
      ),
    ]);

    // 7. Compute totals and baseline_delta.
    const total = totalScore(grade1.score, stage2Result.score, grade3.score);
    const baselineTotal = baseline?.scores?.total;
    const baselineDelta =
      typeof baselineTotal === "number" && Number.isFinite(baselineTotal)
        ? Math.round((total - baselineTotal) * 100) / 100
        : null;

    const scores = {
      stage1: grade1.score,
      stage2: stage2Result.score,
      stage3: grade3.score,
      total,
    };

    const { score: _s1Score, ...grade1Feedback } = grade1;
    const { score: _s3Score, ...grade3Feedback } = grade3;
    void _s1Score;
    void _s3Score;

    const feedback = {
      stage1: grade1Feedback,
      stage2: { perQuestion: stage2Result.perQuestion },
      stage3: grade3Feedback,
      founder_summary: grade3.founder_summary,
    };

    // 8. Update the submission with scores, feedback, baseline_delta, and status='graded'.
    const { error: saveError } = await admin
      .from("submissions")
      .update({
        scores,
        feedback,
        baseline_delta: baselineDelta,
        status: "graded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", submission.id);

    if (saveError) {
      throw new Error("Failed to save grading results.");
    }

    return NextResponse.json({
      status: "graded",
      scores,
      baseline_delta: baselineDelta,
    });
  } catch {
    // 9. Reset status back to 'draft' and return 500 with a generic message.
    await admin
      .from("submissions")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", submission.id)
      .eq("status", "grading");

    return NextResponse.json(
      {
        error:
          "Grading could not be completed right now. Your submission has been returned to draft so you can try again.",
      },
      { status: 500 }
    );
  }
}
