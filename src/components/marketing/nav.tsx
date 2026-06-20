import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Nav() {
  return (
    <header className="mx-auto flex max-x-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          <span className="text-white ml-10">E</span>
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            cho
          </span>
        </h1>
      </Link>

      <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
        <Link
          href="#features"
          className="transition-colors hover:text-foreground"
        >
          Product
        </Link>
        <Link
          href="#pricing"
          className="transition-colors hover:text-foreground"
        >
          Pricing
        </Link>
        <Link href="#" className="transition-colors hover:text-foreground">
          Changelog
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sign-in">Log in</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/sign-up">Start for free</Link>
        </Button>
      </div>
    </header>
  );
}
