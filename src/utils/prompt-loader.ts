import { resolve, dirname } from "path";
import { UserError } from "../errors.ts";

export function isFileReference(value: string): boolean {
  return value.startsWith("./") || value.startsWith("../") || value.startsWith("/");
}

export async function loadPrompt(value: string, basePath: string): Promise<string> {
  if (!isFileReference(value)) return value;
  const fullPath = resolve(dirname(basePath), value);
  const file = Bun.file(fullPath);
  if (!(await file.exists())) {
    throw new UserError(`Prompt file not found: ${fullPath}`);
  }
  return file.text();
}
