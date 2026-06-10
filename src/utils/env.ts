import { UserError } from "../errors.ts";

const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;

export function interpolateEnvVars(
  value: string,
  resolve = false
): string {
  return value.replace(ENV_VAR_PATTERN, (match, varName: string) => {
    if (!resolve) return match;
    const val = process.env[varName];
    if (val === undefined) {
      throw new UserError(`Environment variable '${varName}' is not set`);
    }
    return val;
  });
}

export function hasEnvVars(value: string): boolean {
  return ENV_VAR_PATTERN.test(value);
}

export function extractEnvVarNames(value: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(ENV_VAR_PATTERN.source, "g");
  while ((match = re.exec(value)) !== null) {
    names.push(match[1]!);
  }
  return names;
}
