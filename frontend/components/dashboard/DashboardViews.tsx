"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, CheckCircle2, FileText, FolderKanban, Image as ImageIcon, Search, Users, type LucideIcon } from "lucide-react";
import type { Asset, Organization, Project } from "@/lib/dashboard-types";
import { useDashboardData, useWorkspace } from "@/components/dashboard/DashboardShell";

const roleNames: Record<string, string> = {
  org_admin: "Organization admin",
  org_member: "Organization member",
  project_editor: "Project editor",
  project_viewer: "Project viewer",
};

function useOrganizations() {
  const { organizationId } = useWorkspace();
  const { organizations } = useDashboardData();
  return organizationId === null
    ? organizations
    : organizations.filter((organization) => organization.id === organizationId);
}

function formatDate(date: string | null) {
  if (!date) return "No capture date";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function StatCard({ label, value, note, icon: Icon, tone }: { label: string; value: number; note: string; icon: LucideIcon; tone: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02] transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between"><div><p className="text-[13px] font-medium text-slate-500">{label}</p><p className="mt-3 text-[30px] font-semibold leading-none tracking-tight text-slate-900">{value}</p></div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon className="h-[18px] w-[18px]" /></div>
    </div><p className="mt-4 text-xs text-slate-400">{note}</p>
  </article>;
}

function Status({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />{active ? "Active" : "Inactive"}
  </span>;
}

function RoleBadge({ role }: { role: string }) {
  const editor = role === "project_editor";
  const org = role.startsWith("org_");
  return <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${org ? "bg-violet-50 text-violet-700" : editor ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{roleNames[role] ?? role}</span>;
}

function OrganizationHeading({ organization }: { organization: Organization }) {
  const projectCount = organization.projects.length;
  const assetCount = organization.projects.reduce((sum, project) => sum + project.assets.length, 0);
  return <div className="flex items-start gap-3.5">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Building2 className="h-5 w-5" /></div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2.5"><h3 className="truncate text-[15px] font-semibold text-slate-900">{organization.name}</h3><Status active={organization.is_active} /></div>
      <div className="mt-2 flex flex-wrap items-center gap-2"><RoleBadge role={organization.role} /><span className="text-xs text-slate-400">{projectCount} {projectCount === 1 ? "project" : "projects"} · {assetCount} {assetCount === 1 ? "asset" : "assets"}</span></div>
    </div>
  </div>;
}

export function OverviewView() {
  const organizations = useOrganizations();
  const projects = organizations.flatMap((organization) => organization.projects);
  const assets = projects.flatMap((project) => project.assets);
  const stats = [
    { label: "Organizations", value: organizations.length, note: "Memberships you can access", icon: Building2, tone: "bg-indigo-50 text-indigo-600" },
    { label: "Active projects", value: projects.filter((project) => project.is_active).length, note: "Across your organizations", icon: FolderKanban, tone: "bg-sky-50 text-sky-600" },
    { label: "Total assets", value: assets.length, note: "In your assigned projects", icon: ImageIcon, tone: "bg-amber-50 text-amber-600" },
    { label: "Memberships", value: organizations.length, note: "Organization memberships", icon: Users, tone: "bg-violet-50 text-violet-600" },
  ];

  return <div className="space-y-8">
    <section aria-label="Workspace statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</section>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-sm font-semibold text-slate-900">Organizations</h3><p className="mt-1 text-xs text-slate-500">Your organization memberships</p></div><Link href="/dashboard/organizations" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <div className="divide-y divide-slate-100">{organizations.map((organization) => <div key={organization.id} className="px-5 py-5 sm:px-6"><OrganizationHeading organization={organization} /></div>)}</div>
        {organizations.length === 0 && <EmptyState title="No organizations found" detail="Choose another workspace to see its organizations." />}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-sm font-semibold text-slate-900">Projects</h3><p className="mt-1 text-xs text-slate-500">Recently assigned projects</p></div><Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <div className="divide-y divide-slate-100">{projects.slice(0, 4).map((project) => {
          const organization = organizations.find((item) => item.projects.some((entry) => entry.id === project.id));
          return <div key={project.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FolderKanban className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[13px] font-semibold text-slate-800">{project.title}</p><Status active={project.is_active} /></div><p className="mt-1 truncate text-xs text-slate-500">{organization?.name ?? "Organization"}</p></div>
            <span className="shrink-0 text-xs text-slate-400">{project.assets.length} files</span>
          </div>;
        })}</div>
        {projects.length === 0 && <EmptyState title="No projects found" detail="No projects are assigned to this organization." />}
      </section>
    </div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-sm font-semibold text-slate-900">Recent assets</h3><p className="mt-1 text-xs text-slate-500">Latest files across your projects</p></div><Link href="/dashboard/assets" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">Browse assets <ArrowRight className="h-3.5 w-3.5" /></Link></div>
      <AssetRows organizations={organizations} limit={5} />
    </section>
  </div>;
}

export function OrganizationsView() {
  const organizations = useOrganizations();
  return <div className="grid gap-5 xl:grid-cols-2">{organizations.map((organization) => <article key={organization.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02] sm:p-6">
    <OrganizationHeading organization={organization} />
    <div className="mt-6 border-t border-slate-100 pt-5"><div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Projects</h4><span className="text-xs text-slate-400">{organization.projects.length} total</span></div>
      <div className="space-y-2">{organization.projects.map((project) => <div key={project.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3.5 py-3">
        <FolderKanban className="h-4 w-4 shrink-0 text-slate-400" /><p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{project.title}</p><span className="text-[11px] text-slate-400">{project.assets.length} assets</span>
      </div>)}</div>
    </div>
  </article>)}
    {organizations.length === 0 && <EmptyState title="No organizations found" detail="Choose another workspace to view its memberships." />}
  </div>;
}

export function ProjectsView() {
  const organizations = useOrganizations();
  return <div className="space-y-6">{organizations.map((organization) => <section key={organization.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Building2 className="h-4 w-4" /></div><div><h3 className="text-sm font-semibold text-slate-900">{organization.name}</h3><p className="mt-0.5 text-xs text-slate-500">Organization access · <span className="text-violet-700">{roleNames[organization.role]}</span></p></div></div><span className="text-xs text-slate-400">{organization.projects.length} projects</span></div>
    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">{organization.projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
    {organization.projects.length === 0 && <EmptyState title="No projects assigned" detail="Projects for this organization will appear here." />}
  </section>)}{organizations.length === 0 && <EmptyState title="No organizations found" detail="Choose another workspace to view its projects." />}</div>;
}

function ProjectCard({ project }: { project: Project }) {
  return <article className="rounded-lg border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-sm">
    <div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FolderKanban className="h-4 w-4" /></div><Status active={project.is_active} /></div>
    <h4 className="mt-4 text-sm font-semibold text-slate-900">{project.title}</h4><p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{project.description}</p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><RoleBadge role={project.role} /><div className="flex items-center gap-3"><Status active={project.is_active} /><span className="text-[11px] text-slate-400">{project.assets.length} assets</span></div></div>
  </article>;
}

export function AssetsView() {
  const organizations = useOrganizations();
  const [query, setQuery] = useState("");
  const flattened = useMemo(() => organizations.flatMap((organization) => organization.projects.flatMap((project) => project.assets.map((asset) => ({ asset, project, organization })))), [organizations]);
  const filtered = flattened.filter(({ asset, project, organization }) => [asset.title, asset.description, project.title, organization.name, fileType(asset)].join(" ").toLowerCase().includes(query.toLowerCase()));

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h3 className="text-sm font-semibold text-slate-900">Project assets</h3><p className="mt-1 text-xs text-slate-500">Assets from projects assigned to you</p></div><label className="relative block w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets..." className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label></div>
    <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_minmax(130px,1fr)_120px] gap-4 bg-slate-50/70 px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 md:grid"><span>Asset</span><span>Project</span><span>Organization</span><span>Captured</span></div>
    {filtered.length ? <div className="divide-y divide-slate-100">{filtered.map(({ asset, project, organization }) => <AssetRow key={asset.id} asset={asset} project={project} organization={organization} />)}</div> : <EmptyState title="No assets match your search" detail="Try another title, project, or file type." />}
  </section>;
}

function AssetRows({ organizations, limit }: { organizations: Organization[]; limit?: number }) {
  const rows = organizations.flatMap((organization) => organization.projects.flatMap((project) => project.assets.map((asset) => ({ asset, project, organization })))).slice(0, limit);
  return <div className="divide-y divide-slate-100">{rows.map(({ asset, project, organization }) => <AssetRow key={asset.id} asset={asset} project={project} organization={organization} />)}</div>;
}

function AssetRow({ asset, project, organization }: { asset: Asset; project: Project; organization: Organization }) {
  const extension = fileType(asset);
  const Icon = extension === "PDF" ? FileText : ImageIcon;
  return <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_minmax(130px,1fr)_120px] md:items-center md:gap-4 md:px-6">
    <div className="flex min-w-0 items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${extension === "PDF" ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-600"}`}><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{asset.title}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{asset.description}</p></div><span className="ml-auto rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold text-slate-500 md:hidden">{extension}</span></div>
    <div className="pl-12 text-xs text-slate-600 md:pl-0"><span className="text-[10px] font-medium uppercase text-slate-400 md:hidden">Project · </span>{project.title}</div>
    <div className="pl-12 text-xs text-slate-600 md:pl-0"><span className="text-[10px] font-medium uppercase text-slate-400 md:hidden">Organization · </span>{organization.name}</div>
    <div className="flex items-center gap-1.5 pl-12 text-xs text-slate-500 md:pl-0"><CalendarDays className="hidden h-3.5 w-3.5 text-slate-400 md:block" />{formatDate(asset.capture_date)}<span className="ml-auto hidden rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold text-slate-500 md:inline-flex">{extension}</span></div>
  </div>;
}

function fileType(asset: Asset) {
  return asset.object_key.split(".").pop()?.toUpperCase() ?? "FILE";
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-6 py-12 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><CheckCircle2 className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
