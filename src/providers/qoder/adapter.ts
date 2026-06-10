import { statSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import JSZip from "jszip";
import type { ProviderAdapter, RemoteResource, ResolvedAgentRefs } from "../interface.ts";
import type { EnvironmentDecl, VaultDecl, MemoryStoreDecl, SkillDecl, AgentDecl } from "../../types/config.ts";
import type { ResourceType } from "../../types/state.ts";
import type { SessionBindings, SessionInfo, SessionFilter, SessionListResult } from "../../types/session.ts";
import { QoderClient } from "./client.ts";
import { toRemoteResource, ApiError } from "../base-client.ts";
import { mapEnvironment, mapVault, mapMemoryStore, mapAgent, mapSession } from "./mapper.ts";
import { collectFiles } from "../../utils/collect-files.ts";
import { UserError } from "../../errors.ts";

export class QoderAdapter implements ProviderAdapter {
  readonly name = "qoder" as const;
  private client: QoderClient;
  private projectName: string;

  constructor(apiKey: string, gateway?: string, projectName?: string) {
    this.client = new QoderClient({ apiKey, gateway });
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
    const endpoint = QoderAdapter.ENDPOINT_MAP[type];
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
    const res = (await this.client.put(`/environments/${id}`, body)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async deleteEnvironment(id: string, cascade = false): Promise<void> {
    try {
      await this.client.delete(`/environments/${id}`);
    } catch (err) {
      const isConflict = err instanceof ApiError &&
        (err.statusCode === 409 || err.responseBody.includes("in use"));
      if (!isConflict) throw err;

      // Environment is referenced by sessions
      const sessions = (await this.client.get(`/sessions?limit=100`)) as {
        data: Array<{ id: string; environment_id: string; status: string }>;
      };
      const blocking = (sessions.data ?? []).filter((s) => s.environment_id === id);

      if (!cascade) {
        const ids = blocking.map((s) => `${s.id} (${s.status})`).join(", ");
        throw new UserError(
          `Environment ${id} is referenced by ${blocking.length} session(s): ${ids}. ` +
          `Use --cascade to delete them automatically.`
        );
      }

      for (const s of blocking) {
        await this.client.delete(`/sessions/${s.id}`);
      }
      await this.client.delete(`/environments/${id}`);
    }
  }

  async createVault(_name: string, decl: VaultDecl): Promise<RemoteResource> {
    const body = mapVault(decl);
    const res = (await this.client.post("/vaults", body)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async deleteVault(id: string): Promise<void> {
    await this.client.delete(`/vaults/${id}`);
  }

  async createSkill(name: string, decl: SkillDecl, basePath: string): Promise<RemoteResource> {
    const formData = await buildSkillFormData(name, decl, basePath);
    const res = (await this.client.postFormData("/skills", formData)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async updateSkill(id: string, name: string, decl: SkillDecl, basePath: string): Promise<RemoteResource> {
    await this.client.delete(`/skills/${id}`);
    return this.createSkill(name, decl, basePath);
  }

  async deleteSkill(id: string): Promise<void> {
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
    const res = (await this.client.put(`/agents/${id}`, body)) as Record<string, unknown>;
    return toRemoteResource(res);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.client.delete(`/agents/${id}`);
  }

  async createMemoryStore(name: string, decl: MemoryStoreDecl): Promise<RemoteResource> {
    const body = mapMemoryStore(name, decl);
    const res = (await this.client.post("/memory_stores", body)) as Record<string, unknown>;
    const storeId = res.id as string;

    if (decl.entries?.length) {
      for (const entry of decl.entries) {
        await this.client.post(`/memory_stores/${storeId}/memories`, {
          content: entry.content,
          path: entry.key,
        });
      }
    }

    return toRemoteResource(res);
  }

  async deleteMemoryStore(id: string): Promise<void> {
    await this.client.delete(`/memory_stores/${id}`);
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
    await this.client.delete(`/sessions/${id}`);
  }

}

function toSessionInfo(res: Record<string, unknown>): SessionInfo {
  return {
    id: res.id as string,
    agent_id: res.agent_id as string,
    environment_id: res.environment_id as string,
    status: res.status as string,
    title: res.title as string | undefined,
    vault_ids: (res.vault_ids as string[]) ?? [],
    memory_store_ids: (res.memory_store_ids as string[]) ?? [],
    created_at: res.created_at as string,
    updated_at: res.updated_at as string,
    attributes: res,
  };
}

async function buildSkillFormData(name: string, decl: SkillDecl, basePath: string): Promise<FormData> {
  const sourcePath = resolve(dirname(basePath), decl.source);
  const stat = statSync(sourcePath, { throwIfNoEntry: false });

  const files: Array<{ relativePath: string; content: Buffer }> = [];
  if (stat?.isDirectory()) {
    files.push(...collectFiles(sourcePath, ""));
  } else if (stat?.isFile()) {
    files.push({ relativePath: "SKILL.md", content: readFileSync(sourcePath) });
  }

  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.relativePath, f.content);
  }
  const zipContent = await zip.generateAsync({ type: "uint8array" });

  const formData = new FormData();
  formData.append("file", new File([zipContent], `${name}.zip`, { type: "application/zip" }));
  formData.append("name", name);
  formData.append("type", "custom");
  if (decl.description) formData.append("description", decl.description);
  return formData;
}
