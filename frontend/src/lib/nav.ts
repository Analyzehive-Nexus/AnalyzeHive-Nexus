import {
  Activity,
  Box,
  LayoutDashboard,
  Microscope,
  Radar,
  Radio,
  UploadCloud,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The application's route map - one definition consumed by three places:
 * the Sidebar's nav list, the TopNav breadcrumb, and each page's header.
 *
 * Before this existed the breadcrumb was hardcoded to "Dashboard / Command
 * Center" on every route, and each page repeated its own title. Adding a route
 * means adding one entry here.
 */
export interface NavItem {
  /** Label in the sidebar and the breadcrumb's last segment. */
  name: string;
  href: string;
  icon: LucideIcon;
  /** Page heading. Defaults to `name` when the two should differ. */
  title?: string;
  /** One line under the heading explaining what the page is for. */
  subtitle: string;
  /** Hidden from the Sidebar for anyone whose role isn't "admin". The route itself is still server-enforced. */
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    subtitle: "Inventory risk, delivery accuracy and regional activity at a glance",
  },
  {
    name: "Commercial Truth",
    href: "/commercial-truth",
    icon: Users,
    subtitle: "Verification status across the field force",
  },
  {
    name: "Supply Chain Physics",
    href: "/supply-chain-physics",
    icon: Box,
    subtitle: "Model stock redistribution before committing to a transfer",
  },
  {
    name: "Drug Discovery",
    href: "/drug-discovery",
    icon: Microscope,
    subtitle: "Programme pipeline, compound candidates and 3D disease models",
  },
  {
    name: "Market Radar",
    href: "/market-radar",
    icon: Radar,
    subtitle: "Competitor activity and market signals",
  },
  {
    name: "Live Operations",
    href: "/live-operations",
    icon: Radio,
    subtitle: "Live cold-chain telemetry and in-transit fleet tracking",
  },
  {
    name: "Data Connection",
    href: "/data-connection",
    icon: UploadCloud,
    subtitle: "Upload a CSV, map its columns, and push the rows to ingestion",
  },
  {
    name: "System Status",
    href: "/system-status",
    icon: Activity,
    subtitle: "Service health and recent incidents",
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
    subtitle: "Designation, access rights, signature credential and Part 11 sign-off history",
  },
  {
    name: "Admin",
    href: "/admin",
    icon: UserCog,
    subtitle: "Invite accounts, change roles, and suspend or remove access",
    adminOnly: true,
  },
];

/** The nav entry owning `pathname`, matching nested routes to their parent. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) =>
      item.href === pathname ||
      (item.href !== "/" && pathname.startsWith(item.href + "/"))
  );
}

/**
 * Breadcrumb trail for a path. Every page sits one level under the dashboard,
 * so the trail is "Dashboard / <page>" - and just "Dashboard" at the root,
 * rather than repeating itself.
 */
export function breadcrumbFor(pathname: string): NavItem[] {
  const item = navItemFor(pathname);
  const root = NAV_ITEMS[0];
  if (!item || item.href === "/") return [root];
  return [root, item];
}
