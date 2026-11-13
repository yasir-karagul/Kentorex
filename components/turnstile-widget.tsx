"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
    theme: "light" | "dark" | "auto";
    action: "register" | "resend";
  }) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  onToken,
  resetKey,
  action,
}: {
  onToken: (token: string) => void;
  resetKey: number;
  action: "register" | "resend";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!scriptReady || !siteKey || !window.turnstile || !containerRef.current) return;
    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
      theme: "auto",
      action,
    });
    return () => {
      window.turnstile?.remove(widgetId);
      onToken("");
    };
  }, [action, onToken, resetKey, scriptReady, siteKey]);

  return (
    <div className="space-y-2">
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onError={() => setScriptFailed(true)}
        />
      )}
      {siteKey
        ? <div ref={containerRef} aria-label="Security check" />
        : <p role="alert" className="text-sm text-rose-700">The security check is not configured.</p>}
      {scriptFailed && <p role="alert" className="text-sm text-rose-700">The security check could not load. Check your connection and try again.</p>}
    </div>
  );
}
