import { registerProvider } from "../registry.ts";
import { QODER_CAPABILITIES } from "./capabilities.ts";
import { QoderAdapter } from "./adapter.ts";
import { qoderConfigSchema, type QoderConfig } from "./config.ts";

registerProvider({
  name: "qoder",
  configSchema: qoderConfigSchema,
  capabilities: QODER_CAPABILITIES,
  createAdapter: (config, projectName) => {
    const c = config as QoderConfig;
    return new QoderAdapter(c.api_key, c.gateway, projectName);
  },
});
