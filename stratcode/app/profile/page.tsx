import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SubmissionScores } from "@/lib/submissions";
import { AppHeader } from "@/components/app-header";
import { ProfileNameForm } from "@/components/profile-name-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function ProfilePage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your public display name, graded submissions, and founder
              vouches.
            </p>
          </div>

          <Suspense fallback={<ProfileSkeleton />}>
            <ProfileContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function ProfileContent() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Load profile, challenges, user's graded submissions, and vouches received
  // using the normal client (RLS enforced; explicit column lists).
  const [
    { data: profile },
    { data: challenges },
    { data: gradedSubmissions },
    { data: vouches },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("challenges")
      .select("id, title"),
    supabase
      .from("submissions")
      .select("id, challenge_id, scores, baseline_delta, status")
      .eq("user_id", user.id)
      .eq("status", "graded"),
    supabase
      .from("vouches")
      .select("id, submission_id, outcome_note, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const displayName =
    profile?.display_name && profile.display_name.trim()
      ? profile.display_name
      : `Solver ${user.id.slice(0, 4)}`;

  const challengeTitleById = new Map(
    (challenges ?? []).map((c) => [c.id, c.title])
  );

  const submissionChallengeById = new Map(
    (gradedSubmissions ?? []).map((s) => [
      s.id,
      challengeTitleById.get(s.challenge_id) ?? "Challenge",
    ])
  );

  // Only show vouches belonging to this solver's submissions (in case the user is also a founder).
  const mySubmissionIds = new Set((gradedSubmissions ?? []).map((s) => s.id));
  const receivedVouches = (vouches ?? []).filter((v) =>
    mySubmissionIds.has(v.submission_id)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Display Name Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{displayName}</CardTitle>
            <Badge variant="secondary">{profile?.role ?? "solver"}</Badge>
          </div>
          <CardDescription>
            Shown on the leaderboard and founder review dashboard instead of
            your email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileNameForm initialDisplayName={displayName} />
        </CardContent>
      </Card>

      {/* Graded Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Graded submissions</CardTitle>
          <CardDescription>
            Your completed cases and stage score bars (0 to 10)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!gradedSubmissions || gradedSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no graded submissions yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {gradedSubmissions.map((sub) => {
                const scores = parseScores(sub.scores);
                if (!scores) return null;
                const title =
                  challengeTitleById.get(sub.challenge_id) ?? "Challenge";

                return (
                  <div
                    key={sub.id}
                    className="flex flex-col gap-3 rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/challenges/${sub.challenge_id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {title}
                      </Link>
                      <Badge variant="default" className="font-mono">
                        Total: {scores.total} / 100
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <StageScoreBar
                        label="Stage 1: Issue tree"
                        score={scores.stage1}
                      />
                      <StageScoreBar
                        label="Stage 2: Numbers"
                        score={scores.stage2}
                      />
                      <StageScoreBar
                        label="Stage 3: Memo"
                        score={scores.stage3}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vouches Received */}
      <Card>
        <CardHeader>
          <CardTitle>Vouches received</CardTitle>
          <CardDescription>
            Founder verification notes on your graded submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {receivedVouches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vouches received yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {receivedVouches.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col gap-1.5 rounded-xl border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {submissionChallengeById.get(v.submission_id) ??
                        "Verified submission"}
                    </span>
                    <Badge variant="default">Vouched</Badge>
                  </div>
                  <p className="text-sm leading-relaxed">
                    {v.outcome_note ?? "Verified by founder."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StageScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium tabular-nums">{score} / 10</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
    </div>
  );
}
