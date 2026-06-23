"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Zap, ExternalLink } from "lucide-react";

const FREE_FEATURES = [
  "5-minute max video length",
  "25 videos total",
  "Basic sharing",
  "Comments on videos",
];

const PRO_FEATURES = [
  "Unlimited video length",
  "Unlimited videos",
  "AI transcripts & summaries",
  "No Echo branding on shared links",
  "Priority support",
];

interface BillingClientProps {
  isPro: boolean;
  subscription: {
    status: string;
    plan: string;
    currentPeriodEnd: Date | null;
  } | null;
  successMessage: boolean;
  canceledMessage: boolean;
}

export function BillingClient({
  isPro,
  subscription,
  successMessage,
  canceledMessage,
}: BillingClientProps) {
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleUpgrade = async () => {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handlePortal = async () => {
    setLoadingPortal(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* success/cancel banners */}
      {successMessage && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          🎉 You are now on Echo Pro. Enjoy unlimited recording.
        </div>
      )}
      {canceledMessage && (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          No changes were made to your subscription.
        </div>
      )}

      {/* current plan */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Current plan</CardTitle>
            <Badge
              variant={isPro ? "default" : "secondary"}
              className="text-xs"
            >
              {isPro ? "Pro" : "Free"}
            </Badge>
          </div>
          <CardDescription>
            {isPro
              ? `Your Pro subscription renews on ${
                  subscription?.currentPeriodEnd
                    ? new Date(
                        subscription.currentPeriodEnd
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"
                }`
              : "You're on the free plan"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(isPro ? PRO_FEATURES : FREE_FEATURES).map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>

          <Separator className="my-6" />

          {isPro ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Manage your payment method, view invoices, or cancel your
                subscription via the billing portal.
              </p>
              <Button
                variant="outline"
                onClick={handlePortal}
                disabled={loadingPortal}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {loadingPortal ? "Opening portal..." : "Manage billing"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro for unlimited recordings, AI transcripts, and
                no branding on shared links.
              </p>
              <Button
                onClick={handleUpgrade}
                disabled={loadingCheckout}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                {loadingCheckout
                  ? "Redirecting to checkout..."
                  : "Upgrade to Pro — $12/mo"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* plan comparison */}
      {!isPro && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <CardTitle className="text-base text-primary">
                What you get with Pro
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {PRO_FEATURES.map((feature) => (
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
              onClick={handleUpgrade}
              disabled={loadingCheckout}
              className="mt-6 w-full gap-2"
            >
              <Zap className="h-4 w-4" />
              {loadingCheckout ? "Redirecting..." : "Start Pro — $12/mo"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Cancel anytime · Billed monthly
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}