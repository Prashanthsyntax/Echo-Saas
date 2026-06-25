import { Metadata } from "next";
export const metadata: Metadata = { title: "Workflows" };
import { WorkflowCanvas } from "@/components/workflows/workflow-canvas";


export default function WorkflowsPage() {
  return (
    <div className="h-full overflow-hidden">
      <WorkflowCanvas />
    </div>
  );
}