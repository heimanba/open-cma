import { BaseApiClient, ApiError } from "../base-client.ts";

export interface ClaudeClientConfig {
  apiKey: string;
  beta?: string;
}

export class ClaudeClient extends BaseApiClient {
  protected baseUrl = "https://api.anthropic.com/v1";
  protected errorPrefix = "Claude API";
  private apiKey: string;
  private beta: string;

  constructor(config: ClaudeClientConfig) {
    super();
    this.apiKey = config.apiKey;
    this.beta = config.beta ?? "managed-agents-2026-04-01,skills-2025-10-02";
  }

  protected headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Api-Key": this.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": this.beta,
    };
  }

  async postFormData(path: string, formData: FormData): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": this.beta,
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(res.status, err, this.errorPrefix);
    }
    return res.json();
  }
}
