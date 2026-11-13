"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useState } from "react";
import { ArrowRight, KeyRound, Layers3 } from "lucide-react";
import { ResendVerificationForm } from "./resend-verification-form";
import { TurnstileWidget } from "./turnstile-widget";

type AuthResult = {
  error?: string | { fieldErrors?: Record<string, string[]> };
  code?: string;
  message?: string;
  accountCreated?: boolean;
};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deliveryWarning, setDeliveryWarning] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const isRegister = mode === "register";
  const onCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNeedsVerification(false);
    if (isRegister && !captchaToken) {
      setError("Complete the security check before creating your account.");
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(isRegister ? { name, turnstileToken: captchaToken } : {}),
          email,
          password,
        }),
      });
      const result = await response.json() as AuthResult;
      if (!response.ok) {
        const message = typeof result.error === "string"
          ? result.error
          : Object.values(result.error?.fieldErrors ?? {}).flat()[0] ?? "Please check your details and try again.";
        if (isRegister && result.accountCreated) {
          setRegistrationComplete(true);
          setNotice(message);
          setDeliveryWarning(true);
          return;
        }
        setError(message);
        if (result.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
        return;
      }
      if (isRegister) {
        setNotice(result.message ?? "Check your inbox for a verification link before signing in.");
        setRegistrationComplete(true);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      if (isRegister) {
        setCaptchaToken("");
        setCaptchaResetKey((current) => current + 1);
      }
      setIsPending(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#234c3a] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div aria-hidden className="absolute -right-36 -top-32 size-[520px] rounded-full border border-white/10" />
        <div aria-hidden className="absolute -right-20 -top-16 size-[380px] rounded-full border border-white/10" />
        <div aria-hidden className="absolute -bottom-48 -left-36 size-[500px] rounded-full border border-white/10" />
        <Link href="/login" className="relative inline-flex w-fit items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/10"><Layers3 className="size-5" /></span>
          <span className="font-display text-2xl font-semibold tracking-tight">waypoint</span>
        </Link>
        <div className="relative max-w-xl pb-8">
          <span className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/65"><span className="h-px w-5 bg-[#e6a180]" /> A little more clarity</span>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-[-0.04em] xl:text-6xl">Build with the whole picture in view.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/70">A considered home for the systems, decisions, and details behind the work you care about.</p>
        </div>
        <p className="relative font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Your project handbook</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[430px]">
          <Link href="/login" className="mb-12 inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-white"><Layers3 className="size-4" /></span>
            waypoint
          </Link>
          <div className="mb-8">
            <span className="mb-4 grid size-11 place-items-center rounded-2xl bg-soft text-accent"><KeyRound className="size-5" /></span>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {registrationComplete ? "One more step" : isRegister ? "Start your workspace" : "Welcome back"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {registrationComplete ? "Check your inbox" : isRegister ? "Create your account" : "Sign in to waypoint"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {registrationComplete
                ? "Verify your email address before signing in."
                : isRegister
                  ? "Your account can create and manage its own projects and documentation."
                  : "Pick up where your project left off."}
            </p>
          </div>

          {registrationComplete ? (
            <>
              <div role={deliveryWarning ? "alert" : "status"} className={`rounded-xl border px-3.5 py-3 text-sm leading-6 ${deliveryWarning ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-panel text-ink"}`}>
                {notice}
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                Open the link in your inbox to verify your address. Verification links are handled securely by Firebase and return you here.
              </p>
              <ResendVerificationForm initialEmail={email} />
              <p className="mt-6 text-center text-sm text-muted">
                Already verified?{" "}
                <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <form onSubmit={submit} className="space-y-4">
                {isRegister && (
                  <label className="block text-sm font-medium">
                    Name
                    <input required autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3.5 py-3 font-normal shadow-sm shadow-ink/[0.02] placeholder:text-muted/70" placeholder="Your name" />
                  </label>
                )}
                <label className="block text-sm font-medium">
                  Email
                  <input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3.5 py-3 font-normal shadow-sm shadow-ink/[0.02] placeholder:text-muted/70" placeholder="you@example.com" />
                </label>
                <label className="block text-sm font-medium">
                  Password
                  <input required type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3.5 py-3 font-normal shadow-sm shadow-ink/[0.02] placeholder:text-muted/70" placeholder={isRegister ? "At least 12 characters" : "Your password"} />
                  {isRegister && <span className="mt-1.5 block text-xs font-normal text-muted">Use at least 12 characters.</span>}
                </label>
                {isRegister && <TurnstileWidget key={captchaResetKey} onToken={onCaptchaToken} resetKey={captchaResetKey} action="register" />}
                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">{error}</p>}
                <button type="submit" disabled={isPending || (isRegister && !captchaToken)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#214e3c] disabled:cursor-wait disabled:opacity-60">
                  {isPending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
                  {!isPending && <ArrowRight className="size-4" />}
                </button>
              </form>
              {needsVerification && <ResendVerificationForm initialEmail={email} />}
              <p className="mt-6 text-center text-sm text-muted">
                {isRegister ? "Already have an account?" : "New to waypoint?"}{" "}
                <Link href={isRegister ? "/login" : "/register"} className="font-medium text-accent hover:underline">{isRegister ? "Sign in" : "Create an account"}</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
