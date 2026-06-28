import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Greeting } from "@/components/overview/greeting";
import { StatsRow } from "@/components/overview/stats-row";
import { ActionCards } from "@/components/overview/action-cards";
import { DataSources } from "@/components/overview/data-sources";

export default async function OverviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-full p-8">
      <Greeting />
      <StatsRow />
      <ActionCards />
      <DataSources />

      {/* bottom padding so last section isn't flush against viewport */}
      <div className="h-12" />
    </div>
  );
}