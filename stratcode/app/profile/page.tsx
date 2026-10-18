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
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-6 py-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-page-title">Profile</h1>
            <p className="text-secondary">
              Manage your display name, graded submissions, and founder vouches.
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
    supabase.from("challenges").select("id, title"),
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

  const mySubmissionIds = new Set((gradedSubmissions ?? []).map((s) => s.id));
  const receivedVouches = (vouches ?? []).filter((v) =>
    mySubmissionIds.has(v.submission_id)
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Display Name Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{displayName}</CardTitle>
            <Badge variant="secondary">{profile?.role ?? "solver"}</Badge>
          </div>
          <CardDescription>
            Shown on the leaderboard and founder dashboard instead of your
            email.
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
            Completed cases and stage scores (0 to 10)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!gradedSubmissions || gradedSubmissions.length === 0 ? (
            <p className="text-secondary">
              You have no graded submissions yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {gradedSubmissions.map((sub) => {
                const scores = parseScores(sub.scores);
                if (!scores) return null;
                const title =
                  challengeTitleById.get(sub.challenge_id) ?? "Challenge";

                return (
                  <div
                    key={sub.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/challenges/${sub.challenge_id}`}
                        className="focus-ring rounded-[10px] font-medium text-primary hover:underline"
                      >
                        {title}
                      </Link>
                      <Badge variant="secondary" className="tabular">
                        Total: {scores.total} / 100
                      </Badge>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <StageScoreBar
                        label="Issue tree"
                        score={scores.stage1}
                      />
                      <StageScoreBar label="Numbers" score={scores.stage2} />
                      <StageScoreBar label="Memo" score={scores.stage3} />
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
            <p className="text-secondary">No vouches received yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {receivedVouches.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {submissionChallengeById.get(v.submission_id) ??
                        "Verified submission"}
                    </span>
                    <Badge variant="secondary">Vouched</Badge>
                  </div>
                  <p className="max-w-[65ch] text-secondary">
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-caption">
        <span>{label}</span>
        <span className="tabular font-medium text-foreground">
          {score} / 10
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
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
    <div className="flex flex-col gap-8">
      <Skeleton className="h-40 rounded-[12px]" />
      <Skeleton className="h-48 rounded-[12px]" />
      <Skeleton className="h-36 rounded-[12px]" />
    </div>
  );
}
