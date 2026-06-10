import { z } from "zod";
import type { ProviderCapabilities } from "./capabilities.ts";
import type { ProviderAdapter } from "./interface.ts";
import { UserError } from "../errors.ts";

export interface ProviderDefinition {
  name: string;
  configSchema: z.ZodType<any>;
  capabilities: ProviderCapabilities;
  createAdapter(config: unknown, projectName?: string): ProviderAdapter;
}

const registry = new Map<string, ProviderDefinition>();

export function registerProvider(def: ProviderDefinition): void {
  registry.set(def.name, def);
}

export function getProvider(name: string): ProviderDefinition | undefined {
  return registry.get(name);
}

export function allProviders(): ProviderDefinition[] {
  return Array.from(registry.values());
}

export function buildProviders(
  providersConfig: Record<string, unknown>,
  projectName?: string,
): Map<string, ProviderAdapter> {
  const adapters = new Map<string, ProviderAdapter>();

  for (const [name, rawConfig] of Object.entries(providersConfig)) {
    const def = registry.get(name);
    if (!def) {
      throw new UserError(`Unknown provider '${name}'. Registered: ${Array.from(registry.keys()).join(", ")}`);
    }
    const parsed = def.configSchema.parse(rawConfig);
    adapters.set(name, def.createAdapter(parsed, projectName));
  }

  return adapters;
}
