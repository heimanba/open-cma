import { registerProvider } from "../registry.ts";
import { CLAUDE_CAPABILITIES } from "./capabilities.ts";
import { ClaudeAdapter } from "./adapter.ts";
import { claudeConfigSchema, type ClaudeConfig } from "./config.ts";

registerProvider({
  name: "claude",
  configSchema: claudeConfigSchema,
  capabilities: CLAUDE_CAPABILITIES,
  createAdapter: (config, projectName) => {
    const c = config as ClaudeConfig;
    return new ClaudeAdapter(c.api_key, c.beta, projectName);
  },
});
