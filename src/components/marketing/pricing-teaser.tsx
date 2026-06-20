import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For trying things out",
    features: ["5-minute max length", "25 videos", "Basic sharing"],
    cta: "Start for free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    description: "For individuals and freelancers",
    features: [
      "Unlimited length",
      "Unlimited videos",
      "AI transcripts & summaries",
      "No Echo branding",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$10",
    period: "/user/mo",
    description: "For teams of 3+",
    features: [
      "Everything in Pro",
      "Shared workspaces",
      "Admin roles",
      "Priority support",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Simple pricing, no surprises
        </h2>
        <p className="mt-4 text-muted-foreground">
          Start free. Upgrade only when you actually need to.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={
              plan.highlighted
                ? "border-primary bg-card shadow-lg shadow-primary/10"
                : "border-border bg-card"
            }
          >
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">
                  {plan.period}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description}
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6 w-full"
                variant={plan.highlighted ? "default" : "outline"}
              >
                <Link href="/sign-up">{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}