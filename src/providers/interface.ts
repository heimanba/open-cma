import type {
  EnvironmentDecl,
  VaultDecl,
  MemoryStoreDecl,
  SkillDecl,
  AgentDecl,
} from "../types/config.ts";
import type { ResourceType } from "../types/state.ts";
import type {
  SessionBindings,
  SessionInfo,
  SessionFilter,
  SessionListResult,
} from "../types/session.ts";

export interface RemoteResource {
  id: string;
  type: string;
  version?: number;
}

export interface ResolvedAgentRefs {
  skill_ids: Array<{ type: string; skill_id: string }>;
  multiagent_agent_ids?: string[];
}

export interface ProviderAdapter {
  readonly name: string;

  validate(): Promise<void>;
  findResource(type: ResourceType, name: string): Promise<RemoteResource | null>;

  createEnvironment(name: string, decl: EnvironmentDecl): Promise<RemoteResource>;
  updateEnvironment(id: string, name: string, decl: EnvironmentDecl): Promise<RemoteResource>;
  deleteEnvironment(id: string, cascade?: boolean): Promise<void>;

  createVault(name: string, decl: VaultDecl): Promise<RemoteResource>;
  deleteVault(id: string): Promise<void>;

  createSkill(name: string, decl: SkillDecl, basePath: string): Promise<RemoteResource>;
  updateSkill(id: string, name: string, decl: SkillDecl, basePath: string): Promise<RemoteResource>;
  deleteSkill(id: string): Promise<void>;

  createAgent(name: string, decl: AgentDecl, refs: ResolvedAgentRefs): Promise<RemoteResource>;
  updateAgent(id: string, name: string, decl: AgentDecl, refs: ResolvedAgentRefs): Promise<RemoteResource>;
  deleteAgent(id: string): Promise<void>;

  createMemoryStore(name: string, decl: MemoryStoreDecl): Promise<RemoteResource>;
  deleteMemoryStore(id: string): Promise<void>;

  createSession(bindings: SessionBindings): Promise<SessionInfo>;
  listSessions(filter?: SessionFilter): Promise<SessionListResult>;
  getSession(id: string): Promise<SessionInfo>;
  deleteSession(id: string): Promise<void>;
}
