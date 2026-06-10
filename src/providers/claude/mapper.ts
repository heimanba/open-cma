import type { AgentDecl, EnvironmentDecl, ModelSpec } from "../../types/config.ts";
import type { ResolvedAgentRefs } from "../interface.ts";
import type { SessionBindings } from "../../types/session.ts";
import { UserError } from "../../errors.ts";

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
  const body: Record<string, unknown> = {
    name,
    config: {
      type: "cloud",
      networking: decl.config.networking ?? { type: "unrestricted" },
      packages: decl.config.packages,
    },
    metadata: injectMetadata(decl.metadata, projectName, name),
  };
  if (decl.description) body.description = decl.description;
  return body;
}

export function mapAgent(
  name: string,
  decl: AgentDecl,
  refs: ResolvedAgentRefs,
  version?: number,
  projectName?: string,
): unknown {
  let modelValue: unknown;
  if (typeof decl.model === "string") {
    modelValue = decl.model;
  } else {
    const claudeModel: ModelSpec | undefined = decl.model.claude;
    if (!claudeModel) throw new UserError(`No Claude model specified for agent '${name}'`);
    if (typeof claudeModel === "string") {
      modelValue = claudeModel;
    } else {
      modelValue = { id: claudeModel.id, speed: claudeModel.speed ?? "standard" };
    }
  }

  const body: Record<string, unknown> = {
    name,
    model: modelValue,
    system: decl.instructions,
  };

  if (version !== undefined) body.version = version;

  if (decl.description) body.description = decl.description;
  if (projectName) {
    body.metadata = injectMetadata(decl.metadata, projectName, name);
  } else if (decl.metadata) {
    body.metadata = decl.metadata;
  }

  // Tools
  if (decl.tools) {
    const toolConfigs = decl.tools.builtin.map((toolName) => {
      const permission = decl.tools?.permissions?.[toolName] ?? "allow";
      return {
        name: toolName,
        enabled: true,
        permission_policy: {
          type: permission === "ask" ? "always_ask" : "always_allow",
        },
      };
    });
    body.tools = [
      {
        type: "agent_toolset_20260401",
        default_config: { enabled: false },
        configs: toolConfigs,
      },
    ];
  } else {
    body.tools = [{ type: "agent_toolset_20260401" }];
  }

  // MCP servers
  if (decl.mcp_servers?.length) {
    body.mcp_servers = decl.mcp_servers.map((s) => ({
      name: s.name,
      type: "url",
      url: s.url,
    }));
    const tools = body.tools as unknown[];
    for (const s of decl.mcp_servers) {
      tools.push({ type: "mcp_toolset", mcp_server_name: s.name });
    }
  }

  // Skills
  if (refs.skill_ids.length) {
    body.skills = refs.skill_ids.map((s) => ({
      type: s.type,
      skill_id: s.skill_id,
    }));
  }

  // Multiagent
  if (decl.multiagent && refs.multiagent_agent_ids?.length) {
    body.multiagent = {
      type: "coordinator",
      agents: refs.multiagent_agent_ids,
    };
  }

  return body;
}

export function mapSession(bindings: SessionBindings): unknown {
  const body: Record<string, unknown> = {
    agent: bindings.agent_version
      ? { id: bindings.agent_id, type: "agent", version: bindings.agent_version }
      : bindings.agent_id,
    environment_id: bindings.environment_id,
  };

  if (bindings.title) body.title = bindings.title;
  if (bindings.metadata) body.metadata = bindings.metadata;
  if (bindings.vault_ids.length) body.vault_ids = bindings.vault_ids;

  if (bindings.memory_store_ids.length) {
    body.resources = bindings.memory_store_ids.map((id) => ({
      type: "memory_store",
      memory_store_id: id,
    }));
  }

  return body;
}
