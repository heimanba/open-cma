import { test, expect } from "bun:test";
import { resolve } from "path";
import { loadConfig } from "../../src/parser/index.ts";

const FIXTURES = resolve(import.meta.dir, "../fixtures");

test("loads minimal YAML config", async () => {
  const { config, errors } = await loadConfig(resolve(FIXTURES, "minimal.yaml"));
  expect(errors).toEqual([]);
  expect(config.version).toBe("1");
  expect(config.providers.claude).toBeDefined();
  expect(config.providers.qoder).toBeDefined();
  expect(config.environments?.dev).toBeDefined();
  expect(config.agents?.assistant).toBeDefined();
  expect(config.skills?.["code-review"]).toBeDefined();
});

test("reports errors for invalid YAML", async () => {
  const { errors } = await loadConfig("/nonexistent/path.yaml");
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain("not found");
});

test("validates agent references", async () => {
  const { config, errors } = await loadConfig(resolve(FIXTURES, "minimal.yaml"));
  expect(errors).toEqual([]);
  const agent = config.agents?.assistant;
  expect(agent?.environment).toBe("dev");
  expect(agent?.skills).toContain("code-review");
});
