import { NextRequest, NextResponse } from "next/server";
import { clientId, COOKIE_OPTIONS, hostedUiUrl, logoutUrl } from "@/lib/cognito";

export async function GET(_request: NextRequest) {
  // Request data opts this Hosted UI redirect out of build-time prerendering.
  void _request.nextUrl.origin;
  const target = hostedUiUrl("logout");
  target.searchParams.set("client_id", clientId());
  target.searchParams.set("logout_uri", logoutUrl());
  const response = NextResponse.redirect(target);
  for (const name of ["cognito_access", "cognito_id", "cognito_refresh", "cognito_refresh_exp", "oidc_state", "oidc_nonce", "oidc_verifier", "oidc_return_to"]) {
    response.cookies.set(name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
