import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubmissionScores } from "@/lib/submissions";

// DTO sent to the browser on /founder.
// Never contains user_id, email, stage text, or rubric data.
export type FounderSubmissionCard = {
  submissionId: string;
  rank: number;
  displayName: string;
  scores: SubmissionScores;
  baselineDelta: number | null;
  founderSummary: string | null;
  alreadyVouched: boolean;
};

export type FounderChallengeSection = {
  challengeId: string;
  challengeTitle: string;
  topSubmissions: FounderSubmissionCard[];
};

function parseScores(val: unknown): SubmissionScores | null {
  if (typeof val !== "object" || val === null || Array.isArray(val)) {
    return null;
  }
  const s = val as Record<string, unknown>;
  if (
    typeof s.stage1 === "number" &&
    typeof s.stage2 === "number" &&
    typeof s.stage3 === "number" &&
    typeof s.total === "number"
  ) {
    return {
      stage1: s.stage1,
      stage2: s.stage2,
      stage3: s.stage3,
      total: s.total,
    };
  }
  return null;
}

function extractFounderSummary(feedback: unknown): string | null {
  if (typeof feedback !== "object" || feedback === null || Array.isArray(feedback)) {
    return null;
  }
  const f = feedback as Record<string, unknown>;
  if (typeof f.founder_summary === "string" && f.founder_summary.trim()) {
    return f.founder_summary;
  }
  if (typeof f.stage3 === "object" && f.stage3 !== null) {
    const s3 = f.stage3 as Record<string, unknown>;
    if (typeof s3.founder_summary === "string" && s3.founder_summary.trim()) {
      return s3.founder_summary;
    }
  }
  return null;
}

// Identifies the caller with getUser(), reads their profiles row (id, role)
// with the normal client, and redirects to /challenges if role !== 'founder'.
export async function requireFounder(): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profError || !profile || profile.role !== "founder") {
    redirect("/challenges");
  }

  return { id: user.id };
}

export async function loadFounderDashboardData(): Promise<
  FounderChallengeSection[]
> {
  const founder = await requireFounder();
  const supabase = await createClient();
  const admin = createAdminClient();

  // Load challenges (id, title) explicitly.
  const { data: challenges, error: chError } = await admin
    .from("challenges")
    .select("id, title")
    .order("created_at", { ascending: true });

  if (chError) {
    throw new Error(`Failed to load challenges: ${chError.message}`);
  }

  // Load the founder's existing vouches via the normal client (RLS enforced).
  const { data: myVouches } = await supabase
    .from("vouches")
    .select("submission_id")
    .eq("founder_id", founder.id);

  const vouchedSubmissionIds = new Set(
    (myVouches ?? []).map((v) => v.submission_id)
  );

  const sections: FounderChallengeSection[] = [];

  for (const ch of challenges ?? []) {
    // Select only: id, user_id, scores, baseline_delta, feedback (for founder_summary).
    const { data: gradedRows, error: subError } = await admin
      .from("submissions")
      .select("id, user_id, scores, baseline_delta, feedback")
      .eq("challenge_id", ch.id)
      .eq("status", "graded");

    if (subError) {
      throw new Error(`Failed to load submissions: ${subError.message}`);
    }

    const parsedRows = (gradedRows ?? [])
      .map((row) => {
        const scores = parseScores(row.scores);
        if (!scores) return null;
        const delta =
          typeof row.baseline_delta === "number"
            ? row.baseline_delta
            : typeof row.baseline_delta === "string" &&
                row.baseline_delta.trim() !== ""
              ? Number(row.baseline_delta)
              : null;

        return {
          id: row.id,
          userId: row.user_id,
          scores,
          baselineDelta: delta !== null && Number.isFinite(delta) ? delta : null,
          founderSummary: extractFounderSummary(row.feedback),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.scores.total - a.scores.total)
      .slice(0, 3);

    // Load display_name for the top 3 solvers via the admin client.
    const userIds = Array.from(new Set(parsedRows.map((r) => r.userId)));
    const displayNameById = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      for (const p of profiles ?? []) {
        displayNameById.set(
          p.id,
          p.display_name && p.display_name.trim()
            ? p.display_name
            : `Solver ${p.id.slice(0, 4)}`
        );
      }
    }

    const topSubmissions: FounderSubmissionCard[] = parsedRows.map(
      (row, idx) => ({
        submissionId: row.id,
        rank: idx + 1,
        displayName:
          displayNameById.get(row.userId) ?? `Solver ${row.userId.slice(0, 4)}`,
        scores: row.scores,
        baselineDelta: row.baselineDelta,
        founderSummary: row.founderSummary,
        alreadyVouched: vouchedSubmissionIds.has(row.id),
      })
    );

    sections.push({
      challengeId: ch.id,
      challengeTitle: ch.title,
      topSubmissions,
    });
  }

  return sections;
}
