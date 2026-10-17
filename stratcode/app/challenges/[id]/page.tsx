import { Suspense } from "react";
import { getChallenge } from "@/lib/challenges";
import {
  getChallengeBaselineScores,
  getMySubmission,
} from "@/lib/submissions";
import { Markdown } from "@/components/markdown";
import { DatasetTable } from "@/components/dataset-table";
import { ResultsView } from "@/components/results-view";
import { Workspace } from "@/components/workspace";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChallengePage({
  params,
}: PageProps<"/challenges/[id]">) {
  return (
    <Suspense fallback={<ChallengeSkeleton />}>
      <ChallengeView params={params} />
    </Suspense>
  );
}

async function ChallengeView({
  params,
}: {
  params: PageProps<"/challenges/[id]">["params"];
}) {
  const { id } = await params;
  const [challenge, submission] = await Promise.all([
    getChallenge(id),
    getMySubmission(id),
  ]);

  const baselineScores =
    submission?.status === "graded"
      ? await getChallengeBaselineScores(id)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {challenge.title}
      </h1>

      {submission?.status === "graded" && (
        <ResultsView
          submission={submission}
          questions={challenge.stage2_questions}
          baselineScores={baselineScores}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: brief */}
        <Card>
          <CardHeader>
            <CardTitle>Brief</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown>{challenge.brief_md}</Markdown>
          </CardContent>
        </Card>

        {/* Right: workspace + dataset */}
        <div className="flex flex-col gap-6">
          <Workspace
            challengeId={challenge.id}
            questions={challenge.stage2_questions}
            initialSubmission={submission}
          />

          <Card>
            <CardHeader>
              <CardTitle>Dataset</CardTitle>
              {challenge.csv_url && (
                <CardDescription>
                  {challenge.csv_url.split("/").pop()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {challenge.csv_url ? (
                <DatasetTable csvUrl={challenge.csv_url} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No dataset for this challenge.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChallengeSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
