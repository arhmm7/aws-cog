import type { DashboardData } from "@/lib/dashboard-types";

export const dashboardData: DashboardData = {
  user: {
    id: 1,
    sub_id: "cognito-user-sub-12345",
  },
  organizations: [
    {
      id: 1,
      name: "Acme Corporation",
      role: "org_admin",
      is_active: true,
      projects: [
        {
          id: 101,
          title: "Head Office Renovation",
          description: "Monitoring and documentation of the head office renovation.",
          role: "project_editor",
          is_active: true,
          assets: [
            { id: 1001, title: "Ground Floor Survey", description: "Initial ground floor site survey.", capture_date: "2026-10-10", object_key: "projects/101/assets/ground-floor-survey.jpg" },
            { id: 1002, title: "Structural Inspection", description: "Structural inspection photographs.", capture_date: "2026-10-15", object_key: "projects/101/assets/structural-inspection.jpg" },
            { id: 1003, title: "Electrical Layout", description: "Electrical layout documentation.", capture_date: "2026-10-20", object_key: "projects/101/assets/electrical-layout.pdf" },
          ],
        },
        {
          id: 102,
          title: "Warehouse Expansion",
          description: "Warehouse expansion and construction progress.",
          role: "project_viewer",
          is_active: true,
          assets: [
            { id: 1004, title: "Site Overview", description: "Warehouse site overview.", capture_date: "2026-10-12", object_key: "projects/102/assets/site-overview.jpg" },
            { id: 1005, title: "Foundation Progress", description: "Foundation construction progress.", capture_date: "2026-10-22", object_key: "projects/102/assets/foundation-progress.jpg" },
          ],
        },
      ],
    },
    {
      id: 2,
      name: "Global Infrastructure Ltd",
      role: "org_admin",
      is_active: true,
      projects: [
        {
          id: 201,
          title: "Highway Development",
          description: "Highway development project monitoring.",
          role: "project_editor",
          is_active: true,
          assets: [
            { id: 2001, title: "Highway Section A", description: "Progress documentation for section A.", capture_date: "2026-10-05", object_key: "projects/201/assets/highway-section-a.jpg" },
            { id: 2002, title: "Bridge Inspection", description: "Bridge inspection documentation.", capture_date: "2026-10-18", object_key: "projects/201/assets/bridge-inspection.pdf" },
            { id: 2003, title: "Road Progress", description: "Latest road construction progress.", capture_date: "2026-10-25", object_key: "projects/201/assets/road-progress.jpg" },
          ],
        },
      ],
    },
  ],
};
