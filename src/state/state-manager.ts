import type { StateFile, ResourceState, ResourceAddress } from "../types/state.ts";
import { addressKey } from "../types/state.ts";

export class StateManager {
  private state: StateFile;
  private path: string;
  private index: Map<string, number>;

  private constructor(state: StateFile, path: string) {
    this.state = state;
    this.path = path;
    this.index = this.buildIndex();
  }

  private buildIndex(): Map<string, number> {
    const idx = new Map<string, number>();
    for (let i = 0; i < this.state.resources.length; i++) {
      idx.set(addressKey(this.state.resources[i]!.address), i);
    }
    return idx;
  }

  static async load(path: string): Promise<StateManager> {
    const file = Bun.file(path);
    if (await file.exists()) {
      const data = await file.json() as Record<string, unknown>;
      const raw = (data.resources ?? []) as Array<Record<string, unknown>>;
      const resources: ResourceState[] = raw.map((r) => ({
        address: r.address as ResourceState["address"],
        remote_id: r.remote_id as string,
        version: r.version as number | undefined,
        content_hash: r.content_hash as string,
      }));
      return new StateManager({ resources }, path);
    }
    return StateManager.initialize(path);
  }

  static initialize(path: string): StateManager {
    return new StateManager({ resources: [] }, path);
  }

  getResource(address: ResourceAddress): ResourceState | undefined {
    const i = this.index.get(addressKey(address));
    return i !== undefined ? this.state.resources[i] : undefined;
  }

  setResource(resource: ResourceState): void {
    const key = addressKey(resource.address);
    const i = this.index.get(key);
    if (i !== undefined) {
      this.state.resources[i] = resource;
    } else {
      this.index.set(key, this.state.resources.length);
      this.state.resources.push(resource);
    }
  }

  removeResource(address: ResourceAddress): void {
    const key = addressKey(address);
    const i = this.index.get(key);
    if (i === undefined) return;

    this.state.resources.splice(i, 1);
    this.index.delete(key);
    // Rebuild index entries after removal point
    for (let j = i; j < this.state.resources.length; j++) {
      this.index.set(addressKey(this.state.resources[j]!.address), j);
    }
  }

  listResources(): ResourceState[] {
    return [...this.state.resources];
  }

  getStateFile(): StateFile {
    return this.state;
  }

  async save(): Promise<void> {
    await Bun.write(this.path, JSON.stringify(this.state, null, 2) + "\n");
  }
}
