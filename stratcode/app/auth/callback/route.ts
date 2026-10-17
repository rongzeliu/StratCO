import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of the sign-up confirmation email link. Exchanges the one-time code
// for a session cookie, then sends the user into the app.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/challenges", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
