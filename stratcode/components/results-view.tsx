import type { Stage2Question } from "@/lib/challenges";
import type {
  StageQualitativeFeedback,
  SubmissionDraft,
  SubmissionScores,
} from "@/lib/submissions";
import { ResultsChart, type StageScoreBarDatum } from "@/components/results-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) {
    return "no baseline yet";
  }
  const rounded = Math.round(delta * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} vs AI baseline`;
}

export function ResultsView({
  submission,
  questions,
  baselineScores,
}: {
  submission: SubmissionDraft;
  questions: Stage2Question[];
  baselineScores: SubmissionScores | null;
}) {
  const scores = submission.scores;
  const feedback = submission.feedback;
  const total = scores?.total ?? 0;
  const deltaText = formatDelta(submission.baseline_delta);

  const hasBaseline = baselineScores !== null;
  const chartData: StageScoreBarDatum[] = [
    {
      stage: "Issue tree",
      you: scores?.stage1 ?? 0,
      ...(hasBaseline ? { baseline: baselineScores.stage1 } : {}),
    },
    {
      stage: "Numbers",
      you: scores?.stage2 ?? 0,
      ...(hasBaseline ? { baseline: baselineScores.stage2 } : {}),
    },
    {
      stage: "Memo",
      you: scores?.stage3 ?? 0,
      ...(hasBaseline ? { baseline: baselineScores.stage3 } : {}),
    },
  ];

  const perQuestionMap = new Map(
    (feedback?.stage2?.perQuestion ?? []).map((q) => [q.id, q.correct])
  );

  const founderSummary =
    feedback?.founder_summary ??
    feedback?.stage3?.founder_summary ??
    null;

  return (
    <div className="flex flex-col gap-6">
      {/* Headline + Stage Comparison Bar Chart */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">
              Total Score:{" "}
              <span className="font-mono tabular-nums">{total}</span> / 100
            </CardTitle>
            <CardDescription>
               Weighted: 3× Issue tree ({scores?.stage1 ?? 0}/10) + 3× Numbers (
              {scores?.stage2 ?? 0}/10) + 4× Memo ({scores?.stage3 ?? 0}/10)
            </CardDescription>
          </div>
          <Badge
            variant={
              submission.baseline_delta !== null && submission.baseline_delta > 0
                ? "default"
                : "secondary"
            }
            className="font-mono"
          >
            {deltaText}
          </Badge>
        </CardHeader>
        <CardContent>
          <ResultsChart data={chartData} hasBaseline={hasBaseline} />
        </CardContent>
      </Card>

      {/* What a founder will see */}
      {founderSummary && (
        <Card>
          <CardHeader>
            <CardTitle>What a founder will see</CardTitle>
            <CardDescription>
              Executive summary shown on the founder review dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{founderSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Stage 2 table: Correct / Incorrect badges only, never correct values */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stage 2: Numeric answers</CardTitle>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {scores?.stage2 ?? 0} / 10
            </span>
          </div>
          <CardDescription>
            Deterministic grading against the reference dataset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead className="text-right">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) => {
                const isCorrect = perQuestionMap.get(q.id) === true;
                return (
                  <TableRow key={q.id}>
                    <TableCell>{q.label}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={isCorrect ? "default" : "destructive"}
                      >
                        {isCorrect ? "Correct" : "Incorrect"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stage 1 & Stage 3 qualitative feedback */}
      <div className="grid gap-6 lg:grid-cols-2">
        <StageFeedbackCard
          title="Stage 1: Issue tree"
          score={scores?.stage1 ?? null}
          stageFeedback={feedback?.stage1 ?? null}
        />
        <StageFeedbackCard
          title="Stage 3: Recommendation memo"
          score={scores?.stage3 ?? null}
          stageFeedback={feedback?.stage3 ?? null}
        />
      </div>
    </div>
  );
}

function StageFeedbackCard({
  title,
  score,
  stageFeedback,
}: {
  title: string;
  score: number | null;
  stageFeedback: StageQualitativeFeedback | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {score !== null && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {score} / 10
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {!stageFeedback ? (
          <p className="text-muted-foreground">
            Detailed feedback is not available for this stage.
          </p>
        ) : (
          <>
            <BulletSection
              heading="Strengths"
              items={stageFeedback.strengths}
              emptyText="No specific strengths noted."
            />
            <BulletSection
              heading="Gaps"
              items={stageFeedback.gaps}
              emptyText="No major gaps noted."
            />
            <BulletSection
              heading="Beyond the AI baseline"
              items={stageFeedback.beyond_baseline}
              emptyText="No additional points beyond the AI baseline noted."
            />

            {stageFeedback.criteria.length > 0 && (
              <details className="group rounded-lg border bg-muted/30 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium select-none">
                  Per-criterion evidence ({stageFeedback.criteria.length})
                </summary>
                <div className="mt-3 flex flex-col gap-2.5 border-t pt-2.5">
                  {stageFeedback.criteria.map((c) => (
                    <div key={c.id} className="flex flex-col gap-0.5 text-xs">
                      <div className="flex items-center justify-between font-medium">
                        <span className="font-mono">{c.id}</span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {Math.round(c.score * 100)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {c.evidence}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BulletSection({
  heading,
  items,
  emptyText,
}: {
  heading: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {heading}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
