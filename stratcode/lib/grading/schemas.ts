import "server-only";
import { z } from "zod";

export const MAX_TREE_DEPTH = 4;
export const MAX_TREE_NODES = 40;
export const MAX_NODE_CHARS = 200;
export const MAX_MEMO_CHARS = 4000;

export type Stage1Node = {
  id: string;
  text: string;
  children: Stage1Node[];
};

const Stage1NodeBaseSchema: z.ZodType<Stage1Node> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    text: z.string().trim().min(1).max(MAX_NODE_CHARS),
    children: z.array(Stage1NodeBaseSchema),
  })
);

function getMaxDepth(nodes: Stage1Node[], currentDepth = 1): number {
  if (nodes.length === 0) return 0;
  let max = currentDepth;
  for (const node of nodes) {
    if (node.children.length > 0) {
      max = Math.max(max, getMaxDepth(node.children, currentDepth + 1));
    }
  }
  return max;
}

export function countTreeNodes(nodes: Stage1Node[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countTreeNodes(node.children);
  }
  return count;
}

export const Stage1TreeSchema = z
  .array(Stage1NodeBaseSchema)
  .superRefine((nodes, ctx) => {
    const total = countTreeNodes(nodes);
    if (total > MAX_TREE_NODES) {
      ctx.addIssue({
        code: "custom",
        message: `Issue tree cannot exceed ${MAX_TREE_NODES} nodes (got ${total}).`,
      });
    }
    const depth = getMaxDepth(nodes);
    if (depth > MAX_TREE_DEPTH) {
      ctx.addIssue({
        code: "custom",
        message: `Issue tree depth cannot exceed ${MAX_TREE_DEPTH} levels (got ${depth}).`,
      });
    }
  });

export type Stage1Tree = z.infer<typeof Stage1TreeSchema>;

export const Stage2AnswersSchema = z.record(
  z.string(),
  z.number().finite().nullable()
);

export type Stage2Answers = z.infer<typeof Stage2AnswersSchema>;

export const Stage3MemoSchema = z.string().max(MAX_MEMO_CHARS);

export type Stage3Memo = z.infer<typeof Stage3MemoSchema>;

export const CriterionGradeSchema = z.object({
  id: z.string().min(1),
  score: z.number(),
  evidence: z.string().min(1),
});

export type CriterionGrade = z.infer<typeof CriterionGradeSchema>;

export const StageGradeSchema = z.object({
  criteria: z.array(CriterionGradeSchema),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  beyond_baseline: z.array(z.string()),
  founder_summary: z.string(),
});

export type StageGrade = z.infer<typeof StageGradeSchema>;

export type GradedStageResult = StageGrade & {
  score: number;
};

export const RubricCriterionSchema = z.object({
  id: z.string().min(1),
  weight: z.number().positive(),
  check: z.string().min(1),
});

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const RubricStructureSchema = z.object({
  max_score: z.number().optional(),
  criteria: z.array(RubricCriterionSchema).min(1),
  known_drivers: z.array(z.string()).optional(),
  common_failures: z.array(z.string()).optional(),
});

export type RubricStructure = z.infer<typeof RubricStructureSchema>;

export const RubricMemoSchema = z.object({
  max_score: z.number().optional(),
  criteria: z.array(RubricCriterionSchema).min(1),
  reference_facts: z.record(z.string(), z.unknown()).optional(),
});

export type RubricMemo = z.infer<typeof RubricMemoSchema>;

export const ChallengeAnswerItemSchema = z.object({
  id: z.string().min(1),
  value: z.number().finite(),
  tolerance: z.number().nonnegative(),
});

export type ChallengeAnswerItem = z.infer<typeof ChallengeAnswerItemSchema>;
