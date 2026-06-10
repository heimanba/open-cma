import type { RemoteResource } from "./interface.ts";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody: string,
    prefix: string,
  ) {
    super(`${prefix} ${statusCode}: ${responseBody}`);
  }
}

export abstract class BaseApiClient {
  protected abstract baseUrl: string;
  protected abstract headers(): Record<string, string>;
  protected abstract errorPrefix: string;

  async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(res.status, err, this.errorPrefix);
    }
    return res.json();
  }

  async put(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(res.status, err, this.errorPrefix);
    }
    return res.json();
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(res.status, err, this.errorPrefix);
    }
  }

  async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(res.status, err, this.errorPrefix);
    }
    return res.json();
  }
}

export function toRemoteResource(res: Record<string, unknown>): RemoteResource {
  return {
    id: res.id as string,
    type: res.type as string,
    version: res.version as number | undefined,
  };
}
