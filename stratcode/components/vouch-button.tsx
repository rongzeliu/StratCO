"use client";

import { useState } from "react";
import { vouchForSubmission } from "@/app/founder/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MIN_NOTE = 10;
const MAX_NOTE = 500;

export function VouchButton({
  submissionId,
  initialVouched,
}: {
  submissionId: string;
  initialVouched: boolean;
}) {
  const [vouched, setVouched] = useState(initialVouched);
  const [alreadyVouchedMessage, setAlreadyVouchedMessage] =
    useState(initialVouched);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLength = note.trim().length;
  const isValidLength = trimmedLength >= MIN_NOTE && trimmedLength <= MAX_NOTE;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidLength || submitting || vouched) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await vouchForSubmission(submissionId, note);
      if (!result.ok) {
        setError(result.error ?? "Could not record vouch.");
        return;
      }

      setVouched(true);
      if (result.alreadyVouched) {
        setAlreadyVouchedMessage(true);
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not record vouch.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {vouched && <Badge variant="secondary">Vouched</Badge>}
        <Button
          type="button"
          size="sm"
          variant={vouched ? "secondary" : "default"}
          disabled={vouched}
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
        >
          {vouched
            ? alreadyVouchedMessage
              ? "Already vouched"
              : "Vouched"
            : "Verify and vouch"}
        </Button>
      </div>

      {dialogOpen && !vouched && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`vouch-title-${submissionId}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
        >
          <div className="dialog-surface w-full max-w-[440px] rounded-[12px] border border-border bg-card p-6 text-left">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3
                  id={`vouch-title-${submissionId}`}
                  className="text-section-title"
                >
                  Verify and vouch
                </h3>
                <p className="text-secondary">
                  Describe what you implemented or plan to implement and the
                  expected outcome ({MIN_NOTE}–{MAX_NOTE} characters).
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`vouch-note-${submissionId}`}>
                  Outcome note
                </Label>
                <Textarea
                  id={`vouch-note-${submissionId}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                  maxLength={MAX_NOTE}
                  rows={4}
                  placeholder="What did you implement or plan to implement, and what result do you expect or see?"
                  required
                />
                <span className="self-end text-caption tabular">
                  {trimmedLength} / {MAX_NOTE}
                </span>
              </div>

              {error && (
                <p role="alert" className="text-secondary text-destructive">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!isValidLength || submitting}
                >
                  {submitting ? "Submitting…" : "Submit vouch"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
