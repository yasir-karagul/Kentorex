"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";

export function ScrollEdgeButton() {
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const updatePosition = () => {
      const { scrollHeight } = document.documentElement;
      setAtBottom(
        scrollHeight > window.innerHeight &&
        window.scrollY + window.innerHeight >= scrollHeight - 80,
      );
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, []);

  function scrollToOtherEdge() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const currentlyAtBottom = maxScroll > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80;
    window.scrollTo({ top: currentlyAtBottom ? 0 : maxScroll, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      onClick={scrollToOtherEdge}
      aria-label={atBottom ? "Scroll to top" : "Scroll to bottom"}
      title={atBottom ? "Scroll to top" : "Scroll to bottom"}
      className="fixed bottom-5 right-5 z-20 grid size-11 place-items-center rounded-full border border-white/70 bg-accent text-white shadow-[0_8px_24px_rgba(30,60,44,0.22)] transition hover:-translate-y-0.5 hover:bg-[#214e3c] focus-visible:outline-offset-4"
    >
      {atBottom ? <ArrowUpToLine className="size-5" /> : <ArrowDownToLine className="size-5" />}
    </button>
  );
}
