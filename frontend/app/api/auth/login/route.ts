import * as oidc from "openid-client";
import { NextRequest, NextResponse } from "next/server";
import { callbackUrl, clientId, getCognitoClient, COOKIE_OPTIONS, hostedUiUrl } from "@/lib/cognito";

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const config = await getCognitoClient();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
    const authorizationParams = {
      redirect_uri: callbackUrl(), response_type: "code", scope: "openid email profile",
      client_id: clientId(), state, nonce, code_challenge: codeChallenge,
      code_challenge_method: "S256",
    };
    const screen = request.nextUrl.searchParams.get("screen");
    const authorizationUrl = screen === "signup" || screen === "forgotPassword"
      ? hostedUiUrl(screen === "signup" ? "signup" : "forgotPassword")
      : oidc.buildAuthorizationUrl(config, authorizationParams);
    if (screen === "signup" || screen === "forgotPassword") {
      for (const [key, value] of Object.entries(authorizationParams)) authorizationUrl.searchParams.set(key, value);
    }
    const response = NextResponse.redirect(authorizationUrl);
    const options = { ...COOKIE_OPTIONS, maxAge: 600 };
    response.cookies.set("oidc_state", state, options);
    response.cookies.set("oidc_nonce", nonce, options);
    response.cookies.set("oidc_verifier", codeVerifier, options);
    response.cookies.set("oidc_return_to", returnTo, options);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Cognito login initiation failed", error);
    return NextResponse.json({ error: "Unable to initiate login" }, { status: 500 });
  }
}
