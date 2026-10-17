import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AppHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/challenges" className="font-semibold tracking-tight">
            StratCode
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/challenges"
              className="transition-colors hover:text-foreground"
            >
              Challenges
            </Link>
            <Link
              href="/leaderboard"
              className="transition-colors hover:text-foreground"
            >
              Leaderboard
            </Link>
            <Link
              href="/profile"
              className="transition-colors hover:text-foreground"
            >
              Profile
            </Link>
          </nav>
        </div>
        <Suspense fallback={<Skeleton className="h-6 w-44" />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}

// Reads the session + profile role behind the Suspense boundary above.
async function UserMenu() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const isFounder = profile?.role === "founder";

  return (
    <div className="flex items-center gap-3">
      {isFounder && (
        <Link
          href="/founder"
          className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
        >
          Founder
        </Link>
      )}
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {user.email}
      </span>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
