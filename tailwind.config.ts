import type { Config } from "tailwindcss";
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { bg: c("bg"), panel: c("panel"), ink: c("ink"), muted: c("muted"), line: c("line"), accent: c("accent"), mark: c("mark") },
    fontFamily: { display: ["var(--font-display)", "sans-serif"], sans: ["var(--font-body)", "system-ui", "sans-serif"], mono: ["var(--font-mono)", "monospace"] },
  } },
  plugins: [],
};
export default config;
