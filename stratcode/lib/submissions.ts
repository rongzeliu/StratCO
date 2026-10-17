import "server-only";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Explicit column list for submissions (never select *).
const SUBMISSION_COLUMNS =
  "id, status, scores, feedback, baseline_delta, stage1, stage2, stage3";

export type IssueTreeNode = {
  id: string;
  text: string;
  children: IssueTreeNode[];
};

export type Stage2Answers = Record<string, number | null>;

export type SubmissionScores = {
  stage1: number;
  stage2: number;
  stage3: number;
  total: number;
};

export type CriterionEvidenceItem = {
  id: string;
  score: number;
  evidence: string;
};

export type StageQualitativeFeedback = {
  criteria: CriterionEvidenceItem[];
  strengths: string[];
  gaps: string[];
  beyond_baseline: string[];
  founder_summary?: string;
};

export type Stage2PerQuestionFeedback = {
  id: string;
  correct: boolean;
};

export type SubmissionFeedback = {
  stage1: StageQualitativeFeedback | null;
  stage2: { perQuestion: Stage2PerQuestionFeedback[] } | null;
  stage3: StageQualitativeFeedback | null;
  founder_summary: string | null;
};

export type SubmissionDraft = {
  id: string;
  status: string;
  scores: SubmissionScores | null;
  feedback: SubmissionFeedback | null;
  baseline_delta: number | null;
  stage1: IssueTreeNode[] | null;
  stage2: Stage2Answers | null;
  stage3: string | null;
};

function isIssueTreeNodeArray(val: unknown): val is IssueTreeNode[] {
  if (!Array.isArray(val)) return false;
  return val.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as IssueTreeNode).id === "string" &&
      typeof (item as IssueTreeNode).text === "string" &&
      isIssueTreeNodeArray((item as IssueTreeNode).children)
  );
}

function isStage2Answers(val: unknown): val is Stage2Answers {
  if (typeof val !== "object" || val === null || Array.isArray(val)) {
    return false;
  }
  return Object.values(val).every(
    (v) => v === null || (typeof v === "number" && Number.isFinite(v))
  );
}

function isSubmissionScores(val: unknown): val is SubmissionScores {
  if (typeof val !== "object" || val === null || Array.isArray(val)) {
    return false;
  }
  const s = val as Record<string, unknown>;
  return (
    typeof s.stage1 === "number" &&
    typeof s.stage2 === "number" &&
    typeof s.stage3 === "number" &&
    typeof s.total === "number"
  );
}

function parseStageQualitative(val: unknown): StageQualitativeFeedback | null {
  if (typeof val !== "object" || val === null || Array.isArray(val)) {
    return null;
  }
  const obj = val as Record<string, unknown>;
  const criteria: CriterionEvidenceItem[] = Array.isArray(obj.criteria)
    ? obj.criteria
        .filter(
          (c): c is Record<string, unknown> =>
            typeof c === "object" &&
            c !== null &&
            typeof (c as Record<string, unknown>).id === "string" &&
            typeof (c as Record<string, unknown>).score === "number" &&
            typeof (c as Record<string, unknown>).evidence === "string"
        )
        .map((c) => ({
          id: c.id as string,
          score: c.score as number,
          evidence: c.evidence as string,
        }))
    : [];

  const toStringList = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];

  return {
    criteria,
    strengths: toStringList(obj.strengths),
    gaps: toStringList(obj.gaps),
    beyond_baseline: toStringList(obj.beyond_baseline),
    founder_summary:
      typeof obj.founder_summary === "string" ? obj.founder_summary : undefined,
  };
}

function parseSubmissionFeedback(val: unknown): SubmissionFeedback | null {
  if (typeof val !== "object" || val === null || Array.isArray(val)) {
    return null;
  }
  const f = val as Record<string, unknown>;
  const stage1 = parseStageQualitative(f.stage1);
  const stage3 = parseStageQualitative(f.stage3);

  let stage2: { perQuestion: Stage2PerQuestionFeedback[] } | null = null;
  if (typeof f.stage2 === "object" && f.stage2 !== null) {
    const s2 = f.stage2 as Record<string, unknown>;
    if (Array.isArray(s2.perQuestion)) {
      stage2 = {
        perQuestion: s2.perQuestion
          .filter(
            (q): q is Record<string, unknown> =>
              typeof q === "object" &&
              q !== null &&
              typeof (q as Record<string, unknown>).id === "string" &&
              typeof (q as Record<string, unknown>).correct === "boolean"
          )
          .map((q) => ({
            id: q.id as string,
            correct: q.correct as boolean,
          })),
      };
    }
  }

  const founderSummary =
    typeof f.founder_summary === "string"
      ? f.founder_summary
      : stage3?.founder_summary ?? null;

  return {
    stage1,
    stage2,
    stage3,
    founder_summary: founderSummary,
  };
}

export async function getMySubmission(
  challengeId: string
): Promise<SubmissionDraft | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load submission: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  const delta =
    typeof data.baseline_delta === "number"
      ? data.baseline_delta
      : typeof data.baseline_delta === "string" && data.baseline_delta.trim() !== ""
        ? Number(data.baseline_delta)
        : null;

  return {
    id: data.id,
    status: data.status,
    scores: isSubmissionScores(data.scores) ? data.scores : null,
    feedback: parseSubmissionFeedback(data.feedback),
    baseline_delta: delta !== null && Number.isFinite(delta) ? delta : null,
    stage1: isIssueTreeNodeArray(data.stage1) ? data.stage1 : null,
    stage2: isStage2Answers(data.stage2) ? data.stage2 : null,
    stage3: typeof data.stage3 === "string" ? data.stage3 : null,
  };
}

// Reads ONLY the numeric baseline stage scores on the server for a graded submission
// so the Recharts comparison bar chart can display baseline bars without ever exposing
// baseline text or rubrics.
export async function getChallengeBaselineScores(
  challengeId: string
): Promise<SubmissionScores | null> {
  await requireUser();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("challenges")
    .select("baseline")
    .eq("id", challengeId)
    .maybeSingle();

  if (error || !data || typeof data.baseline !== "object" || data.baseline === null) {
    return null;
  }

  const b = data.baseline as Record<string, unknown>;
  return isSubmissionScores(b.scores) ? b.scores : null;
}
