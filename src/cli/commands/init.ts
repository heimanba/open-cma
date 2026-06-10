import * as p from "@clack/prompts";
import { log } from "../../utils/logger.ts";

const GITIGNORE_ADDITIONS = `
# cma
cma.state.json
.env
`;

function buildTemplate(opts: { provider: string; agentName: string }) {
  const providers: Record<string, string> = {
    claude: `  claude:\n    api_key: \${ANTHROPIC_API_KEY}`,
    qoder: `  qoder:\n    api_key: \${QODER_PAT}\n    gateway: "https://api.qoder.com/api/v1/cloud"`,
  };

  const providerBlock =
    opts.provider === "both"
      ? `${providers.claude}\n${providers.qoder}`
      : providers[opts.provider];

  const modelBlock =
    opts.provider === "both"
      ? `    model:\n      claude: claude-sonnet-4-6\n      qoder: ultimate`
      : opts.provider === "claude"
        ? `    model: claude-sonnet-4-6`
        : `    model: ultimate`;

  return `version: "1"

providers:
${providerBlock}

defaults:
  provider: ${opts.provider === "both" ? "all" : opts.provider}

environments:
  dev:
    config:
      type: cloud
      networking:
        type: unrestricted

agents:
  ${opts.agentName}:
    description: "General-purpose assistant"
${modelBlock}
    instructions: |
      You are a helpful assistant.
    environment: dev
    tools:
      builtin: [read, glob, grep, web_search, web_fetch]
`;
}

export async function initCommand() {
  const configPath = "cma.yaml";
  const configFile = Bun.file(configPath);

  if (await configFile.exists()) {
    log.warn(`${configPath} already exists, skipping.`);
    return;
  }

  p.intro("cma init");

  const answers = await p.group(
    {
      provider: () =>
        p.select({
          message: "Which provider(s) do you want to use?",
          options: [
            { value: "both", label: "Claude + Qoder" },
            { value: "claude", label: "Claude only" },
            { value: "qoder", label: "Qoder only" },
          ],
        }),
      agentName: () =>
        p.text({
          message: "Name your first agent:",
          placeholder: "assistant",
          defaultValue: "assistant",
        }),
    },
    { onCancel: () => { p.cancel("Init cancelled."); process.exit(0); } }
  );

  const template = buildTemplate({
    provider: answers.provider as string,
    agentName: answers.agentName as string,
  });

  await Bun.write(configPath, template);
  p.log.success(`Created ${configPath}`);

  const gitignorePath = ".gitignore";
  const gitignoreFile = Bun.file(gitignorePath);
  if (await gitignoreFile.exists()) {
    const content = await gitignoreFile.text();
    if (!content.includes("cma.state.json")) {
      await Bun.write(gitignorePath, content + GITIGNORE_ADDITIONS);
      p.log.success("Updated .gitignore");
    }
  } else {
    await Bun.write(gitignorePath, GITIGNORE_ADDITIONS.trim() + "\n");
    p.log.success("Created .gitignore");
  }

  p.outro("Done! Next: edit cma.yaml, then run cma plan");
}
