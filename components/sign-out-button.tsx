"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signOut() {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        setError(result.error ?? "Could not sign out.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try signing out again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={signOut} disabled={pending} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted transition hover:bg-bg hover:text-ink disabled:opacity-50"><LogOut className="size-3.5" /> {pending ? "Signing out…" : "Sign out"}</button>
      {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
