"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type VouchActionResult = {
  ok: boolean;
  alreadyVouched?: boolean;
  error?: string;
};

const VouchInputSchema = z.object({
  submissionId: z.uuid("Invalid submission ID."),
  outcomeNote: z
    .string()
    .trim()
    .min(10, "Outcome note must be at least 10 characters.")
    .max(500, "Outcome note cannot exceed 500 characters."),
});

export async function vouchForSubmission(
  submissionId: string,
  outcomeNote: string
): Promise<VouchActionResult> {
  const parsed = VouchInputSchema.safeParse({ submissionId, outcomeNote });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid outcome note.",
    };
  }

  // Insert into vouches (submission_id, outcome_note) using the NORMAL cookie-based
  // client so row-level security (founder role, graded submissions only) is enforced
  // by the database. Do NOT send founder_id (the database default sets it).
  const supabase = await createClient();
  const { error } = await supabase.from("vouches").insert({
    submission_id: parsed.data.submissionId,
    outcome_note: parsed.data.outcomeNote,
  });

  if (error) {
    // 23505 is PostgreSQL unique_violation (unique (submission_id, founder_id))
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { ok: true, alreadyVouched: true };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/founder");
  return { ok: true };
}
