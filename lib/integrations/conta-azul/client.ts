import { prisma } from "@/lib/prisma";
import type { ERPConfig } from "@prisma/client";
import type {
  ContaAzulTokenResponse,
  ContaAzulError,
} from "./types";

// ---------------------------------------------------------------------------
// Conta Azul API v2 HTTP Client
// OAuth2 with auto-refresh, rate limiting, and pagination
// ---------------------------------------------------------------------------

const BASE_URL = "https://api-v2.contaazul.com/v1";
const TOKEN_URL = "https://auth.contaazul.com/oauth2/token";
const AUTHORIZE_URL = "https://auth.contaazul.com/login";

const REQUEST_DELAY_MS = 100; // 10 req/s max
const REQUEST_TIMEOUT_MS = 30_000;

export { AUTHORIZE_URL };

export class ContaAzulClient {
  private accessToken: string | null;
  private refreshToken: string | null;
  private tokenExpiresAt: Date | null;
  private clientId: string;
  private clientSecret: string;
  private erpConfigId: string;
  private lastRequestAt = 0;

  constructor(erpConfig: ERPConfig) {
    if (!erpConfig.contaAzulClientId || !erpConfig.contaAzulClientSecret) {
      throw new Error("[Conta Azul] Missing clientId or clientSecret in ERPConfig");
    }
    this.clientId = erpConfig.contaAzulClientId;
    this.clientSecret = erpConfig.contaAzulClientSecret;
    this.accessToken = erpConfig.contaAzulAccessToken;
    this.refreshToken = erpConfig.contaAzulRefreshToken;
    this.tokenExpiresAt = erpConfig.contaAzulTokenExpiresAt;
    this.erpConfigId = erpConfig.id;
  }

  // ── Token management ──

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    // Refresh 5 minutes before expiry
    return new Date() >= new Date(this.tokenExpiresAt.getTime() - 5 * 60 * 1000);
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("[Conta Azul] No refresh token available — re-authorize required");
    }

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/conta-azul/callback`,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ContaAzulError;
      throw new Error(
        `[Conta Azul] Token refresh failed: ${res.status} ${err.error_description || err.error || ""}`
      );
    }

    const tokens = (await res.json()) as ContaAzulTokenResponse;
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Persist refreshed tokens
    await prisma.eRPConfig.update({
      where: { id: this.erpConfigId },
      data: {
        contaAzulAccessToken: tokens.access_token,
        contaAzulRefreshToken: tokens.refresh_token,
        contaAzulTokenExpiresAt: this.tokenExpiresAt,
      },
    });
  }

  private async ensureValidToken(): Promise<string> {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
    return this.accessToken!;
  }

  // ── Rate limiting ──

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < REQUEST_DELAY_MS) {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  // ── HTTP methods ──

  async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    await this.throttle();
    const token = await this.ensureValidToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Rate limit — retry with backoff
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
        console.warn(`[Conta Azul] Rate limited, waiting ${retryAfter}s`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return this.request<T>(method, path, body);
      }

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as ContaAzulError;
        throw new Error(
          `[Conta Azul] HTTP ${res.status} ${method} ${path}: ${errBody.message || errBody.error_description || errBody.error || res.statusText}`
        );
      }

      // 204 No Content or 202 Accepted with no body
      const text = await res.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  // Fetch from an external URL (not BASE_URL). Used for services.contaazul.com
  // and public.contaazul.com endpoints.
  async fetchExternalUrl<T>(url: string, useAuth = true): Promise<T> {
    await this.throttle();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (useAuth) {
      const token = await this.ensureValidToken();
      headers.Authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`[Conta Azul] HTTP ${res.status} GET ${url}: ${res.statusText}`);
      }
      const text = await res.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Pagination ──

  async getAllPages<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const allRecords: T[] = [];
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    let url: string | null = `${path}${query}`;
    let page = 1;

    while (url) {
      await this.throttle();
      const token = await this.ensureValidToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
        const res = await fetch(fullUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }

        if (!res.ok) {
          throw new Error(`[Conta Azul] Pagination HTTP ${res.status} page ${page}`);
        }

        const data = (await res.json()) as T[];
        allRecords.push(...data);

        // Conta Azul uses Link header for pagination
        const linkHeader = res.headers.get("Link");
        url = this.parseNextLink(linkHeader);
        page++;
      } finally {
        clearTimeout(timeout);
      }
    }

    return allRecords;
  }

  private parseNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? match[1] : null;
  }
}

// ---------------------------------------------------------------------------
// Static helper for exchanging authorization code for tokens
// ---------------------------------------------------------------------------

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<ContaAzulTokenResponse> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ContaAzulError;
    throw new Error(
      `[Conta Azul] Token exchange failed: ${res.status} ${err.error_description || err.error || ""}`
    );
  }

  return (await res.json()) as ContaAzulTokenResponse;
}
