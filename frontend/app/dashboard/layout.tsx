import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { clientId, getCognitoClient } from "@/lib/cognito";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-slate-50" />}><AuthenticatedWorkspace>{children}</AuthenticatedWorkspace></Suspense>;
}

async function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  const idToken = (await cookies()).get("cognito_id")?.value;
  if (!idToken) redirect("/api/auth/login?returnTo=%2Fdashboard");

  let user: { name?: string; email?: string };
  try {
    const config = await getCognitoClient();
    const metadata = config.serverMetadata();
    if (!metadata.issuer || !metadata.jwks_uri) throw new Error("Cognito issuer metadata is incomplete");
    const { payload } = await jwtVerify(idToken, createRemoteJWKSet(new URL(metadata.jwks_uri)), {
      issuer: metadata.issuer,
      audience: clientId(),
      algorithms: ["RS256"],
    });
    if (payload.token_use !== "id") throw new Error("Expected a Cognito ID token");
    user = {
      name: typeof payload.name === "string" ? payload.name : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    redirect("/api/auth/login?returnTo=%2Fdashboard");
  }
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
