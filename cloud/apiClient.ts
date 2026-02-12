import type { Project, ProjectWithSnapshot, SnapshotMeta, User } from "./types";

export type ApiClientOptions = {
  baseUrl: string; // e.g. http://localhost:8787/v1
  getAccessToken: () => string | null;
  setAccessToken: (token: string | null) => void;
};

export function createApiClient(opts: ApiClientOptions) {
  const authFetch = async (path: string, init: RequestInit = {}) => {
    const token = opts.getAccessToken();
    const headers = new Headers(init.headers || {});
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${opts.baseUrl}${path}`, { ...init, headers, credentials: "include" });
    if (res.status === 401) {
      // try refresh once
      const refreshed = await fetch(`${opts.baseUrl}/auth/refresh`, { method: "POST", credentials: "include" });
      if (refreshed.ok) {
        const j = await refreshed.json();
        opts.setAccessToken(j.access_token);
        headers.set("Authorization", `Bearer ${j.access_token}`);
        const res2 = await fetch(`${opts.baseUrl}${path}`, { ...init, headers, credentials: "include" });
        return res2;
      }
    }
    return res;
  };

  return {
    async authStart(email: string) {
      const res = await fetch(`${opts.baseUrl}/auth/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "auth/start failed");
      return res.json() as Promise<{ ok: boolean; expiresAt: number }>;
    },

    async authVerify(email: string, magic_token: string) {
      const res = await fetch(`${opts.baseUrl}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, magic_token }),
        credentials: "include",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "auth/verify failed");
      opts.setAccessToken(j.access_token);
      return j as { ok: boolean; access_token: string; access_expires_at: number; user: User };
    },

    async logout() {
      await fetch(`${opts.baseUrl}/auth/logout`, { method: "POST", credentials: "include" });
      opts.setAccessToken(null);
    },

    async me() {
      const res = await authFetch("/me");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "me failed");
      return j as { user: User; plan: string; limits: any };
    },

    async createProject(name: string) {
      const res = await authFetch("/projects", { method: "POST", body: JSON.stringify({ name }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "createProject failed");
      return j as Project;
    },

    async listProjects() {
      const res = await authFetch("/projects");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "listProjects failed");
      return j.projects as Project[];
    },

    async getProject(id: string) {
      const res = await authFetch(`/projects/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "getProject failed");
      return j as ProjectWithSnapshot;
    },

    async saveSnapshot(projectId: string, payload: unknown, note?: string) {
      const res = await authFetch(`/projects/${projectId}/snapshots`, {
        method: "POST",
        body: JSON.stringify({ payload, note }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "saveSnapshot failed");
      return j as { ok: boolean; snapshot_id: string; created_at?: number; deduped?: boolean };
    },

    async listSnapshots(projectId: string, limit = 30) {
      const res = await authFetch(`/projects/${projectId}/snapshots?limit=${limit}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "listSnapshots failed");
      return j.snapshots as SnapshotMeta[];
    },


async createShare(req: import("./types").ShareCreateRequest) {
  const res = await authFetch(`/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "createShare failed");
  return j as import("./types").ShareCreateResponse;
},

// Public: no auth required
async resolveShare(token: string) {
  const res = await fetch(`${opts.baseUrl}/shares/${encodeURIComponent(token)}`, {
    method: "GET",
    credentials: "include",
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "resolveShare failed");
  return j as import("./types").ShareResolveResponse;
},

async forkShare(token: string) {
  const res = await authFetch(`/shares/${encodeURIComponent(token)}/fork`, { method: "POST" });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "forkShare failed");
  return j as import("./types").ShareForkResponse;
},
    async restoreSnapshot(projectId: string, snapshotId: string) {
      const res = await authFetch(`/projects/${projectId}/restore/${snapshotId}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "restoreSnapshot failed");
      return j as { ok: boolean; current_snapshot_id: string; updated_at: number };
    },
  };
}
