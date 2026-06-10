export type ProviderName = string;

export interface ProjectConfig {
  version: string;
  providers: Record<string, unknown>;
  defaults?: DefaultsConfig;
  environments?: Record<string, EnvironmentDecl>;
  vaults?: Record<string, VaultDecl>;
  memory_stores?: Record<string, MemoryStoreDecl>;
  skills?: Record<string, SkillDecl>;
  agents?: Record<string, AgentDecl>;
}

export interface DefaultsConfig {
  provider?: string;
}

// --- Environment ---

export interface EnvironmentDecl {
  description?: string;
  provider?: ProviderName;
  config: EnvironmentConfig;
  metadata?: Record<string, string>;
}

export interface EnvironmentConfig {
  type: "cloud";
  networking?: NetworkingConfig;
  packages?: PackagesConfig;
}

export interface NetworkingConfig {
  type: "unrestricted" | "limited";
  allow_mcp_servers?: boolean;
  allow_package_managers?: boolean;
  allowed_hosts?: string[];
}

export interface PackagesConfig {
  apt?: string[];
  pip?: string[];
  npm?: string[];
  cargo?: string[];
  gem?: string[];
  go?: string[];
}

// --- Vault ---

export interface VaultDecl {
  display_name: string;
  provider?: ProviderName;
  credentials: CredentialDecl[];
  metadata?: Record<string, string>;
}

export interface CredentialDecl {
  name: string;
  mcp_server_url: string;
  type: "static_bearer";
  access_token: string;
  protocol?: "sse" | "streamable_http";
}

// --- Memory Store ---

export interface MemoryStoreDecl {
  description: string;
  provider?: ProviderName;
  entries?: MemoryEntryDecl[];
}

export interface MemoryEntryDecl {
  key: string;
  content: string;
}

// --- Skill ---

export interface SkillDecl {
  source: string;
  description?: string;
  provider?: ProviderName;
}

// --- Model ---

export interface ModelWithSpeed {
  id: string;
  speed?: "standard" | "fast";
}

export type ModelSpec = string | ModelWithSpeed;

// --- Agent ---

export interface AgentDecl {
  description?: string;
  model: string | Record<ProviderName, ModelSpec>;
  instructions: string;
  environment?: string;
  provider?: ProviderName;
  tools?: AgentToolsDecl;
  mcp_servers?: McpServerDecl[];
  skills?: string[];
  vault?: string;
  memory_stores?: string[];
  multiagent?: MultiagentDecl;
  metadata?: Record<string, string>;
}

export interface AgentToolsDecl {
  builtin: string[];
  permissions?: Record<string, "allow" | "ask">;
}

export interface McpServerDecl {
  name: string;
  url: string;
}

export interface MultiagentDecl {
  type: "coordinator";
  agents: string[];
}
