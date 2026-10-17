import Link from "next/link";
import { Suspense } from "react";
import { briefExcerpt, listChallenges } from "@/lib/challenges";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChallengesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="text-sm text-muted-foreground">
          Pick a business case to work on.
        </p>
      </div>
      <Suspense fallback={<ChallengeGridSkeleton />}>
        <ChallengeGrid />
      </Suspense>
    </div>
  );
}

async function ChallengeGrid() {
  const challenges = await listChallenges();

  if (challenges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No challenges yet.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {challenges.map((c) => (
        <Link
          key={c.id}
          href={`/challenges/${c.id}`}
          className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
              <CardDescription>{briefExcerpt(c.brief_md)}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ChallengeGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}
