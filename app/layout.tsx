import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "kentorex — Project handbook", template: "%s · kentorex" },
  description: "A thoughtful home for the systems, decisions, and details behind every project you build.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
