import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Echo — Async video messaging for teams",
  description:
    "Record your screen, share an instant link, and let your team watch on their own time. No meetings required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", inter.variable)}>
      <body className="bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}