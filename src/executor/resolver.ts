import type { ProjectConfig } from "../types/config.ts";
import type { ResolvedAgentRefs } from "../providers/interface.ts";
import type { ResourceAddress } from "../types/state.ts";
import { StateManager } from "../state/state-manager.ts";
import { UserError } from "../errors.ts";

export function resolveRef(
  state: StateManager,
  address: ResourceAddress
): string | undefined {
  return state.getResource(address)?.remote_id;
}

export function requireRef(
  state: StateManager,
  address: ResourceAddress
): string {
  const id = resolveRef(state, address);
  if (!id) {
    throw new UserError(
      `Resource ${address.provider}.${address.type}.${address.name} not found in state. Run \`cma apply\` first.`
    );
  }
  return id;
}

export function resolveAgentRefs(
  agentName: string,
  config: ProjectConfig,
  provider: string,
  state: StateManager
): ResolvedAgentRefs {
  const agent = config.agents?.[agentName];
  if (!agent) throw new UserError(`Agent '${agentName}' not found in config`);

  const refs: ResolvedAgentRefs = {
    skill_ids: [],
  };

  if (agent.skills) {
    for (const skillName of agent.skills) {
      const id = resolveRef(state, { type: "skill", name: skillName, provider });
      if (id) {
        refs.skill_ids.push({ type: "custom", skill_id: id });
      }
    }
  }

  if (agent.multiagent) {
    refs.multiagent_agent_ids = [];
    for (const subName of agent.multiagent.agents) {
      const id = resolveRef(state, { type: "agent", name: subName, provider });
      if (id) refs.multiagent_agent_ids.push(id);
    }
  }

  return refs;
}
