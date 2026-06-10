import { z } from "zod";

const networkingSchema = z.object({
  type: z.enum(["unrestricted", "limited"]),
  allow_mcp_servers: z.boolean().optional(),
  allow_package_managers: z.boolean().optional(),
  allowed_hosts: z.array(z.string()).optional(),
});

const packagesSchema = z.object({
  apt: z.array(z.string()).optional(),
  pip: z.array(z.string()).optional(),
  npm: z.array(z.string()).optional(),
  cargo: z.array(z.string()).optional(),
  gem: z.array(z.string()).optional(),
  go: z.array(z.string()).optional(),
});

const environmentSchema = z.object({
  description: z.string().optional(),
  provider: z.string().optional(),
  config: z.object({
    type: z.literal("cloud"),
    networking: networkingSchema.optional(),
    packages: packagesSchema.optional(),
  }),
  metadata: z.record(z.string(), z.string()).optional(),
});

const credentialSchema = z.object({
  name: z.string(),
  mcp_server_url: z.string(),
  type: z.literal("static_bearer"),
  access_token: z.string(),
  protocol: z.enum(["sse", "streamable_http"]).optional(),
});

const vaultSchema = z.object({
  display_name: z.string(),
  provider: z.string().optional(),
  credentials: z.array(credentialSchema),
  metadata: z.record(z.string(), z.string()).optional(),
});

const memoryEntrySchema = z.object({
  key: z.string(),
  content: z.string(),
});

const memoryStoreSchema = z.object({
  description: z.string(),
  provider: z.string().optional(),
  entries: z.array(memoryEntrySchema).optional(),
});

const skillSchema = z.object({
  source: z.string(),
  description: z.string().optional(),
  provider: z.string().optional(),
});

const mcpServerSchema = z.object({
  name: z.string(),
  url: z.string(),
});

const toolsSchema = z.object({
  builtin: z.array(z.string()),
  permissions: z.record(z.string(), z.enum(["allow", "ask"])).optional(),
});

const multiagentSchema = z.object({
  type: z.literal("coordinator"),
  agents: z.array(z.string()),
});

const agentSchema = z.object({
  description: z.string().optional(),
  model: z.union([z.string(), z.record(z.string(), z.string())]),
  instructions: z.string(),
  environment: z.string().optional(),
  provider: z.string().optional(),
  tools: toolsSchema.optional(),
  mcp_servers: z.array(mcpServerSchema).optional(),
  skills: z.array(z.string()).optional(),
  vault: z.string().optional(),
  memory_stores: z.array(z.string()).optional(),
  multiagent: multiagentSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const projectConfigSchema = z.object({
  version: z.string(),
  providers: z.record(z.string(), z.unknown()),
  defaults: z
    .object({
      provider: z.string().optional(),
    })
    .optional(),
  environments: z.record(z.string(), environmentSchema).optional(),
  vaults: z.record(z.string(), vaultSchema).optional(),
  memory_stores: z.record(z.string(), memoryStoreSchema).optional(),
  skills: z.record(z.string(), skillSchema).optional(),
  agents: z.record(z.string(), agentSchema).optional(),
});

export type ParsedConfig = z.infer<typeof projectConfigSchema>;
