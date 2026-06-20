import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, MessageSquare, FolderTree } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant, no editing needed",
    description:
      "Hit record, talk, done. Your video uploads while you're still talking — no export, no waiting around.",
  },
  {
    icon: MessageSquare,
    title: "Timestamped comments",
    description:
      "Viewers can drop a comment at the exact moment that matters. Click it, and the video jumps right there.",
  },
  {
    icon: FolderTree,
    title: "Organized by default",
    description:
      "Folders, workspaces, and search built in from day one — your team's videos won't turn into a junk drawer.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Built for how teams actually work
        </h2>
        <p className="mt-4 text-muted-foreground">
          Less synchronous, more async. Less performative, more real.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="border-border bg-card">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="mt-4 text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}