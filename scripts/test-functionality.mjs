import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(path, patterns) {
  const content = read(path);
  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      throw new Error(`${path} is missing expected guard: ${pattern}`);
    }
  }
}

const checks = [
  [
    "src/app/api/rag/ingest/route.ts",
    ["requireWorkspacePermission", '"INGEST_DOCUMENTS"', "ragNamespace"],
  ],
  [
    "src/app/api/rag/documents/route.ts",
    ["requireWorkspaceMembership", "requireWorkspacePermission", '"DELETE_DOCUMENTS"'],
  ],
  [
    "src/app/api/rag/query/route.ts",
    ["requireWorkspacePermission", '"QUERY_KNOWLEDGE"', "ragNamespace"],
  ],
  [
    "src/app/api/chat/session/message/route.ts",
    ["authorizeSession", "requireWorkspaceMembership", "Invalid message role"],
  ],
  [
    "src/app/api/presence/route.ts",
    ["requireWorkspaceMembership", "presenceSession.upsert"],
  ],
  [
    "src/app/api/overview/stats/route.ts",
    ["requireWorkspaceMembership", "workspaceFilter"],
  ],
  [
    "src/app/api/videos/[videoId]/route.ts",
    ["requireVideoPermission", '"VIEW_VIDEO"', '"DELETE_VIDEO"'],
  ],
  [
    "src/app/api/videos/[videoId]/comments/route.ts",
    ["requireVideoPermission", '"COMMENT_VIDEO"'],
  ],
  [
    "src/app/api/upload/route.ts",
    ["workspaceId", '"UPLOAD_VIDEO"', "userId: access.user.id"],
  ],
  [
    "src/app/api/billing/checkout/route.ts",
    ["workspaceId required", "requireWorkspacePermission", '"UPDATE_SETTINGS"'],
  ],
  [
    "src/app/api/billing/portal/route.ts",
    ["workspaceId required", "requireWorkspacePermission", '"UPDATE_SETTINGS"'],
  ],
  [
    "src/app/api/workspaces/[workspaceId]/members/route.ts",
    ["requireWorkspacePermission", '"REMOVE_MEMBER"', "outranks"],
  ],
  [
    "src/app/api/workspaces/[workspaceId]/invite/route.ts",
    ["validInviteRoles", "outranks", "Invalid invite role"],
  ],
  [
    "src/app/api/workspace/[workspaceId]/route.ts",
    ["requireWorkspacePermission", '"RENAME_WORKSPACE"'],
  ],
  [
    "src/app/api/canvas/state/route.ts",
    ['"CLEAR_CANVAS"'],
  ],
  [
    "src/hooks/use-recorder.ts",
    ["useWorkspace", "workspaceId", "startTimer(true)", "reset = false"],
  ],
  [
    "src/components/dashboard/workspace-manager.tsx",
    ["Failed to remove member", "Failed to change role", "if (!res.ok)"],
  ],
  [
    "src/components/dashboard/billing-client.tsx",
    ["useWorkspace", "activeIsPro", "JSON.stringify({ workspaceId })"],
  ],
];

for (const [path, patterns] of checks) {
  assertContains(path, patterns);
}

console.log(`Functionality guard checks passed (${checks.length} files).`);
