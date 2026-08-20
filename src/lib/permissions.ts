import type { Role } from "@prisma/client";

// Permission matrix — what each role can do
export const PERMISSIONS = {
  // Workspace management
  RENAME_WORKSPACE:   ["OWNER"] as Role[],
  DELETE_WORKSPACE:   ["OWNER"] as Role[],
  UPDATE_SETTINGS:    ["OWNER", "ADMIN"] as Role[],

  // Member management
  INVITE_MEMBER:      ["OWNER", "ADMIN"] as Role[],
  REMOVE_MEMBER:      ["OWNER", "ADMIN"] as Role[],
  CHANGE_ROLE:        ["OWNER", "ADMIN"] as Role[],
  VIEW_MEMBERS:       ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as Role[],

  // Content — Videos
  UPLOAD_VIDEO:       ["OWNER", "ADMIN", "EDITOR"] as Role[],
  DELETE_VIDEO:       ["OWNER", "ADMIN"] as Role[],
  VIEW_VIDEO:         ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as Role[],
  COMMENT_VIDEO:      ["OWNER", "ADMIN", "EDITOR"] as Role[],

  // Content — Canvas
  EDIT_CANVAS:        ["OWNER", "ADMIN", "EDITOR"] as Role[],
  VIEW_CANVAS:        ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as Role[],
  CLEAR_CANVAS:       ["OWNER", "ADMIN"] as Role[],

  // Content — Knowledge base
  INGEST_DOCUMENTS:   ["OWNER", "ADMIN", "EDITOR"] as Role[],
  DELETE_DOCUMENTS:   ["OWNER", "ADMIN"] as Role[],
  QUERY_KNOWLEDGE:    ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as Role[],

  // Content — Workflows
  CREATE_WORKFLOW:    ["OWNER", "ADMIN", "EDITOR"] as Role[],
  DELETE_WORKFLOW:    ["OWNER", "ADMIN"] as Role[],
  RUN_WORKFLOW:       ["OWNER", "ADMIN", "EDITOR"] as Role[],
  VIEW_WORKFLOW:      ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as Role[],

  // AI / Chat
  USE_CHAT:           ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as Role[],
  CONNECT_AGENTS:     ["OWNER", "ADMIN"] as Role[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Check if a role has a permission
export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

// Get all permissions for a role
export function getRolePermissions(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
    hasPermission(role, p)
  );
}

// Role hierarchy — higher = more permissions
export const ROLE_HIERARCHY: Record<Role, number> = {
    OWNER: 4,
    ADMIN: 3,
    EDITOR: 2,
    VIEWER: 1
};

// Check if roleA outranks roleB
export function outranks(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}

// Role badge colors for UI
export const ROLE_COLORS: Record<Role, string> = {
    OWNER: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    ADMIN: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    EDITOR: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    VIEWER: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
};

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
    OWNER: "Full control — manage members, settings, and all content",
    ADMIN: "Manage members and all content, cannot delete workspace",
    EDITOR: "Create and edit content, cannot manage members",
    VIEWER: "View-only access to all workspace content"
};
