import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { Chatbot } from "@/components/shared/chatbot";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "../../public/fonts/Inter-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Inter-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/Inter-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/Inter-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Echo • ARK Groups",
  description:
    "Record your screen, share an instant link, and let your team watch on their own time. No meetings required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "hsl(263, 70%, 58%)",
          colorBackground: "hsl(240, 8%, 9%)",
          borderRadius: "0.625rem",
          fontFamily: "inherit",
        },
        elements: {
          card: "bg-zinc-900 text-white border border-zinc-800",
          formFieldInput: "bg-zinc-800 text-white border-zinc-700",
          footerActionLink: "text-violet-400",
          formButtonPrimary: "bg-violet-600 hover:bg-violet-500",
        },
      }}
    >
      <html lang="en" className={cn("dark", inter.variable)}>
        <body className="bg-background text-foreground antialiased font-sans">
          {children}
          <Chatbot />
        </body>
      </html>
    </ClerkProvider>
  );
}
