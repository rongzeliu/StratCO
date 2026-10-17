"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfileUpdateState =
  | { ok?: boolean; error?: string }
  | undefined;

const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(30, "Display name cannot exceed 30 characters.");

export async function updateDisplayName(
  _prev: ProfileUpdateState,
  formData: FormData
): Promise<ProfileUpdateState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in." };
  }

  const rawName = formData.get("display_name");
  const parsed = DisplayNameSchema.safeParse(rawName);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid display name.",
    };
  }

  // Use the admin client to update ONLY profiles.display_name where id equals
  // the authenticated user's id (clients cannot write profiles directly).
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("id", user.id);

  if (updateError) {
    return { error: "Could not update display name." };
  }

  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  revalidatePath("/founder");
  return { ok: true };
}
