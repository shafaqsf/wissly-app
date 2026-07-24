import { Bricolage_Grotesque, JetBrains_Mono, Newsreader } from "next/font/google";
// KaTeX ships its own stylesheet; formulae are routine in a learning tool,
// not an edge case, so it loads with the document.
import "katex/dist/katex.min.css";
import "./globals.css";

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
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
