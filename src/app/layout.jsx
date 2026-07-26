import { Bricolage_Grotesque, JetBrains_Mono, Newsreader } from "next/font/google";
// KaTeX ships its own stylesheet; formulae are routine in a learning tool,
// not an edge case, so it loads with the document.
import "katex/dist/katex.min.css";
import "./globals.css";
import { MARK } from "@/components/brand/brand-mark";
import SwRegister from "@/components/offline/sw-register";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "wissly",
  description: "An open source agentic learning platform.",
  // Declared rather than dropped into `app/` as `icon.png`, so the browser tab
  // and the agent read the same single file. The file convention would need a
  // second copy inside the route tree, and two copies of a mark drift.
  icons: { icon: MARK, apple: MARK },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full`}
    >
      {/* Extensions write their own attributes onto `<body>` before React
          hydrates, and React reports the difference as a mismatch we cannot
          fix from here. Everything inside stays checked. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
