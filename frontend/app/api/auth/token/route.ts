import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import * as oidc from "openid-client";
import { appUrl, clientId, COOKIE_OPTIONS, getCognitoClient } from "@/lib/cognito";

const REFRESH_EARLY_SECONDS = 60;
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
type RefreshResult = Awaited<ReturnType<typeof oidc.refreshTokenGrant>>;
const refreshInFlight = new Map<string, Promise<RefreshResult>>();

function clearSession(response: NextResponse) {
  for (const name of ["cognito_access", "cognito_id", "cognito_refresh", "cognito_refresh_exp"]) {
    response.cookies.set(name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  }
}

function unauthorized() {
  const response = NextResponse.json({ error: "Authentication expired. Please sign in again." }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
  clearSession(response);
  return response;
}

async function verifyAccessToken(token: string, issuer: string, jwks: ReturnType<typeof createRemoteJWKSet>) {
  const now = Math.floor(Date.now() / 1000);
  const unverified = decodeJwt(token);
  if (typeof unverified.exp !== "number" || !Number.isFinite(unverified.exp) || unverified.exp <= 0) {
    throw new Error("Access token has no valid expiry");
  }

  // Verify the signature and issuer even for an expired token. Moving validation
  // to just before its signed expiry lets us distinguish expiry from forgery.
  const verificationTime = unverified.exp <= now
    ? new Date(unverified.exp * 1000 - 1000)
    : new Date();
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    algorithms: ["RS256"],
    currentDate: verificationTime,
    clockTolerance: 5,
  });
  const expiresAtSeconds = payload.exp;

  if (payload.token_use !== "access" || payload.client_id !== clientId()) {
    throw new Error("Access token type or client does not match");
  }
  if (typeof expiresAtSeconds !== "number" || typeof payload.iat !== "number" || !Number.isFinite(payload.iat) || expiresAtSeconds <= payload.iat) {
    throw new Error("Access token issued-at claim is invalid");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now + 5) {
    throw new Error("Access token is not active yet");
  }
  if (typeof payload.iat === "number" && payload.iat > now + 5) {
    throw new Error("Access token was issued in the future");
  }

  return { expiresAt: expiresAtSeconds * 1000, shouldRefresh: expiresAtSeconds <= now + REFRESH_EARLY_SECONDS };
}

function refreshOnce(config: Awaited<ReturnType<typeof getCognitoClient>>, refreshToken: string) {
  const existing = refreshInFlight.get(refreshToken);
  if (existing) return existing;

  const pending = oidc.refreshTokenGrant(config, refreshToken);
  refreshInFlight.set(refreshToken, pending);
  void pending.finally(() => {
    if (refreshInFlight.get(refreshToken) === pending) refreshInFlight.delete(refreshToken);
  }).catch(() => {});
  return pending;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== appUrl().origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const accessToken = request.cookies.get("cognito_access")?.value;
  const refreshToken = request.cookies.get("cognito_refresh")?.value;
  const refreshExpiresAt = Number(request.cookies.get("cognito_refresh_exp")?.value);
  if (!accessToken) return unauthorized();

  try {
    const config = await getCognitoClient();
    const metadata = config.serverMetadata();
    if (!metadata.issuer || !metadata.jwks_uri) throw new Error("Cognito issuer metadata is incomplete");
    let jwks = jwksCache.get(metadata.jwks_uri);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
      jwksCache.set(metadata.jwks_uri, jwks);
    }

    const access = await verifyAccessToken(accessToken, metadata.issuer, jwks);
    if (!access.shouldRefresh) {
      return NextResponse.json({ accessToken, expiresAt: access.expiresAt }, { headers: { "Cache-Control": "no-store" } });
    }

    // Invalid signatures, wrong issuers, wrong token types, and wrong clients
    // fail verification above and are never exchanged for a refreshed session.
    if (!refreshToken || !Number.isSafeInteger(refreshExpiresAt) || refreshExpiresAt <= Math.floor(Date.now() / 1000)) {
      return unauthorized();
    }

    const tokens = await refreshOnce(config, refreshToken);
    if (!tokens.access_token) throw new Error("Cognito refresh response omitted its access token");
    const refreshedAccess = await verifyAccessToken(tokens.access_token, metadata.issuer, jwks);
    if (refreshedAccess.shouldRefresh) throw new Error("Cognito returned an expired access token");

    const now = Math.floor(Date.now() / 1000);
    const refreshMaxAge = refreshExpiresAt - now;
    if (refreshMaxAge <= 0) return unauthorized();

    const response = NextResponse.json({ accessToken: tokens.access_token, expiresAt: refreshedAccess.expiresAt }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set("cognito_access", tokens.access_token, {
      ...COOKIE_OPTIONS, maxAge: Math.max(1, Math.floor(refreshedAccess.expiresAt / 1000) - now),
    });
    if (tokens.id_token) {
      response.cookies.set("cognito_id", tokens.id_token, {
        ...COOKIE_OPTIONS, maxAge: Math.max(1, Math.floor(refreshedAccess.expiresAt / 1000) - now),
      });
    }
    if (tokens.refresh_token) {
      // Rotation stays within the original Cognito refresh-token validity window.
      response.cookies.set("cognito_refresh", tokens.refresh_token, { ...COOKIE_OPTIONS, maxAge: refreshMaxAge });
    }
    return response;
  } catch {
    return unauthorized();
  }
}
