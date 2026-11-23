import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { clientId, getCognitoClient } from "@/lib/cognito";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function GET(request: NextRequest) {
  const idToken = request.cookies.get("cognito_id")?.value;
  if (!idToken) return NextResponse.json({ authenticated: false, user: null }, { headers: { "Cache-Control": "no-store" } });

  try {
    const config = await getCognitoClient();
    const metadata = config.serverMetadata();
    if (!metadata.issuer || !metadata.jwks_uri) throw new Error("Cognito issuer metadata is incomplete");
    let jwks = jwksCache.get(metadata.jwks_uri);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
      jwksCache.set(metadata.jwks_uri, jwks);
    }
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: metadata.issuer, audience: clientId(), algorithms: ["RS256"],
    });
    if (payload.token_use !== "id") throw new Error("Expected a Cognito ID token");
    return NextResponse.json({ authenticated: true, user: {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      emailVerified: payload.email_verified,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const response = NextResponse.json({ authenticated: false, user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
    for (const name of ["cognito_access", "cognito_id", "cognito_refresh", "cognito_refresh_exp"]) {
      response.cookies.set(name, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    }
    return response;
  }
}
