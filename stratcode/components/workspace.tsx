"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CornerDownRight,
  Plus,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Stage2Question } from "@/lib/challenges";
import type {
  IssueTreeNode,
  Stage2Answers,
  SubmissionDraft,
} from "@/lib/submissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const MAX_DEPTH = 4;
const MAX_NODES = 40;
const MAX_NODE_CHARS = 200;
const MEMO_SOFT_WORDS = 300;
const MEMO_MAX_CHARS = 4000;

function newNodeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultTree(): IssueTreeNode[] {
  return [{ id: newNodeId(), text: "", children: [] }];
}

function countNodes(nodes: IssueTreeNode[]): number {
  let total = 0;
  for (const n of nodes) {
    total += 1 + countNodes(n.children);
  }
  return total;
}

// Depth of the deepest node within a subtree (single leaf = 1).
function subtreeHeight(node: IssueTreeNode): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(subtreeHeight));
}

function updateNodeText(
  nodes: IssueTreeNode[],
  id: string,
  text: string
): IssueTreeNode[] {
  return nodes.map((n) =>
    n.id === id
      ? { ...n, text }
      : { ...n, children: updateNodeText(n.children, id, text) }
  );
}

function addChildToNode(
  nodes: IssueTreeNode[],
  parentId: string,
  child: IssueTreeNode
): IssueTreeNode[] {
  return nodes.map((n) =>
    n.id === parentId
      ? { ...n, children: [...n.children, child] }
      : { ...n, children: addChildToNode(n.children, parentId, child) }
  );
}

function addSiblingAfterNode(
  nodes: IssueTreeNode[],
  targetId: string,
  sibling: IssueTreeNode
): IssueTreeNode[] {
  const idx = nodes.findIndex((n) => n.id === targetId);
  if (idx !== -1) {
    const next = [...nodes];
    next.splice(idx + 1, 0, sibling);
    return next;
  }
  return nodes.map((n) => ({
    ...n,
    children: addSiblingAfterNode(n.children, targetId, sibling),
  }));
}

function deleteNodeById(
  nodes: IssueTreeNode[],
  targetId: string
): IssueTreeNode[] {
  return nodes
    .filter((n) => n.id !== targetId)
    .map((n) => ({ ...n, children: deleteNodeById(n.children, targetId) }));
}

function canIndentNode(
  nodes: IssueTreeNode[],
  targetId: string,
  depth = 1
): boolean {
  const idx = nodes.findIndex((n) => n.id === targetId);
  if (idx !== -1) {
    if (idx === 0) return false;
    const node = nodes[idx];
    return depth + subtreeHeight(node) <= MAX_DEPTH;
  }
  return nodes.some((n) => canIndentNode(n.children, targetId, depth + 1));
}

function indentNodeById(
  nodes: IssueTreeNode[],
  targetId: string,
  depth = 1
): IssueTreeNode[] {
  const idx = nodes.findIndex((n) => n.id === targetId);
  if (idx !== -1) {
    if (idx === 0) return nodes;
    const node = nodes[idx];
    if (depth + subtreeHeight(node) > MAX_DEPTH) return nodes;
    const prev = nodes[idx - 1];
    const updatedPrev: IssueTreeNode = {
      ...prev,
      children: [...prev.children, node],
    };
    return [
      ...nodes.slice(0, idx - 1),
      updatedPrev,
      ...nodes.slice(idx + 1),
    ];
  }
  return nodes.map((n) => ({
    ...n,
    children: indentNodeById(n.children, targetId, depth + 1),
  }));
}

function canOutdentNode(
  nodes: IssueTreeNode[],
  targetId: string,
  depth = 1
): boolean {
  if (nodes.some((n) => n.id === targetId)) {
    return depth > 1;
  }
  return nodes.some((n) => canOutdentNode(n.children, targetId, depth + 1));
}

function outdentNodeById(
  nodes: IssueTreeNode[],
  targetId: string
): IssueTreeNode[] {
  for (let i = 0; i < nodes.length; i++) {
    const parent = nodes[i];
    const childIdx = parent.children.findIndex((c) => c.id === targetId);
    if (childIdx !== -1) {
      const child = parent.children[childIdx];
      const updatedParent: IssueTreeNode = {
        ...parent,
        children: parent.children.filter((_, idx) => idx !== childIdx),
      };
      const next = [...nodes];
      next.splice(i, 1, updatedParent, child);
      return next;
    }
  }
  return nodes.map((n) => ({
    ...n,
    children: outdentNodeById(n.children, targetId),
  }));
}

function buildInitialStage2(
  questions: Stage2Question[],
  saved: Stage2Answers | null
): Stage2Answers {
  const result: Stage2Answers = {};
  for (const q of questions) {
    const val = saved?.[q.id];
    result[q.id] = typeof val === "number" && Number.isFinite(val) ? val : null;
  }
  return result;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const VALID_NUMBER_INPUT = /^-?\d*(\.\d*)?$/;

export function Workspace({
  challengeId,
  questions,
  initialSubmission,
}: {
  challengeId: string;
  questions: Stage2Question[];
  initialSubmission: SubmissionDraft | null;
}) {
  const router = useRouter();

  const [submissionId, setSubmissionId] = useState<string | null>(
    initialSubmission?.id ?? null
  );
  const [status, setStatus] = useState<string>(
    initialSubmission?.status ?? "draft"
  );
  const [gradedTotal, setGradedTotal] = useState<number | null>(
    initialSubmission?.scores?.total ?? null
  );
  const isLocked = status !== "draft";

  const [stage1, setStage1] = useState<IssueTreeNode[]>(() =>
    initialSubmission?.stage1 && initialSubmission.stage1.length > 0
      ? initialSubmission.stage1
      : defaultTree()
  );

  const [stage2, setStage2] = useState<Stage2Answers>(() =>
    buildInitialStage2(questions, initialSubmission?.stage2 ?? null)
  );

  // Raw string state for Stage 2 inputs so typing "-", "12.", or "-0.5" works smoothly
  const [stage2Raw, setStage2Raw] = useState<Record<string, string>>(() => {
    const initial = buildInitialStage2(
      questions,
      initialSubmission?.stage2 ?? null
    );
    const raw: Record<string, string> = {};
    for (const q of questions) {
      raw[q.id] = initial[q.id] === null ? "" : String(initial[q.id]);
    }
    return raw;
  });

  const [stage3, setStage3] = useState<string>(
    () => initialSubmission?.stage3 ?? ""
  );

  const serialize = (
    s1: IssueTreeNode[],
    s2: Stage2Answers,
    s3: string
  ): string => JSON.stringify({ s1, s2, s3 });

  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    initialSubmission
      ? serialize(
          initialSubmission.stage1 && initialSubmission.stage1.length > 0
            ? initialSubmission.stage1
            : stage1,
          buildInitialStage2(questions, initialSubmission.stage2),
          initialSubmission.stage3 ?? ""
        )
      : ""
  );

  const currentSnapshot = useMemo(
    () => serialize(stage1, stage2, stage3),
    [stage1, stage2, stage3]
  );

  const isSaved = savedSnapshot !== "" && currentSnapshot === savedSnapshot;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalNodes = useMemo(() => countNodes(stage1), [stage1]);
  const wordCount = useMemo(() => countWords(stage3), [stage3]);

  async function saveDraftToDatabase(): Promise<string | null> {
    const supabase = createClient();

    if (!submissionId) {
      // INSERT with ONLY challenge_id, stage1, stage2, stage3.
      // Never send user_id or status; the DB defaults set them.
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          challenge_id: challengeId,
          stage1,
          stage2,
          stage3,
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message);
      }
      setSubmissionId(data.id);
      setSavedSnapshot(currentSnapshot);
      return data.id;
    } else {
      // UPDATE with ONLY stage1, stage2, stage3 filtered by id.
      const { error } = await supabase
        .from("submissions")
        .update({
          stage1,
          stage2,
          stage3,
        })
        .eq("id", submissionId);

      if (error) {
        throw new Error(error.message);
      }
      setSavedSnapshot(currentSnapshot);
      return submissionId;
    }
  }

  async function handleSaveDraft() {
    if (isLocked || saving || submitting) return;
    setSaving(true);
    setSaveError(null);
    setSubmitError(null);

    try {
      await saveDraftToDatabase();
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save draft."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmSubmit() {
    if (isLocked || submitting) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setSaveError(null);
    setSubmitError(null);

    try {
      // Ensure latest draft changes are persisted before calling the submit route.
      const idToSubmit = await saveDraftToDatabase();
      if (!idToSubmit) {
        throw new Error("Could not save draft before submitting.");
      }

      const res = await fetch(`/api/submissions/${idToSubmit}/submit`, {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        scores?: { total?: number };
      };

      if (!res.ok) {
        setSubmitError(
          payload.error ?? `Submission failed (HTTP ${res.status}).`
        );
        return;
      }

      setStatus(payload.status ?? "graded");
      if (typeof payload.scores?.total === "number") {
        setGradedTotal(payload.scores.total);
      }
      router.refresh();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit for grading."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleStage2Change(questionId: string, rawValue: string) {
    if (isLocked) return;
    const trimmed = rawValue.trim();
    if (trimmed !== "" && !VALID_NUMBER_INPUT.test(trimmed)) {
      // Reject non-numeric characters
      return;
    }
    setStage2Raw((prev) => ({ ...prev, [questionId]: trimmed }));

    if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
      setStage2((prev) => ({ ...prev, [questionId]: null }));
      return;
    }

    const num = Number(trimmed);
    if (Number.isFinite(num)) {
      setStage2((prev) => ({ ...prev, [questionId]: num }));
    }
  }

  function handleStage2Blur(questionId: string) {
    const val = stage2[questionId];
    setStage2Raw((prev) => ({
      ...prev,
      [questionId]: val === null || val === undefined ? "" : String(val),
    }));
  }

  const badgeLabel =
    status === "graded"
      ? "Graded"
      : status === "draft"
        ? "Draft"
        : status;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CardTitle>Your workspace</CardTitle>
            <Badge variant={status === "graded" ? "default" : isLocked ? "outline" : "secondary"}>
              {badgeLabel}
            </Badge>
          </div>
          <CardDescription>
            {status === "graded" && gradedTotal !== null
              ? `Graded — Total score: ${gradedTotal} / 100`
              : isLocked
                ? `This submission is ${status} and locked for editing.`
                : isSaved
                  ? "Saved"
                  : "Unsaved changes"}
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isLocked || saving || submitting}
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={status !== "draft" || saving || submitting}
          >
            {submitting ? "Grading…" : "Submit"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {confirmOpen && status === "draft" && !submitting && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-submit-title"
            className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4"
          >
            <div className="flex flex-col gap-1">
              <p id="confirm-submit-title" className="text-sm font-medium">
                Submit for grading?
              </p>
              <p className="text-xs text-muted-foreground">
                You cannot edit after submitting. Your draft will be saved and
                graded across all three stages.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmSubmit}
              >
                Confirm &amp; submit
              </Button>
            </div>
          </div>
        )}

        {submitting && (
          <p
            role="status"
            className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
          >
            Grading your submission… This takes up to a minute. Please keep this
            tab open.
          </p>
        )}

        {status === "graded" && (
          <div
            role="status"
            className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2 text-xs"
          >
            <span className="text-muted-foreground">
              Submission graded and locked.
            </span>
            {gradedTotal !== null && (
              <span className="font-mono font-semibold tabular-nums">
                Total score: {gradedTotal} / 100
              </span>
            )}
          </div>
        )}

        {isLocked && status !== "graded" && (
          <p
            role="status"
            className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
          >
            This submission is locked because its status is{" "}
            <span className="font-medium text-foreground">{status}</span>. All
            stages are read-only.
          </p>
        )}

        {saveError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            Could not save draft: {saveError}
          </p>
        )}

        {submitError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {submitError}
          </p>
        )}

        <Tabs defaultValue="stage1" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="stage1">1. Issue tree</TabsTrigger>
            <TabsTrigger value="stage2">2. Numeric answers</TabsTrigger>
            <TabsTrigger value="stage3">3. Memo</TabsTrigger>
          </TabsList>

          {/* STAGE 1: Issue tree */}
          <TabsContent value="stage1" className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Break the problem into MECE branches (max depth {MAX_DEPTH}, max{" "}
                {MAX_NODE_CHARS} chars/node).
              </span>
              <span className="font-mono tabular-nums">
                {totalNodes}/{MAX_NODES} nodes
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {stage1.map((node, index) => (
                <IssueTreeBranch
                  key={node.id}
                  node={node}
                  depth={1}
                  siblingIndex={index}
                  totalNodes={totalNodes}
                  rootTree={stage1}
                  isLocked={isLocked}
                  onChangeText={(id, text) =>
                    setStage1((prev) =>
                      updateNodeText(prev, id, text.slice(0, MAX_NODE_CHARS))
                    )
                  }
                  onAddChild={(parentId) =>
                    setStage1((prev) => {
                      if (countNodes(prev) >= MAX_NODES) return prev;
                      return addChildToNode(prev, parentId, {
                        id: newNodeId(),
                        text: "",
                        children: [],
                      });
                    })
                  }
                  onAddSibling={(targetId) =>
                    setStage1((prev) => {
                      if (countNodes(prev) >= MAX_NODES) return prev;
                      return addSiblingAfterNode(prev, targetId, {
                        id: newNodeId(),
                        text: "",
                        children: [],
                      });
                    })
                  }
                  onDelete={(targetId) =>
                    setStage1((prev) => {
                      const next = deleteNodeById(prev, targetId);
                      return next.length > 0 ? next : defaultTree();
                    })
                  }
                  onIndent={(targetId) =>
                    setStage1((prev) => indentNodeById(prev, targetId))
                  }
                  onOutdent={(targetId) =>
                    setStage1((prev) => outdentNodeById(prev, targetId))
                  }
                />
              ))}
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isLocked || totalNodes >= MAX_NODES}
                onClick={() =>
                  setStage1((prev) =>
                    countNodes(prev) >= MAX_NODES
                      ? prev
                      : [...prev, { id: newNodeId(), text: "", children: [] }]
                  )
                }
              >
                <Plus />
                Add root branch
              </Button>
            </div>
          </TabsContent>

          {/* STAGE 2: Numeric answers */}
          <TabsContent value="stage2" className="flex flex-col gap-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Enter numeric values only. Leave blank if unanswered.
            </p>
            <div className="flex flex-col gap-3">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="grid items-center gap-2 sm:grid-cols-[1fr_180px]"
                >
                  <Label htmlFor={`q-${q.id}`} className="text-sm">
                    {q.label}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`q-${q.id}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="—"
                      value={stage2Raw[q.id] ?? ""}
                      onChange={(e) =>
                        handleStage2Change(q.id, e.target.value)
                      }
                      onBlur={() => handleStage2Blur(q.id)}
                      readOnly={isLocked}
                      disabled={isLocked}
                      className="text-right font-mono tabular-nums"
                    />
                    <span className="w-8 shrink-0 text-xs text-muted-foreground">
                      {q.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* STAGE 3: Recommendation memo */}
          <TabsContent value="stage3" className="flex flex-col gap-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span
                className={
                  wordCount > MEMO_SOFT_WORDS
                    ? "font-medium text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                }
              >
                {wordCount} / {MEMO_SOFT_WORDS} words
                {wordCount > MEMO_SOFT_WORDS
                  ? " — over the 300-word soft limit; consider tightening."
                  : ""}
              </span>
              <span className="font-mono text-muted-foreground tabular-nums">
                {stage3.length}/{MEMO_MAX_CHARS} chars
              </span>
            </div>

            <Textarea
              value={stage3}
              onChange={(e) =>
                setStage3(e.target.value.slice(0, MEMO_MAX_CHARS))
              }
              maxLength={MEMO_MAX_CHARS}
              readOnly={isLocked}
              disabled={isLocked}
              rows={10}
              placeholder="Start with your conclusion and recommendation, then support it with numbers from Stage 2, key risks, and a measurable next step…"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function IssueTreeBranch({
  node,
  depth,
  siblingIndex,
  totalNodes,
  rootTree,
  isLocked,
  onChangeText,
  onAddChild,
  onAddSibling,
  onDelete,
  onIndent,
  onOutdent,
}: {
  node: IssueTreeNode;
  depth: number;
  siblingIndex: number;
  totalNodes: number;
  rootTree: IssueTreeNode[];
  isLocked: boolean;
  onChangeText: (id: string, text: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (targetId: string) => void;
  onDelete: (targetId: string) => void;
  onIndent: (targetId: string) => void;
  onOutdent: (targetId: string) => void;
}) {
  const canAddMore = !isLocked && totalNodes < MAX_NODES;
  const canAddChild = canAddMore && depth < MAX_DEPTH;
  const canIndent =
    !isLocked && siblingIndex > 0 && canIndentNode(rootTree, node.id);
  const canOutdent = !isLocked && depth > 1 && canOutdentNode(rootTree, node.id);
  const canDelete = !isLocked && totalNodes > 1;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
          L{depth}
        </span>
        <Input
          value={node.text}
          maxLength={MAX_NODE_CHARS}
          placeholder={
            depth === 1
              ? "Top-level branch (e.g. Price, Mix, Unit cost)…"
              : "Sub-branch or testable hypothesis…"
          }
          onChange={(e) => onChangeText(node.id, e.target.value)}
          readOnly={isLocked}
          disabled={isLocked}
          className="flex-1"
        />
        <span className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
          {node.text.length}/{MAX_NODE_CHARS}
        </span>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Add sibling"
            aria-label="Add sibling"
            disabled={!canAddMore}
            onClick={() => onAddSibling(node.id)}
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Add child"
            aria-label="Add child"
            disabled={!canAddChild}
            onClick={() => onAddChild(node.id)}
          >
            <CornerDownRight />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Indent"
            aria-label="Indent"
            disabled={!canIndent}
            onClick={() => onIndent(node.id)}
          >
            <ArrowRight />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Outdent"
            aria-label="Outdent"
            disabled={!canOutdent}
            onClick={() => onOutdent(node.id)}
          >
            <ArrowLeft />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Delete node"
            aria-label="Delete node"
            disabled={!canDelete}
            onClick={() => onDelete(node.id)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {node.children.length > 0 && (
        <div className="ml-4 flex flex-col gap-1.5 border-l pl-3">
          {node.children.map((child, idx) => (
            <IssueTreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              siblingIndex={idx}
              totalNodes={totalNodes}
              rootTree={rootTree}
              isLocked={isLocked}
              onChangeText={onChangeText}
              onAddChild={onAddChild}
              onAddSibling={onAddSibling}
              onDelete={onDelete}
              onIndent={onIndent}
              onOutdent={onOutdent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
