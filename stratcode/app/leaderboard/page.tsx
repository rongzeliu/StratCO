import { Suspense } from "react";
import { loadLeaderboardData } from "@/lib/leaderboard";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    return "—";
  }
  const rounded = Math.round(delta * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}`;
}

export default function LeaderboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-6 py-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-page-title">Leaderboard</h1>
            <p className="text-secondary">
              Ranked graded submissions compared against the AI baseline.
            </p>
          </div>

          <Suspense fallback={<LeaderboardSkeleton />}>
            <LeaderboardContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function LeaderboardContent() {
  const boards = await loadLeaderboardData();

  if (boards.length === 0) {
    return <p className="text-secondary">No challenges available.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {boards.map((board) => (
        <Card key={board.challengeId}>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>{board.challengeTitle}</CardTitle>
              <CardDescription className="tabular">
                {board.rows.length}{" "}
                {board.rows.length === 1 ? "graded solver" : "graded solvers"}
              </CardDescription>
            </div>

            {board.currentUserPercentile !== null && (
              <Badge variant="secondary" className="tabular">
                Better than {board.currentUserPercentile}% of solvers
              </Badge>
            )}
          </CardHeader>

          <CardContent>
            {board.rows.length === 0 ? (
              <p className="text-secondary">No graded submissions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Solver</TableHead>
                    <TableHead className="text-right">Total score</TableHead>
                    <TableHead className="text-right">vs AI baseline</TableHead>
                    <TableHead className="text-right">Vouches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.rows.map((row) => (
                    <TableRow
                      key={row.rank}
                      className={
                        row.isCurrentUser
                          ? "bg-secondary font-medium"
                          : undefined
                      }
                    >
                      <TableCell className="tabular text-muted-foreground">
                        {row.rank}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.displayName}</span>
                          {row.isCurrentUser && (
                            <Badge variant="secondary">You</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {row.totalScore} / 100
                      </TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">
                        {formatDelta(row.baselineDelta)}
                      </TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">
                        {row.vouchCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-64 rounded-[12px]" />
    </div>
  );
}
