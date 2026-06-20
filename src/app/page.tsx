import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-[380px]">
        <CardHeader>
          <CardTitle>Echo theme check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button>Primary button</Button>
          <Button variant="secondary">Secondary button</Button>
          <Button variant="outline">Outline button</Button>
        </CardContent>
      </Card>
    </main>
  );
}