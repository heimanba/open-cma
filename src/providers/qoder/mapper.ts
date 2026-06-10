import type { AgentDecl, EnvironmentDecl, VaultDecl, MemoryStoreDecl, ModelSpec } from "../../types/config.ts";
import type { ResolvedAgentRefs } from "../interface.ts";
import type { SessionBindings } from "../../types/session.ts";
import { UserError } from "../../errors.ts";

const TOOL_NAME_MAP: Record<string, string> = {
  bash: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
  glob: "Glob",
  grep: "Grep",
  web_fetch: "WebFetch",
  web_search: "WebSearch",
  webfetch: "WebFetch",
  websearch: "WebSearch",
};

function injectMetadata(
  userMetadata: Record<string, string> | undefined,
  projectName: string,
  resourceName: string,
): Record<string, string> {
  const injected: Record<string, string> = {
    "cma.project": projectName,
    "cma.resource": resourceName,
  };
  return { ...injected, ...userMetadata };
}

export function mapEnvironment(name: string, decl: EnvironmentDecl, projectName: string): unknown {
  return {
    name,
    description: decl.description ?? "",
    config: {
      type: "cloud",
      networking: decl.config.networking ?? { type: "unrestricted" },
      packages: decl.config.packages,
    },
    metadata: injectMetadata(decl.metadata, projectName, name),
  };
}

export function mapVault(decl: VaultDecl): unknown {
  return {
    display_name: decl.display_name,
    credentials: decl.credentials.map((c) => ({
      mcp_server_url: c.mcp_server_url,
      protocol: c.protocol ?? "sse",
      type: c.type,
      access_token: c.access_token,
    })),
  };
}

export function mapMemoryStore(name: string, decl: MemoryStoreDecl): unknown {
  return {
    name,
    description: decl.description,
  };
}

export function mapAgent(
  name: string,
  decl: AgentDecl,
  refs: ResolvedAgentRefs,
  version?: number,
  projectName?: string,
): unknown {
  let model: string;
  if (typeof decl.model === "string") {
    model = decl.model;
  } else {
    const qoderModel: ModelSpec | undefined = decl.model.qoder;
    if (!qoderModel) throw new UserError(`No Qoder model specified for agent '${name}'`);
    model = typeof qoderModel === "string" ? qoderModel : qoderModel.id;
  }

  const body: Record<string, unknown> = {
    name,
    model,
    instructions: decl.instructions,
  };

  if (version !== undefined) body.version = version;
  if (decl.description) body.description = decl.description;
  if (projectName) {
    body.metadata = injectMetadata(decl.metadata, projectName, name);
  } else if (decl.metadata) {
    body.metadata = decl.metadata;
  }

  if (decl.tools) {
    const enabledTools = decl.tools.builtin.map(
      (t) => TOOL_NAME_MAP[t] ?? t
    );
    body.tools = [
      {
        type: "agent_toolset_20260401",
        enabled_tools: enabledTools,
      },
    ];
  } else {
    body.tools = [{ type: "agent_toolset_20260401" }];
  }

  if (decl.mcp_servers?.length) {
    body.mcp_servers = decl.mcp_servers.map((s) => ({
      name: s.name,
      type: "url",
      url: s.url,
    }));
  }

  // Skills
  if (refs.skill_ids.length) {
    body.skills = refs.skill_ids.map((s) => ({
      type: s.type,
      skill_id: s.skill_id,
    }));
  }

  return body;
}

export function mapSession(bindings: SessionBindings): unknown {
  const body: Record<string, unknown> = {
    agent: { id: bindings.agent_id },
    environment_id: bindings.environment_id,
  };

  if (bindings.agent_version !== undefined) {
    (body.agent as Record<string, unknown>).version = bindings.agent_version;
  }

  if (bindings.title) body.title = bindings.title;
  if (bindings.metadata) body.metadata = bindings.metadata;
  if (bindings.vault_ids.length) body.vault_ids = bindings.vault_ids;
  if (bindings.memory_store_ids.length) body.memory_store_ids = bindings.memory_store_ids;

  return body;
}
