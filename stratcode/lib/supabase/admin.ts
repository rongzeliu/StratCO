import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only secret-key Supabase client (bypasses RLS).
// Never import this in a Client Component or in any file imported by a Client Component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
