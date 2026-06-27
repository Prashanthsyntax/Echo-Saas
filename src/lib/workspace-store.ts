let currentWorkspaceId: string | null = null;
const listeners: Array<(id: string | null) => void> = [];

export const workspaceStore = {
  get(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("echo_workspace_id") ?? currentWorkspaceId;
    }
    return currentWorkspaceId;
  },

  set(id: string | null) {
    currentWorkspaceId = id;
    if (typeof window !== "undefined" && id) {
      localStorage.setItem("echo_workspace_id", id);
    }
    listeners.forEach((fn) => fn(id));
  },

  subscribe(fn: (id: string | null) => void) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },
};