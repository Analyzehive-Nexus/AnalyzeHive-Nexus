"use client";

import { usePathname } from "next/navigation";
import { navItemFor } from "@/lib/nav";

/**
 * The single page-heading pattern: title, one-line explanation, and an
 * optional slot for page-level actions on the right.
 *
 * Title and subtitle come from the route map, so a page normally renders
 * `<PageHeader />` with no props at all. Pass `title`/`subtitle` only to
 * override, and `actions` for controls that belong to the whole page.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const item = navItemFor(pathname);

  const heading = title ?? item?.title ?? item?.name ?? "";
  const description = subtitle ?? item?.subtitle;

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{heading}</h1>
        {description && (
          <p className="mt-1 text-sm text-subtle">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
