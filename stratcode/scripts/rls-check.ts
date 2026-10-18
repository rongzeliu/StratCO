import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";

// Local security verification script proving database RLS and column grants work.
// Never imported by the Next.js app.
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Ignore if .env.local is not present (e.g., env vars already set in shell)
}

const CHALLENGE_1_ID = "11111111-1111-4111-8111-111111111111";

function createAnonBrowserLikeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

type TestResult = {
  name: string;
  passed: boolean;
  detail: string;
};

async function ensureTestUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  password: string
) {
  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    throw new Error(`Failed to list users: ${listErr.message}`);
  }
  const existing = listData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    return existing.id;
  }
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(
      `Failed to create test user ${email}: ${createErr?.message ?? "unknown"}`
    );
  }
  return created.user.id;
}

async function main() {
  const emailA = process.env.TEST_USER_A_EMAIL || "rls-user-a@stratcode.local";
  const passwordA = process.env.TEST_USER_A_PASSWORD || "StratCodeRlsTest123!";
  const emailB = process.env.TEST_USER_B_EMAIL || "rls-user-b@stratcode.local";
  const passwordB = process.env.TEST_USER_B_PASSWORD || "StratCodeRlsTest123!";

  const clientA = createAnonBrowserLikeClient();
  const clientB = createAnonBrowserLikeClient();
  const admin = createAdminClient();

  if (!process.env.TEST_USER_A_EMAIL || !process.env.TEST_USER_B_EMAIL) {
    await ensureTestUser(admin, emailA, passwordA);
    await ensureTestUser(admin, emailB, passwordB);
  }

  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: emailA,
    password: passwordA,
  });
  if (errA || !authA.user) {
    console.error(`Failed to sign in as Test User A: ${errA?.message ?? "unknown"}`);
    process.exit(1);
  }

  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: emailB,
    password: passwordB,
  });
  if (errB || !authB.user) {
    console.error(`Failed to sign in as Test User B: ${errB?.message ?? "unknown"}`);
    process.exit(1);
  }

  const userAId = authA.user.id;
  const userBId = authB.user.id;

  // Ensure both User A and User B have a draft submission row on Challenge 1 so tests 6-10 have real target IDs.
  async function ensureDraftSubmission(
    client: ReturnType<typeof createAnonBrowserLikeClient>,
    userId: string
  ): Promise<string> {
    const { data: existing } = await admin
      .from("submissions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("challenge_id", CHALLENGE_1_ID)
      .maybeSingle();

    if (existing) {
      if (existing.status !== "draft") {
        await admin
          .from("submissions")
          .update({ status: "draft" })
          .eq("id", existing.id);
      }
      return existing.id;
    }

    const { data: inserted, error: insErr } = await client
      .from("submissions")
      .insert({
        challenge_id: CHALLENGE_1_ID,
        stage1: [{ id: "n1", text: "Test branch", children: [] }],
        stage2: { q1_margin: 20 },
        stage3: "Test draft memo",
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      throw new Error(
        `Could not create draft submission for test user: ${insErr?.message ?? "unknown"}`
      );
    }
    return inserted.id;
  }

  const subAId = await ensureDraftSubmission(clientA, userAId);
  const subBId = await ensureDraftSubmission(clientB, userBId);

  const results: TestResult[] = [];

  function record(name: string, passed: boolean, detail: string) {
    results.push({ name, passed, detail });
    console.log(`${passed ? "PASS" : "FAIL"} — ${name} (${detail})`);
  }

  // 1. select baseline from challenges
  {
    const { data, error } = await clientA.from("challenges").select("baseline");
    const blocked = Boolean(error) || !data || data.length === 0;
    record(
      "1. select baseline from challenges",
      blocked,
      error ? error.message : `rows=${data?.length ?? 0}`
    );
  }

  // 2. select rubric_structure from challenges
  {
    const { data, error } = await clientA
      .from("challenges")
      .select("rubric_structure");
    const blocked = Boolean(error) || !data || data.length === 0;
    record(
      "2. select rubric_structure from challenges",
      blocked,
      error ? error.message : `rows=${data?.length ?? 0}`
    );
  }

  // 3. select rubric_memo from challenges
  {
    const { data, error } = await clientA
      .from("challenges")
      .select("rubric_memo");
    const blocked = Boolean(error) || !data || data.length === 0;
    record(
      "3. select rubric_memo from challenges",
      blocked,
      error ? error.message : `rows=${data?.length ?? 0}`
    );
  }

  // 4. select * from challenge_answers (intentional test of forbidden table read)
  {
    const { data, error } = await clientA
      .from("challenge_answers")
      .select("challenge_id, answers");
    const blocked = Boolean(error) || !data || data.length === 0;
    record(
      "4. select from challenge_answers",
      blocked,
      error ? error.message : `rows=${data?.length ?? 0}`
    );
  }

  // 5. update profiles set role='founder' where id = A
  {
    const { data, error } = await clientA
      .from("profiles")
      .update({ role: "founder" })
      .eq("id", userAId)
      .select("id, role");
    const { data: verifyProfile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", userAId)
      .single();
    const blocked =
      (Boolean(error) || !data || data.length === 0) &&
      verifyProfile?.role !== "founder";
    record(
      "5. update profiles set role='founder' where id = A",
      blocked,
      error ? error.message : `role=${verifyProfile?.role ?? "unknown"}`
    );
  }

  // 6. update submissions set status='graded' on A's own submission
  {
    const { data, error } = await clientA
      .from("submissions")
      .update({ status: "graded" })
      .eq("id", subAId)
      .select("id, status");
    const { data: verifySub } = await admin
      .from("submissions")
      .select("id, status")
      .eq("id", subAId)
      .single();
    const blocked =
      (Boolean(error) || !data || data.length === 0) &&
      verifySub?.status === "draft";
    record(
      "6. update submissions set status='graded' on A's own submission",
      blocked,
      error ? error.message : `status=${verifySub?.status ?? "unknown"}`
    );
  }

  // 7. update submissions set scores = {...} on A's own submission
  {
    const fakeScores = { stage1: 10, stage2: 10, stage3: 10, total: 100 };
    const { data, error } = await clientA
      .from("submissions")
      .update({ scores: fakeScores })
      .eq("id", subAId)
      .select("id, scores");
    const { data: verifySub } = await admin
      .from("submissions")
      .select("id, scores")
      .eq("id", subAId)
      .single();
    const blocked =
      (Boolean(error) || !data || data.length === 0) &&
      verifySub?.scores === null;
    record(
      "7. update submissions set scores = {...} on A's own submission",
      blocked,
      error ? error.message : `scores=${JSON.stringify(verifySub?.scores)}`
    );
  }

  // 8. select B's submission row
  {
    const { data, error } = await clientA
      .from("submissions")
      .select("id, stage1, stage2, stage3, status")
      .eq("id", subBId);
    const blocked = Boolean(error) || !data || data.length === 0;
    record(
      "8. select B's submission row",
      blocked,
      error ? error.message : `rows=${data?.length ?? 0}`
    );
  }

  // 9. update B's submission
  {
    const { data, error } = await clientA
      .from("submissions")
      .update({ stage3: "Tampered by A" })
      .eq("id", subBId)
      .select("id");
    const { data: verifySubB } = await admin
      .from("submissions")
      .select("id, stage3")
      .eq("id", subBId)
      .single();
    const blocked =
      (Boolean(error) || !data || data.length === 0) &&
      verifySubB?.stage3 !== "Tampered by A";
    record(
      "9. update B's submission",
      blocked,
      error ? error.message : `updatedRows=${data?.length ?? 0}`
    );
  }

  // 10. insert into vouches (any submission)
  {
    const { data, error } = await clientA
      .from("vouches")
      .insert({
        submission_id: subBId,
        outcome_note: "Solver A trying to vouch without founder role.",
      })
      .select("id");
    const blocked = Boolean(error) || !data || data.length === 0;
    record(
      "10. insert into vouches (as solver A)",
      blocked,
      error ? error.message : `insertedRows=${data?.length ?? 0}`
    );
  }

  // 11. Positive control: select id, title, brief_md from challenges returns >= 1 row
  {
    const { data, error } = await clientA
      .from("challenges")
      .select("id, title, brief_md");
    const succeeded = !error && Array.isArray(data) && data.length >= 1;
    record(
      "11. Positive control: select id, title, brief_md from challenges",
      succeeded,
      error ? error.message : `rows=${data?.length ?? 0}`
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  console.log(
    `\nSummary: ${passedCount}/${results.length} passed, ${failedCount} failed.`
  );

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
