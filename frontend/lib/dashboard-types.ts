export type OrganizationRole = "org_admin" | "org_member";
export type ProjectRole = "project_editor" | "project_viewer";

export type Asset = {
  id: number;
  title: string;
  description: string;
  capture_date: string | null;
  object_key: string;
};

export type Project = {
  id: number;
  title: string;
  description: string;
  role: ProjectRole;
  is_active: boolean;
  assets: Asset[];
};

export type Organization = {
  id: number;
  name: string;
  role: OrganizationRole;
  is_active: boolean;
  projects: Project[];
};

export type DashboardData = {
  user: {
    id: number;
    sub_id: string;
  };
  organizations: Organization[];
};
