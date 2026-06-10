import type { ProviderName } from "./config.ts";

export type ResourceType =
  | "environment"
  | "vault"
  | "memory_store"
  | "skill"
  | "agent";

export interface ResourceAddress {
  type: ResourceType;
  name: string;
  provider: ProviderName;
}

export interface ResourceState {
  address: ResourceAddress;
  remote_id: string;
  version?: number;
  content_hash: string;
}

export interface StateFile {
  resources: ResourceState[];
}

export function addressKey(addr: ResourceAddress): string {
  return `${addr.provider}.${addr.type}.${addr.name}`;
}
