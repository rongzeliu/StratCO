import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Only these columns are readable by client roles (see 001_init.sql column
// grants). Never select *, and never touch baseline / rubric_* / challenge_answers.
const LIST_COLUMNS = "id, title, brief_md";
const DETAIL_COLUMNS = "id, title, brief_md, csv_url, stage2_questions";

export type ChallengeSummary = { id: string; title: string; brief_md: string };

const Stage2QuestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.string(),
});
export type Stage2Question = z.infer<typeof Stage2QuestionSchema>;

export type ChallengeDetail = ChallengeSummary & {
  csv_url: string | null;
  stage2_questions: Stage2Question[];
};

export async function listChallenges(): Promise<ChallengeSummary[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("challenges")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load challenges: ${error.message}`);
  }
  return data ?? [];
}

export async function getChallenge(id: string): Promise<ChallengeDetail> {
  await requireUser();

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load challenge: ${error.message}`);
  }
  if (!data) {
    notFound();
  }

  const questions = z.array(Stage2QuestionSchema).safeParse(data.stage2_questions);

  return {
    id: data.id,
    title: data.title,
    brief_md: data.brief_md,
    csv_url: data.csv_url,
    stage2_questions: questions.success ? questions.data : [],
  };
}

// Plain-text preview of a markdown brief for the list view.
export function briefExcerpt(md: string, maxLength = 180): string {
  const text = md
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .join(" ")
    .replace(/[>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}
