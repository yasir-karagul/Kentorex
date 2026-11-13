"use client";

import { FormEvent, useCallback, useState } from "react";
import { TurnstileWidget } from "./turnstile-widget";

type ApiResult = { error?: string; message?: string; retryAfterSeconds?: number };

export function ResendVerificationForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const onToken = useCallback((value: string) => setToken(value), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    if (!token) {
      setError("Complete the security check before continuing.");
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token }),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok) {
        const retry = result.retryAfterSeconds
          ? ` Try again in ${result.retryAfterSeconds} seconds.`
          : "";
        setError(`${result.error ?? "Could not resend the email."}${retry}`);
        return;
      }
      setFeedback(result.message ?? "If that address has an unverified account, a verification email has been sent.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setToken("");
      setResetKey((current) => current + 1);
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 rounded-2xl border border-line bg-panel p-4">
      <label className="block text-sm font-medium">
        Email address
        <input
          required
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3.5 py-3 font-normal shadow-sm shadow-ink/[0.02]"
        />
      </label>
      <p className="text-xs leading-5 text-muted">For security, verification emails are limited to one per minute and five per day.</p>
      <TurnstileWidget key={resetKey} onToken={onToken} resetKey={resetKey} action="resend" />
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {feedback && <p role="status" className="text-sm text-accent">{feedback}</p>}
      <button
        type="submit"
        disabled={isPending || !token}
        className="inline-flex w-full items-center justify-center rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-soft disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Resend verification email"}
      </button>
    </form>
  );
}
