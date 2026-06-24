export type NodeType = "trigger" | "action" | "condition" | "output";

export interface WorkflowNodeData {
  label: string;
  description: string;
  icon: string;
  nodeType: NodeType;
  configured: boolean;
  config?: Record<string, string>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
}

// available trigger nodes
export const TRIGGER_NODES: Omit<WorkflowNodeData, "configured" | "config">[] = [
  {
    label: "New Video Recorded",
    description: "Fires when a user records a new video",
    icon: "🎥",
    nodeType: "trigger",
  },
  {
    label: "Video First Viewed",
    description: "Fires when someone watches for the first time",
    icon: "👁️",
    nodeType: "trigger",
  },
  {
    label: "Comment Posted",
    description: "Fires when a viewer leaves a comment",
    icon: "💬",
    nodeType: "trigger",
  },
  {
    label: "Schedule",
    description: "Fires on a recurring time schedule",
    icon: "⏰",
    nodeType: "trigger",
  },
];

// available action nodes
export const ACTION_NODES: Omit<WorkflowNodeData, "configured" | "config">[] = [
  {
    label: "Send Email",
    description: "Send an email notification",
    icon: "📧",
    nodeType: "action",
  },
  {
    label: "Send Slack Message",
    description: "Post a message to a Slack channel",
    icon: "💼",
    nodeType: "action",
  },
  {
    label: "Generate AI Summary",
    description: "Create an AI summary using Groq",
    icon: "🤖",
    nodeType: "action",
  },
  {
    label: "Create Transcript",
    description: "Transcribe video audio with Whisper",
    icon: "📝",
    nodeType: "action",
  },
  {
    label: "Update Video Title",
    description: "Rename the video automatically",
    icon: "✏️",
    nodeType: "action",
  },
  {
    label: "Move to Folder",
    description: "Organise video into a folder",
    icon: "📁",
    nodeType: "action",
  },
];

// available condition nodes
export const CONDITION_NODES: Omit<WorkflowNodeData, "configured" | "config">[] = [
  {
    label: "Check Video Length",
    description: "Branch based on duration",
    icon: "⏱️",
    nodeType: "condition",
  },
  {
    label: "Check Plan",
    description: "Branch based on Free vs Pro",
    icon: "💳",
    nodeType: "condition",
  },
  {
    label: "Check Viewer Count",
    description: "Branch on number of views",
    icon: "📊",
    nodeType: "condition",
  },
];

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "auto-notify",
    name: "Auto-notify on first view",
    description: "Send yourself an email when someone watches your video",
    nodes: [
      {
        id: "1",
        type: "workflowNode",
        position: { x: 250, y: 80 },
        data: {
          label: "Video First Viewed",
          description: "Fires when someone watches for the first time",
          icon: "👁️",
          nodeType: "trigger",
          configured: true,
        },
      },
      {
        id: "2",
        type: "workflowNode",
        position: { x: 250, y: 240 },
        data: {
          label: "Send Email",
          description: "Send an email notification",
          icon: "📧",
          nodeType: "action",
          configured: false,
        },
      },
    ],
    edges: [
      {
        id: "e1-2",
        source: "1",
        target: "2",
        type: "smoothstep",
        animated: true,
      },
    ],
  },
  {
    id: "auto-transcribe",
    name: "Auto-transcribe on record",
    description: "Transcribe and summarise every new recording automatically",
    nodes: [
      {
        id: "1",
        type: "workflowNode",
        position: { x: 250, y: 80 },
        data: {
          label: "New Video Recorded",
          description: "Fires when a user records a new video",
          icon: "🎥",
          nodeType: "trigger",
          configured: true,
        },
      },
      {
        id: "2",
        type: "workflowNode",
        position: { x: 250, y: 240 },
        data: {
          label: "Create Transcript",
          description: "Transcribe video audio with Whisper",
          icon: "📝",
          nodeType: "action",
          configured: true,
        },
      },
      {
        id: "3",
        type: "workflowNode",
        position: { x: 250, y: 400 },
        data: {
          label: "Generate AI Summary",
          description: "Create an AI summary using Groq",
          icon: "🤖",
          nodeType: "action",
          configured: true,
        },
      },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2", type: "smoothstep", animated: true },
      { id: "e2-3", source: "2", target: "3", type: "smoothstep", animated: true },
    ],
  },
];