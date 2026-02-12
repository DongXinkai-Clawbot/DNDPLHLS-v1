export type User = { id: string; email: string; display_name?: string | null };

export type Project = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  current_snapshot_id: string | null;
};

export type SnapshotMeta = {
  id: string;
  created_at: number;
  created_by: string;
  note: string | null;
  payload_hash: string;
  size_bytes: number;
};

export type ProjectWithSnapshot = {
  project: Project;
  snapshot: (SnapshotMeta & { payload?: unknown }) | null;
};


export type ShareCreateRequest = {
  project_id: string;
  snapshot_id?: string;
  permission?: "view" | "fork";
  expires_in_days?: number;
};

export type ShareCreateResponse = {
  id: string;
  permission: "view" | "fork";
  token: string;
  url: string;
  expires_at: number | null;
};

export type ShareResolveResponse = {
  permission: "view" | "fork";
  project: { id: string; name: string };
  resolved_snapshot: { id: string; created_at: number; note: string | null };
  payload: unknown;
};

export type ShareForkResponse = {
  project_id: string;
  snapshot_id: string;
  name: string;
};
