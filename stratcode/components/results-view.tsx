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
    return "No baseline yet";
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
    <div className="flex flex-col gap-8">
      {/* Headline + Stage Comparison Bar Chart */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>
              Total score: <span className="tabular">{total} / 100</span>
            </CardTitle>
            <CardDescription className="tabular">
              3 × Issue tree ({scores?.stage1 ?? 0}/10) + 3 × Numbers (
              {scores?.stage2 ?? 0}/10) + 4 × Memo ({scores?.stage3 ?? 0}/10)
            </CardDescription>
          </div>
          <Badge variant="secondary" className="tabular">
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
              Summary shown on the founder dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="max-w-[65ch] text-body">{founderSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Stage 2 table: Correct / Incorrect text labels only, never correct values */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stage 2: Numeric answers</CardTitle>
            <span className="text-caption tabular">
              {scores?.stage2 ?? 0} / 10
            </span>
          </div>
          <CardDescription>
            Graded against the reference dataset
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
                      <span
                        className={
                          isCorrect
                            ? "text-sm font-medium text-success"
                            : "text-sm font-medium text-destructive"
                        }
                      >
                        {isCorrect ? "Correct" : "Incorrect"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stage 1 & Stage 3 qualitative feedback */}
      <div className="grid gap-8 lg:grid-cols-2">
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
            <span className="text-caption tabular">{score} / 10</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!stageFeedback ? (
          <p className="text-secondary">
            Detailed feedback is not available for this stage.
          </p>
        ) : (
          <>
            <BulletSection
              heading="Strengths"
              items={stageFeedback.strengths}
              emptyText="No strengths noted."
            />
            <BulletSection
              heading="Gaps"
              items={stageFeedback.gaps}
              emptyText="No gaps noted."
            />
            <BulletSection
              heading="Beyond the AI baseline"
              items={stageFeedback.beyond_baseline}
              emptyText="No additional points beyond the AI baseline noted."
            />

            {stageFeedback.criteria.length > 0 && (
              <details className="rounded-[10px] border border-border px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Per-criterion evidence ({stageFeedback.criteria.length})
                </summary>
                <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                  {stageFeedback.criteria.map((c) => (
                    <div key={c.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{c.id}</span>
                        <span className="text-caption tabular">
                          {Math.round(c.score * 100)}%
                        </span>
                      </div>
                      <p className="text-secondary">{c.evidence}</p>
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
      <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
      {items.length === 0 ? (
        <p className="text-secondary">{emptyText}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-secondary">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
