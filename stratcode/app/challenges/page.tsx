import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { briefExcerpt, listChallenges } from "@/lib/challenges";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChallengesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-page-title">Challenges</h1>
        <p className="text-secondary">
          Select a business case to complete the issue tree, numeric questions,
          and recommendation memo.
        </p>
      </div>
      <Suspense fallback={<ChallengeListSkeleton />}>
        <ChallengeList />
      </Suspense>
    </div>
  );
}

async function ChallengeList() {
  const challenges = await listChallenges();

  if (challenges.length === 0) {
    return <p className="text-secondary">No challenges available.</p>;
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-[12px] border border-border bg-card">
      {challenges.map((c) => (
        <Link
          key={c.id}
          href={`/challenges/${c.id}`}
          className="pressable focus-ring flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-secondary"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-base font-semibold text-foreground">
              {c.title}
            </span>
            <p className="truncate text-secondary">
              {briefExcerpt(c.brief_md)}
            </p>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </Link>
      ))}
    </div>
  );
}

function ChallengeListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-18 w-full rounded-[12px]" />
      ))}
    </div>
  );
}
