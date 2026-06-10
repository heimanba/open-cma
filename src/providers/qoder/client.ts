import { BaseApiClient, ApiError } from "../base-client.ts";

export interface QoderClientConfig {
  apiKey: string;
  gateway?: string;
}

export class QoderClient extends BaseApiClient {
  protected baseUrl: string;
  protected errorPrefix = "Qoder API";
  private apiKey: string;

  constructor(config: QoderClientConfig) {
    super();
    this.baseUrl = config.gateway ?? "https://api.qoder.com/api/v1/cloud";
    this.apiKey = config.apiKey;
  }

  protected headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async postFormData(path: string, formData: FormData): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(res.status, err, this.errorPrefix);
    }
    return res.json();
  }
}
