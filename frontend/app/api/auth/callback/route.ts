import * as oidc from "openid-client";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_OPTIONS, getCognitoClient, refreshTokenMaxAge } from "@/lib/cognito";

const clearTransaction = (response: NextResponse) => {
  for (const name of ["oidc_state", "oidc_nonce", "oidc_verifier", "oidc_return_to"]) {
    response.cookies.set(name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  }
};

export async function GET(request: NextRequest) {
  const returnTo = request.cookies.get("oidc_return_to")?.value || "/dashboard";
  try {
    const state = request.cookies.get("oidc_state")?.value;
    const nonce = request.cookies.get("oidc_nonce")?.value;
    const codeVerifier = request.cookies.get("oidc_verifier")?.value;
    if (!state || !nonce || !codeVerifier) throw new Error("Missing OAuth transaction state");

    const config = await getCognitoClient();
    const tokens = await oidc.authorizationCodeGrant(config, new URL(request.url), {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
      expectedNonce: nonce,
    });
    if (!tokens.access_token || !tokens.id_token || !tokens.refresh_token) {
      throw new Error("Cognito did not return all required tokens");
    }

    const response = NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
    response.cookies.set("cognito_access", tokens.access_token, {
      ...COOKIE_OPTIONS, maxAge: tokens.expires_in ?? 3600,
    });
    response.cookies.set("cognito_id", tokens.id_token, {
      ...COOKIE_OPTIONS, maxAge: tokens.expires_in ?? 3600,
    });
    const refreshMaxAge = refreshTokenMaxAge();
    response.cookies.set("cognito_refresh", tokens.refresh_token, {
      ...COOKIE_OPTIONS, maxAge: refreshMaxAge,
    });
    response.cookies.set("cognito_refresh_exp", String(Math.floor(Date.now() / 1000) + refreshMaxAge), {
      ...COOKIE_OPTIONS, maxAge: refreshMaxAge,
    });
    clearTransaction(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Cognito callback failed", error);
    const response = NextResponse.redirect(new URL("/?error=callback_failed", request.url), { status: 303 });
    clearTransaction(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
