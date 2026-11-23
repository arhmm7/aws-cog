import "server-only";
import * as oidc from "openid-client";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const appUrl = () => new URL(required("APP_URL", process.env.APP_URL));
export const clientId = () => required("COGNITO_CLIENT_ID", process.env.COGNITO_CLIENT_ID);
export const callbackUrl = () => new URL("/api/auth/callback", appUrl()).toString();
export const logoutUrl = () => new URL("/", appUrl()).toString();

export function cognitoIssuer(): string {
  if (process.env.COGNITO_ISSUER) return process.env.COGNITO_ISSUER;
  const region = required("COGNITO_REGION", process.env.COGNITO_REGION);
  const poolId = required("COGNITO_USER_POOL_ID", process.env.COGNITO_USER_POOL_ID);
  return `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
}

export function hostedUiUrl(path: "login" | "signup" | "logout" | "forgotPassword"): URL {
  const domain = required("COGNITO_DOMAIN", process.env.COGNITO_DOMAIN)
    .replace(/\/$/, "");
  return new URL(`${domain.startsWith("http") ? domain : `https://${domain}`}/${path}`);
}

let configPromise: Promise<oidc.Configuration> | undefined;
export function getCognitoClient(): Promise<oidc.Configuration> {
  if (!configPromise) {
    configPromise = oidc.discovery(
      new URL(cognitoIssuer()),
      clientId(),
      process.env.COGNITO_CLIENT_SECRET || undefined,
    );
  }
  return configPromise;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export function refreshTokenMaxAge(): number {
  const configured = process.env.COGNITO_REFRESH_TOKEN_MAX_AGE_SECONDS;
  if (!configured) return 30 * 24 * 60 * 60;
  const seconds = Number(configured);
  if (!Number.isSafeInteger(seconds) || seconds < 60) {
    throw new Error("COGNITO_REFRESH_TOKEN_MAX_AGE_SECONDS must be an integer of at least 60");
  }
  return seconds;
}
