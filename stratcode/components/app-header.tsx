import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HeaderShell,
  NavLinks,
  NavLinksFallback,
} from "@/components/nav-links";

export function AppHeader() {
  return (
    <HeaderShell>
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/challenges"
            className="pressable focus-ring rounded-[10px] font-semibold tracking-tight text-foreground"
          >
            StratCode
          </Link>
          <Suspense fallback={<NavLinksFallback />}>
            <FounderAwareNav />
          </Suspense>
        </div>
        <Suspense fallback={<Skeleton className="h-6 w-36" />}>
          <UserMenu />
        </Suspense>
      </div>
    </HeaderShell>
  );
}

async function getUserAndRole() {
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

  return { user, isFounder: profile?.role === "founder" };
}

async function FounderAwareNav() {
  const { isFounder } = await getUserAndRole();
  return <NavLinks showFounder={isFounder} />;
}

async function UserMenu() {
  const { user } = await getUserAndRole();

  return (
    <div className="flex items-center gap-4">
      <span className="hidden max-w-52 truncate text-secondary sm:inline">
        {user.email}
      </span>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" className="px-2">
          Sign out
        </Button>
      </form>
    </div>
  );
}
