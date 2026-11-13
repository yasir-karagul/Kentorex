import "./globals.css";
import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "./providers";
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });
export const metadata: Metadata = {
  title: { default: "waypoint — Project handbook", template: "%s · waypoint" },
  description: "A thoughtful home for the systems, decisions, and details behind every project you build.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
