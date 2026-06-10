import { statSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import type { ProviderAdapter, RemoteResource, ResolvedAgentRefs } from "../interface.ts";
import type { EnvironmentDecl, VaultDecl, MemoryStoreDecl, SkillDecl, AgentDecl } from "../../types/config.ts";
import type { ResourceType } from "../../types/state.ts";
import type { SessionBindings, SessionInfo, SessionFilter, SessionListResult } from "../../types/session.ts";
import { ClaudeClient } from "./client.ts";
import { toRemoteResource } from "../base-client.ts";
import { mapEnvironment, mapAgent, mapSession } from "./mapper.ts";
import { collectFiles } from "../../utils/collect-files.ts";
import { UserError } from "../../errors.ts";

export class ClaudeAdapter implements ProviderAdapter {
  readonly name = "claude" as const;
  private client: ClaudeClient;
  private projectName: string;

  constructor(apiKey: string, beta?: string, projectName?: string) {
    this.client = new ClaudeClient({ apiKey, beta });
    this.projectName = projectName ?? "";
  }

  async validate(): Promise<void> {
    await this.client.get("/agents?limit=1");
  }

  private static readonly ENDPOINT_MAP: Record<ResourceType, string> = {
    environment: "/environments",
    agent: "/agents",
    vault: "/vaults",
    skill: "/skills",
    memory_store: "/memory_stores",
  };

  async findResource(type: ResourceType, name: string): Promise<RemoteResource | null> {
    const endpoint = ClaudeAdapter.ENDPOINT_MAP[type];
    const res = (await this.client.get(`${endpoint}?limit=100`)) as {
      data: Array<Record<string, unknown>>;
    };
    const found = (res.data ?? []).find((r) => r.name === name);
    return found ? toRemoteResource(found) : null;
  }

  async createEnvironment(name: string, decl: EnvironmentDecl): Promise<RemoteResource> {
    const body = mapEnvironment(name, decl, this.projectName);
    const res = (await this.client.post("/environments", body)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async updateEnvironment(id: string, name: string, decl: EnvironmentDecl): Promise<RemoteResource> {
    const body = mapEnvironment(name, decl, this.projectName);
    const res = (await this.client.post(`/environments/${id}`, body)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async deleteEnvironment(id: string): Promise<void> {
    await this.client.delete(`/environments/${id}`);
  }

  async createVault(name: string, decl: VaultDecl): Promise<RemoteResource> {
    const injected: Record<string, string> = {
      "cma.project": this.projectName,
      "cma.resource": name,
    };
    const body: Record<string, unknown> = {
      display_name: decl.display_name,
      metadata: { ...injected, ...decl.metadata },
    };
    const res = (await this.client.post("/vaults", body)) as Record<string, unknown>;
    const vaultId = res.id as string;

    if (decl.credentials?.length) {
      for (const cred of decl.credentials) {
        await this.client.post(`/vaults/${vaultId}/credentials`, {
          auth: {
            type: cred.type,
            token: cred.access_token,
            mcp_server_url: cred.mcp_server_url,
          },
          display_name: cred.name,
        });
      }
    }

    return toRemoteResource(res);
  }

  async deleteVault(id: string): Promise<void> {
    await this.client.delete(`/vaults/${id}`);
  }

  async createSkill(_name: string, decl: SkillDecl, basePath: string): Promise<RemoteResource> {
    const formData = buildClaudeSkillFormData(decl, basePath);
    const res = (await this.client.postFormData("/skills", formData)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async updateSkill(id: string, _name: string, decl: SkillDecl, basePath: string): Promise<RemoteResource> {
    const formData = buildClaudeSkillFormData(decl, basePath);
    const res = (await this.client.postFormData(`/skills/${id}/versions`, formData)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async deleteSkill(id: string): Promise<void> {
    // Must delete all versions before deleting the skill
    const versions = (await this.client.get(`/skills/${id}/versions`)) as { data: Array<{ version: string }> };
    for (const v of versions.data ?? []) {
      await this.client.delete(`/skills/${id}/versions/${v.version}`);
    }
    await this.client.delete(`/skills/${id}`);
  }

  async createAgent(name: string, decl: AgentDecl, refs: ResolvedAgentRefs): Promise<RemoteResource> {
    const body = mapAgent(name, decl, refs, undefined, this.projectName);
    const res = (await this.client.post("/agents", body)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async updateAgent(id: string, name: string, decl: AgentDecl, refs: ResolvedAgentRefs): Promise<RemoteResource> {
    const current = (await this.client.get(`/agents/${id}`)) as { version: number };
    const body = mapAgent(name, decl, refs, current.version, this.projectName);
    const res = (await this.client.post(`/agents/${id}`, body)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.client.post(`/agents/${id}/archive`, {});
  }

  async createMemoryStore(_name: string, _decl: MemoryStoreDecl): Promise<RemoteResource> {
    throw new UserError("Memory stores are not supported on Claude");
  }

  async deleteMemoryStore(_id: string): Promise<void> {
    throw new UserError("Memory stores are not supported on Claude");
  }

  async createSession(bindings: SessionBindings): Promise<SessionInfo> {
    const body = mapSession(bindings);
    const res = (await this.client.post("/sessions", body)) as Record<string, unknown>;
    return toSessionInfo(res);
  }

  async listSessions(filter?: SessionFilter): Promise<SessionListResult> {
    const params = new URLSearchParams();
    if (filter?.agent_id) params.set("agent_id", filter.agent_id);
    if (filter?.limit) params.set("limit", String(filter.limit));
    const qs = params.toString();
    const res = (await this.client.get(`/sessions${qs ? `?${qs}` : ""}`)) as Record<string, unknown>;
    const data = (res.data ?? []) as Record<string, unknown>[];
    return {
      sessions: data.map(toSessionInfo),
      has_more: (res.has_more as boolean) ?? false,
    };
  }

  async getSession(id: string): Promise<SessionInfo> {
    const res = (await this.client.get(`/sessions/${id}`)) as Record<string, unknown>;
    return toSessionInfo(res);
  }

  async deleteSession(id: string): Promise<void> {
    await this.client.post(`/sessions/${id}/archive`, {});
  }
}

function toSessionInfo(res: Record<string, unknown>): SessionInfo {
  const agent = res.agent as Record<string, unknown> | undefined;
  return {
    id: res.id as string,
    agent_id: agent?.id as string ?? "",
    environment_id: res.environment_id as string,
    status: res.status as string,
    title: res.title as string | undefined,
    vault_ids: (res.vault_ids as string[]) ?? [],
    memory_store_ids: ((res.resources as Array<Record<string, unknown>>) ?? [])
      .filter((r) => r.type === "memory_store")
      .map((r) => r.memory_store_id as string),
    created_at: res.created_at as string,
    updated_at: res.updated_at as string,
    attributes: res,
  };
}

function buildClaudeSkillFormData(decl: SkillDecl, basePath: string): FormData {
  const sourcePath = resolve(dirname(basePath), decl.source);
  const stat = statSync(sourcePath, { throwIfNoEntry: false });
  const formData = new FormData();

  const dirName = stat?.isDirectory()
    ? sourcePath.split("/").pop()!
    : "skill";

  if (stat?.isDirectory()) {
    const files = collectFiles(sourcePath, "");
    for (const f of files) {
      formData.append("files[]", new File([f.content], `${dirName}/${f.relativePath}`));
    }
  } else if (stat?.isFile()) {
    const content = readFileSync(sourcePath);
    formData.append("files[]", new File([content], `${dirName}/SKILL.md`));
  }

  return formData;
}
