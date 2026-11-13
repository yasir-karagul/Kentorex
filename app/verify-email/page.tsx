import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-line bg-panel p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-soft text-accent">
          <MailCheck className="size-6" />
        </span>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Email verification</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Return to waypoint</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          If you just completed the verification link, your email is ready. Sign in to continue; waypoint checks verification with Firebase before granting access.
        </p>
        <Link href="/login" className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#214e3c]">
          Go to sign in <ArrowRight className="size-4" />
        </Link>
      </section>
    </main>
  );
}
