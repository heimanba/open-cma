import type { ResourceAddress } from "./state.ts";

export type ActionType = "create" | "update" | "delete" | "no-op";

export interface PlannedAction {
  action: ActionType;
  address: ResourceAddress;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  dependencies: ResourceAddress[];
}

export interface ExecutionPlan {
  actions: PlannedAction[];
  diagnostics: Diagnostic[];
}

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  resource?: ResourceAddress;
}
