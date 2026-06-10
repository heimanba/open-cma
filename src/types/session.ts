export interface SessionBindings {
  agent_id: string;
  agent_version?: number;
  environment_id: string;
  vault_ids: string[];
  memory_store_ids: string[];
  title?: string;
  metadata?: Record<string, string>;
}

export interface SessionInfo {
  id: string;
  agent_id: string;
  environment_id: string;
  status: string;
  title?: string;
  vault_ids: string[];
  memory_store_ids: string[];
  created_at: string;
  updated_at: string;
  attributes: Record<string, unknown>;
}

export interface SessionFilter {
  agent_id?: string;
  limit?: number;
}

export interface SessionListResult {
  sessions: SessionInfo[];
  has_more: boolean;
}
