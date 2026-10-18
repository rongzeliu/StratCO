"use client";

import { useActionState, useState } from "react";
import { authenticate, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    authenticate,
    undefined
  );

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailInvalid =
    emailTouched &&
    email.trim().length > 0 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const passwordInvalid =
    passwordTouched && password.length > 0 && password.length < 6;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-caption">StratCode</p>
        <h1 className="text-page-title">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
      </div>

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="intent" value={mode} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            aria-invalid={emailInvalid || undefined}
            required
          />
          {emailInvalid && (
            <p role="alert" className="text-caption text-destructive">
              Enter a valid email address.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPasswordTouched(true)}
            aria-invalid={passwordInvalid || undefined}
            minLength={6}
            required
          />
          {passwordInvalid && (
            <p role="alert" className="text-caption text-destructive">
              Password must be at least 6 characters.
            </p>
          )}
        </div>

        {state?.error && (
          <p role="alert" className="text-secondary text-destructive">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p role="status" className="text-secondary">
            {state.message}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            className="w-full"
            disabled={pending || emailInvalid || passwordInvalid}
          >
            {pending
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>

          <button
            type="button"
            onClick={() =>
              setMode((prev) => (prev === "signin" ? "signup" : "signin"))
            }
            className="pressable focus-ring self-center rounded-[10px] py-1 text-sm text-primary hover:underline"
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
