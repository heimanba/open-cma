export type ResourceKind =
  | "environment"
  | "vault"
  | "skill"
  | "agent"
  | "memory_store"
  | "mcp_server"
  | "multiagent"
  | "session";

export type SupportTier = "native" | "emulated" | "unsupported";

export interface CapabilityEntry {
  tier: SupportTier;
  reason: string;
  remediation?: string;
}

export type ProviderCapabilities = Record<ResourceKind, CapabilityEntry>;
