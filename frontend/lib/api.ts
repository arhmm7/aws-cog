"use client";

const REFRESH_BEFORE_EXPIRY_MS = 60_000;
const TOKEN_LOCK_NAME = "cognito-access-token-refresh";

type TokenResponse = { accessToken?: string; expiresAt?: number; error?: string };

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let expiresAt = 0;
let tokenRequest: Promise<string> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function setInMemoryToken(token: string, expiry: number) {
  accessToken = token;
  expiresAt = expiry;
  scheduleRefresh();
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (typeof window === "undefined" || !accessToken || !expiresAt) return;

  const delay = Math.max(1_000, expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS);
  refreshTimer = setTimeout(() => {
    void loadAccessToken(true).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        redirectToLogin();
        return;
      }
      refreshTimer = setTimeout(() => {
        void loadAccessToken(true).catch((retryError: unknown) => {
          if (retryError instanceof ApiError && retryError.status === 401) redirectToLogin();
        });
      }, 15_000);
    });
  }, delay);
}

async function requestToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/auth/token", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Could not contact the authentication service.");
  }

  if (!response.ok) {
    accessToken = null;
    expiresAt = 0;
    throw new ApiError(response.status === 401 ? "Your session has expired." : "Unable to retrieve an access token.", response.status);
  }

  const data = await response.json() as TokenResponse;
  if (!data.accessToken || typeof data.expiresAt !== "number") {
    throw new ApiError("The authentication service returned an invalid token response.");
  }
  setInMemoryToken(data.accessToken, data.expiresAt);
  return data.accessToken;
}

async function withCrossTabLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(TOKEN_LOCK_NAME, { mode: "exclusive" }, operation);
  }
  return operation();
}

async function loadAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && accessToken && expiresAt - Date.now() > REFRESH_BEFORE_EXPIRY_MS) return accessToken;
  if (tokenRequest) return tokenRequest;

  tokenRequest = withCrossTabLock(async () => {
    if (!forceRefresh && accessToken && expiresAt - Date.now() > REFRESH_BEFORE_EXPIRY_MS) return accessToken;
    return requestToken();
  });
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

function redirectToLogin() {
  accessToken = null;
  expiresAt = 0;
  if (refreshTimer) clearTimeout(refreshTimer);
  if (typeof window !== "undefined") {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const loginUrl = new URL(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`, window.location.origin);
    window.location.assign(loginUrl.toString());
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new ApiError("NEXT_PUBLIC_API_URL is not configured.");
  const url = new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/$/, "")}/`);

  const makeRequest = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (typeof init.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(url, { ...init, headers, cache: "no-store", credentials: "omit" });
  };

  let response: Response;
  try {
    response = await makeRequest(await loadAccessToken());
    if (response.status === 401) {
      response = await makeRequest(await loadAccessToken(true));
    }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) redirectToLogin();
      throw error;
    }
    throw new ApiError("Could not reach the API. Check your connection and try again.");
  }

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError("Your session has expired.", 401);
  }
  if (response.status === 403) throw new ApiError("You do not have permission to perform this action.", 403);
  return response;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parseJson<T>(await apiFetch(path));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parseJson<T>(await apiFetch(path, { method: "POST", body: requestBody(body) }));
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return parseJson<T>(await apiFetch(path, { method: "PUT", body: requestBody(body) }));
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return parseJson<T>(await apiFetch(path, { method: "PATCH", body: requestBody(body) }));
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const response = await apiFetch(path, { method: "DELETE" });
  if (response.status === 204) return undefined as T;
  return parseJson<T>(response);
}

function requestBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData || body instanceof Blob || typeof body === "string") return body;
  return JSON.stringify(body);
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new ApiError(`API request failed with status ${response.status}.`, response.status);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
