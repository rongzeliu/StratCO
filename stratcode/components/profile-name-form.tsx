"use client";

import { useActionState } from "react";
import {
  updateDisplayName,
  type ProfileUpdateState,
} from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileNameForm({
  initialDisplayName,
}: {
  initialDisplayName: string;
}) {
  const [state, formAction, pending] = useActionState<
    ProfileUpdateState,
    FormData
  >(updateDisplayName, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="display_name">Display name (2–30 characters)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="display_name"
            name="display_name"
            defaultValue={initialDisplayName}
            minLength={2}
            maxLength={30}
            required
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-xs text-muted-foreground">
          Display name updated.
        </p>
      )}
    </form>
  );
}
