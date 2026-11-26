"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Building2, ChevronDown, Cloud, FolderKanban, Images, LayoutDashboard, Menu, X } from "lucide-react";
import { ApiError, apiGet } from "@/lib/api";
import type { DashboardData } from "@/lib/dashboard-types";

type User = { name?: string; email?: string };
type WorkspaceContextValue = { organizationId: number | null; setOrganizationId: (id: number | null) => void };
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const DashboardContext = createContext<DashboardData | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside DashboardShell");
  return value;
}

export function useDashboardData() {
  return useContext(DashboardContext);
}

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/organizations", label: "Organizations", icon: Building2 },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/assets", label: "Assets", icon: Images },
];

const titles: Record<string, { title: string; description: string }> = {
  "/dashboard": { title: "Overview", description: "Manage your organizations, projects and assets." },
  "/dashboard/organizations": { title: "Organizations", description: "Your teams and organization memberships." },
  "/dashboard/projects": { title: "Projects", description: "Projects assigned to your organizations." },
  "/dashboard/assets": { title: "Assets", description: "Files and documentation from your projects." },
};

export function DashboardShell({ children, user }: { children: ReactNode; user: User }) {
  const pathname = usePathname();
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    apiGet<DashboardData>("dashboard").then((data) => {
      if (active) setDashboard(data);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof ApiError ? error.message : "Unable to load workspace data.");
    });
    return () => { active = false; };
  }, [retryCount]);

  const page = titles[pathname] ?? titles["/dashboard"];
  const organization = dashboard?.organizations.find((item) => item.id === organizationId);
  const name = user.name || "Workspace member";
  const email = user.email || "Signed-in account";
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col bg-zinc-950 text-slate-300">
      <div className="flex h-[76px] items-center gap-3 border-b border-white/8 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff9900] text-[#16191f]"><Cloud className="h-5 w-5" /></div>
        <span className="text-[15px] font-semibold tracking-wide text-white">Workspace</span>
      </div>

      <div className="px-4 pb-5 pt-6">
        <label htmlFor="workspace-switcher" className="mb-2 block px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Workspace</label>
        <div className="relative">
          <select
            id="workspace-switcher"
            value={organizationId ?? "all"}
            onChange={(event) => setOrganizationId(event.target.value === "all" ? null : Number(event.target.value))}
            className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-3 pr-9 text-left text-xs font-medium text-zinc-100 outline-none transition hover:bg-zinc-800 focus:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500/50"
          >
            <option value="all" className="bg-zinc-900 text-zinc-100">All organizations</option>
            {dashboard?.organizations.map((item) => <option key={item.id} value={item.id} className="bg-zinc-900 text-zinc-100">{item.name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>
        {organization && <p className="mt-2 truncate px-1 text-[11px] text-slate-500">Viewing {organization.name}</p>}
      </div>

      <nav aria-label="Main navigation" className="space-y-1 px-3">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
        {navigation.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${active ? "bg-white/5 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
            <Icon className={`h-[17px] w-[17px] ${active ? "text-[#ff9900]" : "text-slate-500 group-hover:text-slate-300"}`} />
            {label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ff9900]" />}
          </Link>;
        })}
      </nav>

      <div className="mt-auto border-t border-white/8 p-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-xs font-semibold text-indigo-200">{initials || "U"}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{name}</p>
            <p className="truncate text-[11px] text-slate-500">{email}</p>
          </div>
        </div>
        <a href="/api/auth/logout" className="mt-2 flex items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">Sign out</a>
      </div>
    </div>
  );

  return <DashboardContext.Provider value={dashboard}><WorkspaceContext.Provider value={{ organizationId, setOrganizationId }}>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] border-r border-slate-900/5 lg:block">{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden">
        <button aria-label="Close navigation" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
        <aside className="relative h-full w-[280px] max-w-[85vw] shadow-2xl">{sidebar}</aside>
      </div>}
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 sm:block">Workspace / {page.title}</p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">{page.title}</h1>
            </div>
          </div>
          <div className="ml-3 flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-800">{name}</p><p className="text-[11px] text-slate-500">{email}</p></div>
            <div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{initials || "U"}</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
          <div className="mb-7"><h2 className="text-2xl font-semibold tracking-tight text-slate-900">{page.title}</h2><p className="mt-1.5 text-sm text-slate-500">{page.description}</p></div>
          {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-white px-5 py-8 text-center"><p className="text-sm font-medium text-slate-800">Could not load your workspace</p><p className="mt-1 text-sm text-slate-500">{loadError}</p><button type="button" onClick={() => { setLoadError(""); setRetryCount((count) => count + 1); }} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Try again</button></div>}
          {children}
        </main>
      </div>
    </div>
  </WorkspaceContext.Provider></DashboardContext.Provider>;
}
