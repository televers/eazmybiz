"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FeatureKey, FeaturePermissionMap } from "@/lib/access";
import type { NotificationPreview } from "@/lib/notifications-preview";
import { NotificationsBell } from "@/components/notifications-bell";
import { OrgSwitcher } from "@/components/org-switcher";
import { ShareEazmybizSidebar } from "@/components/marketing/share-eazmybiz";
import { SignOutButton } from "@/components/sign-out-button";

const STORAGE_KEY = "eazmybiz-sidebar-expanded";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  feature: FeatureKey | null;
  /** When true, show only if user can manage company settings (account owner or company admin). */
  requiresManageMemberships?: boolean;
  /** When true, show only if user may manage subscription pricing for the active company (owner or company admin). */
  requiresPricingAccess?: boolean;
};

function IconHome() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
      />
    </svg>
  );
}

function IconCube() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="m21 16-9 5-9-5M3 15V9l9-5 9 5v6M12 3v18"
      />
    </svg>
  );
}

function IconFile() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14 2v6h6" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
      />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2m10 0H9m10 0h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14m-6 8h.01M17 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
      />
    </svg>
  );
}

function IconGate() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M4 20V10M4 10l4-4 4 4 4-4 4 4v10M8 10v10M12 10v10M16 10v10"
      />
    </svg>
  );
}

/** Visitor pass — horizontal ID card (distinct from profile’s user-circle icon). */
function IconVisitor() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M4 8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7Z"
      />
      <circle cx="10" cy="12.25" r="1.85" fill="none" strokeWidth={1.75} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 17c1.2-1.5 3.2-1.5 6 0" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14.5 11h3M14.5 14h3" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M4 21V8l8-4 8 4v13M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01"
      />
    </svg>
  );
}

/** Subscription / account owner — briefcase (distinct from company building). */
function IconBellNav() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}

function IconAccount() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 12v3" />
    </svg>
  );
}

function IconUserCircle() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      />
    </svg>
  );
}

function IconPricing() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.698.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 6h.008v.008H6V6Z" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={"h-4 w-4 shrink-0 transition-transform " + (open ? "rotate-180" : "")}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
    </svg>
  );
}

function IconMenuHamburger() {
  return (
    <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: <IconHome />, feature: null },
  { href: "/parties", label: "Parties", icon: <IconUsers />, feature: "parties" },
  { href: "/items", label: "Items", icon: <IconCube />, feature: "items" },
  { href: "/quotations", label: "Quotations", icon: <IconFile />, feature: "quotation" },
  { href: "/packing-lists", label: "Packing lists", icon: <IconClipboard />, feature: "packing_list" },
  { href: "/delivery-challans", label: "Delivery challans", icon: <IconTruck />, feature: "delivery_challan" },
  { href: "/gate-passes", label: "Gate passes", icon: <IconGate />, feature: "gate_pass" },
  { href: "/visitors", label: "Visitors", icon: <IconVisitor />, feature: "visitor" },
  {
    href: "/settings/pricing",
    label: "Pricing",
    icon: <IconPricing />,
    feature: null,
    requiresPricingAccess: true,
  },
  { href: "/settings/profile", label: "Profile", icon: <IconUserCircle />, feature: null },
  {
    href: "/settings/company",
    label: "Company",
    icon: <IconBuilding />,
    feature: null,
    requiresManageMemberships: true,
  },
];

function navActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function isBrowsePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/parties" || pathname.startsWith("/parties/") || pathname === "/items" || pathname.startsWith("/items/");
}

function navLinkClass(active: boolean, expanded: boolean, mobile: boolean): string {
  const size = mobile
    ? "min-h-11 touch-manipulation px-3 py-3 text-base active:bg-[var(--border)] "
    : expanded
      ? "px-3 py-2 text-sm "
      : "justify-center px-0 py-2 text-sm ";
  const tone = active
    ? "bg-sky-600/15 font-medium text-sky-800 dark:text-sky-200 "
    : "text-[var(--foreground)] hover:bg-[var(--border)] ";
  return "flex items-center gap-3 rounded-md transition-colors " + size + tone;
}

function MainNavLinks({
  pathname,
  expanded,
  hydrated,
  mobile,
  onNavigate,
  featurePermissions,
  canManageMemberships,
  canAccessPricing,
  isMasterAdmin,
}: {
  pathname: string;
  expanded: boolean;
  hydrated: boolean;
  mobile: boolean;
  onNavigate?: () => void;
  featurePermissions: FeaturePermissionMap;
  canManageMemberships: boolean;
  canAccessPricing: boolean;
  isMasterAdmin: boolean;
}) {
  const p = pathname ?? "";
  return (
    <>
      {navItems.map((item) => {
        if (item.requiresManageMemberships && !canManageMemberships) return null;
        if (item.requiresPricingAccess && !canAccessPricing) return null;
        if (item.feature && !featurePermissions[item.feature]) return null;
        const active = navActive(p, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={mobile || !hydrated || expanded ? undefined : item.label}
            onClick={onNavigate}
            className={navLinkClass(active, mobile ? true : expanded, mobile)}
          >
            {item.icon}
            {mobile || expanded ? <span className="truncate">{item.label}</span> : null}
          </Link>
        );
      })}
      {canManageMemberships ? (
        <Link
          href="/settings/team"
          title={mobile || !hydrated || expanded ? undefined : "Team & access"}
          onClick={onNavigate}
          className={navLinkClass(navActive(p, "/settings/team"), mobile ? true : expanded, mobile)}
        >
          <IconUsers />
          {mobile || expanded ? <span className="truncate">Team &amp; access</span> : null}
        </Link>
      ) : null}
      {canManageMemberships ? (
        <Link
          href="/settings/notifications"
          title={mobile || !hydrated || expanded ? undefined : "Notifications"}
          onClick={onNavigate}
          className={navLinkClass(navActive(p, "/settings/notifications"), mobile ? true : expanded, mobile)}
        >
          <IconBellNav />
          {mobile || expanded ? <span className="truncate">Notifications</span> : null}
        </Link>
      ) : null}
      {isMasterAdmin ? (
        <Link
          href="/settings/account"
          title={mobile || !hydrated || expanded ? undefined : "Account"}
          onClick={onNavigate}
          className={navLinkClass(navActive(p, "/settings/account"), mobile ? true : expanded, mobile)}
        >
          <IconAccount />
          {mobile || expanded ? <span className="truncate">Account</span> : null}
        </Link>
      ) : null}
    </>
  );
}

export function AppShell({
  orgName,
  children,
  accessibleOrganizations,
  activeOrgId,
  featurePermissions,
  canManageMemberships,
  canAccessPricing,
  isMasterAdmin,
  notificationPreview,
  isAccountOwner,
}: {
  orgName: string;
  children: React.ReactNode;
  accessibleOrganizations: { id: string; name: string }[];
  activeOrgId: string;
  featurePermissions: FeaturePermissionMap;
  canManageMemberships: boolean;
  canAccessPricing: boolean;
  isMasterAdmin: boolean;
  notificationPreview: NotificationPreview | null;
  isAccountOwner: boolean;
}) {
  const pathname = usePathname();
  const browse = isBrowsePath(pathname);

  const [expanded, setExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "0") setExpanded(false);
      if (v === "1") setExpanded(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const toggleSidebar = useCallback(() => {
    setExpanded((e) => {
      const next = !e;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const railWidth = expanded ? "w-52" : "w-[4.25rem]";

  return (
    <div className="flex min-h-screen min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <aside
        className={
          "hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ease-out lg:flex " +
          railWidth
        }
      >
        <div className={"flex items-center gap-2 border-b border-[var(--border)] p-2 " + (expanded ? "px-3" : "justify-center")}>
          <Link
            href="/dashboard"
            aria-label="eazmybiz home"
            className={
              "flex min-w-0 items-center gap-2 rounded-md py-2 font-semibold hover:bg-[var(--border)] " +
              (expanded ? "flex-1 px-2" : "px-0 justify-center")
            }
            title="eazmybiz"
          >
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white dark:bg-white">
              <Image
                src="/brand/infinity-mark.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
            </span>
            {expanded ? (
              <span className="truncate text-[#007BFF] dark:text-[#007BFF]">eazmybiz</span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse" : "Expand"}
          >
            <IconChevron open={expanded} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main">
          <MainNavLinks
            pathname={pathname ?? ""}
            expanded={expanded}
            hydrated={hydrated}
            mobile={false}
            featurePermissions={featurePermissions}
            canManageMemberships={canManageMemberships}
            canAccessPricing={canAccessPricing}
            isMasterAdmin={isMasterAdmin}
          />
        </nav>

        <div className={"mt-auto space-y-2 border-t border-[var(--border)] p-2 " + (expanded ? "" : "flex flex-col items-center")}>
          <OrgSwitcher organizations={accessibleOrganizations} activeOrgId={activeOrgId} expanded={expanded} />
          {expanded ? (
            <div className="truncate px-2 text-xs text-[var(--muted)]" title={orgName}>
              {orgName}
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--border)] text-xs font-medium" title={orgName}>
              {(orgName.trim().charAt(0) || "?").toUpperCase()}
            </div>
          )}
          <ShareEazmybizSidebar expanded={expanded} hydrated={hydrated} />
          <div className={expanded ? "px-1" : "flex justify-center"}>
            <SignOutButton />
          </div>
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            id="app-mobile-nav"
            className="absolute inset-y-0 left-0 flex w-[min(20.5rem,92vw)] max-w-full flex-col border-r border-[var(--border)] bg-[var(--card)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-mobile-nav-title"
          >
            <div
              className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] p-3"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <span id="app-mobile-nav-title" className="text-sm font-semibold text-[var(--foreground)]">
                Menu
              </span>
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-[var(--border)]"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
              >
                <IconClose />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-y-contain p-2" aria-label="Main">
              <MainNavLinks
                pathname={pathname ?? ""}
                expanded={true}
                hydrated={hydrated}
                mobile={true}
                onNavigate={() => setMobileNavOpen(false)}
                featurePermissions={featurePermissions}
                canManageMemberships={canManageMemberships}
                canAccessPricing={canAccessPricing}
                isMasterAdmin={isMasterAdmin}
              />
            </nav>
            <div
              className="mt-auto space-y-2 border-t border-[var(--border)] p-2"
              style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
            >
              <OrgSwitcher organizations={accessibleOrganizations} activeOrgId={activeOrgId} expanded={true} />
              <div className="truncate px-2 text-xs text-[var(--muted)]" title={orgName}>
                {orgName}
              </div>
              <ShareEazmybizSidebar expanded={true} hydrated={hydrated} />
              <SignOutButton className="min-h-11 w-full text-center text-[var(--foreground)]" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-2 lg:hidden"
          style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-[var(--border)] active:bg-[var(--border)]"
            aria-expanded={mobileNavOpen}
            aria-controls="app-mobile-nav"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <IconMenuHamburger />
          </button>
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 font-semibold"
            aria-label="eazmybiz home"
          >
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white dark:bg-white">
              <Image
                src="/brand/infinity-mark.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
            </span>
            <span className="truncate text-[#007BFF] dark:text-[#007BFF]">eazmybiz</span>
          </Link>
          {canManageMemberships && notificationPreview ? (
            <div className="shrink-0 pr-1">
              <NotificationsBell preview={notificationPreview} isAccountOwner={isAccountOwner} />
            </div>
          ) : null}
        </header>
        {canManageMemberships && notificationPreview ? (
          <div className="hidden shrink-0 justify-end border-b border-[var(--border)] bg-[var(--background)] px-3 py-2 lg:flex">
            <NotificationsBell preview={notificationPreview} isAccountOwner={isAccountOwner} />
          </div>
        ) : null}
        {browse ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        ) : (
          <div className="flex-1 overflow-auto px-3 py-4 lg:px-4 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}
