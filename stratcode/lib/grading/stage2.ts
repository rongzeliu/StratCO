import "server-only";
import type { ChallengeAnswerItem, Stage2Answers } from "./schemas";

export type Stage2QuestionResult = {
  id: string;
  correct: boolean;
};

export type Stage2ScoreResult = {
  perQuestion: Stage2QuestionResult[];
  score: number;
};

// Deterministic Stage 2 grader.
// A question is correct if the submitted value is a finite number and
// Math.abs(submitted - value) <= tolerance (ABSOLUTE tolerance).
// Never returns the answer key values.
export function scoreStage2(
  submitted: Stage2Answers,
  answers: ChallengeAnswerItem[]
): Stage2ScoreResult {
  const total = answers.length;
  if (total === 0) {
    return { perQuestion: [], score: 0 };
  }

  let correctCount = 0;
  const perQuestion: Stage2QuestionResult[] = answers.map((ans) => {
    const val = submitted[ans.id];
    const isCorrect =
      typeof val === "number" &&
      Number.isFinite(val) &&
      Math.abs(val - ans.value) <= ans.tolerance;

    if (isCorrect) {
      correctCount += 1;
    }

    return {
      id: ans.id,
      correct: isCorrect,
    };
  });

  const rawScore = (10 * correctCount) / total;
  const score = Math.round(rawScore * 100) / 100;

  return { perQuestion, score };
}
