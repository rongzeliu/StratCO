import { Suspense } from "react";
import {
  loadFounderDashboardData,
  type FounderSubmissionCard,
} from "@/lib/founder";
import { AppHeader } from "@/components/app-header";
import { VouchButton } from "@/components/vouch-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) {
    return "no baseline yet";
  }
  const rounded = Math.round(delta * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} vs AI baseline`;
}

export default function FounderPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Founder Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Review the top 3 graded submissions per challenge and vouch for
              solvers whose recommendations you verify.
            </p>
          </div>

          <Suspense fallback={<FounderDashboardSkeleton />}>
            <FounderDashboardContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function FounderDashboardContent() {
  const sections = await loadFounderDashboardData();

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No challenges found.</p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.challengeId} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              {section.challengeTitle}
            </h2>
            <span className="text-xs text-muted-foreground">
              Top {section.topSubmissions.length} graded
            </span>
          </div>

          {section.topSubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No graded submissions for this challenge yet.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {section.topSubmissions.map((sub) => (
                <SubmissionReviewCard key={sub.submissionId} sub={sub} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function SubmissionReviewCard({ sub }: { sub: FounderSubmissionCard }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              #{sub.rank}
            </Badge>
            <CardTitle>{sub.displayName}</CardTitle>
            <Badge variant="secondary" className="font-mono">
              {sub.scores.total} / 100
            </Badge>
            <Badge
              variant={
                sub.baselineDelta !== null && sub.baselineDelta > 0
                  ? "default"
                  : "outline"
              }
              className="font-mono"
            >
              {formatDelta(sub.baselineDelta)}
            </Badge>
          </div>
          <CardDescription className="font-mono text-xs">
            Stage 1 (Issue tree): {sub.scores.stage1}/10 · Stage 2 (Numbers):{" "}
            {sub.scores.stage2}/10 · Stage 3 (Memo): {sub.scores.stage3}/10
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-foreground/90">
          {sub.founderSummary ?? "No summary available for this submission."}
        </p>

        <VouchButton
          submissionId={sub.submissionId}
          initialVouched={sub.alreadyVouched}
        />
      </CardContent>
    </Card>
  );
}

function FounderDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}
