import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

// The prototype's typefaces: Fredoka for headings, Nunito for text.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
});
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "GuessUp — Administrator Panel",
  description:
    "Question bank, categories, students, game sessions and reports for the GuessUp Android application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} ${nunito.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
