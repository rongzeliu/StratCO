import "server-only";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Sanitized row sent to the browser on /leaderboard.
// Never contains user_id or email.
export type LeaderboardRow = {
  rank: number;
  displayName: string;
  totalScore: number;
  baselineDelta: number | null;
  vouchCount: number;
  isCurrentUser: boolean;
};

export type ChallengeLeaderboard = {
  challengeId: string;
  challengeTitle: string;
  rows: LeaderboardRow[];
  currentUserPercentile: number | null;
};

function parseTotalScore(scores: unknown): number | null {
  if (typeof scores !== "object" || scores === null || Array.isArray(scores)) {
    return null;
  }
  const s = scores as Record<string, unknown>;
  return typeof s.total === "number" && Number.isFinite(s.total)
    ? s.total
    : null;
}

export async function loadLeaderboardData(): Promise<ChallengeLeaderboard[]> {
  const currentUser = await requireUser();
  const admin = createAdminClient();

  const { data: challenges, error: chError } = await admin
    .from("challenges")
    .select("id, title")
    .order("created_at", { ascending: true });

  if (chError) {
    throw new Error(`Failed to load challenges: ${chError.message}`);
  }

  const results: ChallengeLeaderboard[] = [];

  for (const ch of challenges ?? []) {
    const { data: submissions, error: subError } = await admin
      .from("submissions")
      .select("id, user_id, scores, baseline_delta")
      .eq("challenge_id", ch.id)
      .eq("status", "graded");

    if (subError) {
      throw new Error(`Failed to load leaderboard rows: ${subError.message}`);
    }

    const parsed = (submissions ?? [])
      .map((row) => {
        const totalScore = parseTotalScore(row.scores);
        if (totalScore === null) return null;
        const delta =
          typeof row.baseline_delta === "number"
            ? row.baseline_delta
            : typeof row.baseline_delta === "string" &&
                row.baseline_delta.trim() !== ""
              ? Number(row.baseline_delta)
              : null;

        return {
          submissionId: row.id,
          userId: row.user_id,
          totalScore,
          baselineDelta: delta !== null && Number.isFinite(delta) ? delta : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.totalScore - a.totalScore);

    const userIds = Array.from(new Set(parsed.map((r) => r.userId)));
    const submissionIds = parsed.map((r) => r.submissionId);

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

    const vouchCountBySubId = new Map<string, number>();
    if (submissionIds.length > 0) {
      const { data: vouches } = await admin
        .from("vouches")
        .select("submission_id")
        .in("submission_id", submissionIds);

      for (const v of vouches ?? []) {
        vouchCountBySubId.set(
          v.submission_id,
          (vouchCountBySubId.get(v.submission_id) ?? 0) + 1
        );
      }
    }

    const rows: LeaderboardRow[] = parsed.map((r, idx) => ({
      rank: idx + 1,
      displayName:
        displayNameById.get(r.userId) ?? `Solver ${r.userId.slice(0, 4)}`,
      totalScore: r.totalScore,
      baselineDelta: r.baselineDelta,
      vouchCount: vouchCountBySubId.get(r.submissionId) ?? 0,
      isCurrentUser: r.userId === currentUser.id,
    }));

    let currentUserPercentile: number | null = null;
    const myEntry = parsed.find((r) => r.userId === currentUser.id);
    if (myEntry && parsed.length > 0) {
      if (parsed.length === 1) {
        currentUserPercentile = 100;
      } else {
        const strictlyLower = parsed.filter(
          (r) => r.totalScore < myEntry.totalScore
        ).length;
        currentUserPercentile = Math.round(
          (strictlyLower / (parsed.length - 1)) * 100
        );
      }
    }

    results.push({
      challengeId: ch.id,
      challengeTitle: ch.title,
      rows,
      currentUserPercentile,
    });
  }

  return results;
}
