import Link from "next/link";

const footerLinks = {
  Product: ["Features", "Pricing", "Changelog", "Roadmap"],
  Company: ["About", "Blog", "Careers"],
  Resources: ["Help center", "Community", "Status"],
  Legal: ["Privacy", "Terms"],
};

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                  <span className="text-white">E</span>
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    cho
                  </span>
                </h1>
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Async video for teams whod rather not meet.
            </p>
          </div>

          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-sm font-medium">{heading}</h4>
              <ul className="mt-3 space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Echo. All rights reserved.</p>
          <p>Built with Next.js • ShadCN • Claude Code</p>
        </div>
      </div>
    </footer>
  );
}
