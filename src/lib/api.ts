"use client";

// Workspace-aware fetch — automatically adds x-workspace-id header
// Use this instead of raw fetch() in all client components
export function createWorkspaceFetch(workspaceId: string | null) {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (workspaceId) {
      headers.set("x-workspace-id", workspaceId);
    }
    return fetch(url, { ...options, headers });
  };
}