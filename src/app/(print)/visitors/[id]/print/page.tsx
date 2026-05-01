import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";
import { signedVisitorPhotoUrl } from "@/lib/visitors/visitor-photo-signed-url";
import { formatOrgAddressBlockForVisitorPass } from "@/lib/visitors/format-org-address-block";
import {
  resolveVisitorPassPrintLayout,
  visitorPassPrintPath,
  type VisitorPassPrintLayout,
} from "@/lib/visitors/visitor-pass-print-layout";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { VisitorPassPrintView } from "@/components/visitor/visitor-pass-print";
import { VisitorPassPrintA5View } from "@/components/visitor/visitor-pass-print-a5";
import { VisitorPrintPassToolbar } from "@/components/visitor/visitor-print-pass-toolbar";

function layoutLinkClass(active: boolean): string {
  return active
    ? "rounded-md bg-sky-600/15 px-3 py-1.5 text-sm font-medium text-sky-800 dark:text-sky-200"
    : "rounded-md px-3 py-1.5 text-sm text-sky-700 underline dark:text-sky-300";
}

export default async function VisitorPassPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ fromCheckin?: string | string[]; layout?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const fromCheckinRaw = sp.fromCheckin;
  const showPostCheckinPrint =
    fromCheckinRaw === "1" ||
    fromCheckinRaw === "true" ||
    (Array.isArray(fromCheckinRaw) && fromCheckinRaw.some((v) => v === "1" || v === "true"));

  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "visitor");

  const layout: VisitorPassPrintLayout = resolveVisitorPassPrintLayout(
    sp.layout,
    ctx.organization.visitor_pass_print_layout,
  );

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("visitor_visits")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const r = row as {
    doc_number: string;
    visit_date: string;
    visitor_name: string;
    visitor_mobile?: string | null;
    visitor_company?: string | null;
    host_name?: string | null;
    purpose?: string | null;
    vehicle_reg?: string | null;
    driver_name?: string | null;
    issued_at?: string | null;
    status: string;
    photo_storage_path?: string | null;
  };

  if (r.status === "draft") {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
        <Link href={`/visitors/${id}`} className="text-sky-600 underline">
          ← Back to visit
        </Link>
        <p className="mt-6 text-sm text-[var(--muted)]">Issue the visitor pass to print.</p>
      </div>
    );
  }

  if (r.status === "checked_out") {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
        <Link href={`/visitors/${id}`} className="text-sky-600 underline">
          ← Back to visit
        </Link>
        <p className="mt-6 text-sm text-[var(--muted)]">
          This visit is complete. Printing the pass is not available after check-out.
        </p>
      </div>
    );
  }

  const photoUrl = await signedVisitorPhotoUrl(supabase, r.photo_storage_path);
  const powered = poweredByLine(ctx.organization.plan);
  const issuedLabel = r.issued_at
    ? `Issued ${new Date(r.issued_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}`
    : null;
  const visitDateLabel = formatDateDdMmYyyy(String(r.visit_date).slice(0, 10));
  const logoUrl = ctx.organization.logo_storage_path
    ? publicObjectUrl("org-logos", ctx.organization.logo_storage_path)
    : null;
  const orgAddressBlock = formatOrgAddressBlockForVisitorPass(ctx.organization);

  const common = {
    companyName: ctx.organization.name,
    logoUrl,
    docNumber: r.doc_number,
    visitDateLabel,
    visitorName: r.visitor_name,
    visitorMobile: r.visitor_mobile ?? "—",
    visitorCompany: r.visitor_company ?? null,
    hostName: r.host_name ?? "—",
    purpose: r.purpose ?? null,
    vehicleReg: r.vehicle_reg ?? null,
    driverName: r.driver_name ?? null,
    issuedAtLabel: issuedLabel,
    photoUrl,
    poweredBy: powered,
  };

  const pathIdCard = visitorPassPrintPath(id, "id_card", { fromCheckin: showPostCheckinPrint });
  const pathA5 = visitorPassPrintPath(id, "a5_foldable", { fromCheckin: showPostCheckinPrint });

  const printPageCss =
    layout === "a5_foldable"
      ? `
            @media print {
              @page { size: A5 portrait; margin: 3mm; }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .visitor-pass-a5 {
                box-sizing: border-box;
                min-height: 0 !important;
                height: 204mm !important;
                max-height: 204mm !important;
                width: 100% !important;
                max-width: none !important;
              }
              .visitor-pass-a5 > section {
                min-height: 0 !important;
                flex: 1 1 0 !important;
                overflow: hidden;
              }
            }
          `
      : `
            @media print {
              @page { size: 85.6mm 53.98mm; margin: 0; }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          `;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <style dangerouslySetInnerHTML={{ __html: printPageCss }} />
      <div className="p-4 print:hidden">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          <Link href={`/visitors/${id}`} className="text-sky-600 underline">
            ← Back to visit
          </Link>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <p className="font-medium text-[var(--foreground)]">Print layout</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={pathIdCard} className={layoutLinkClass(layout === "id_card")}>
                ID-1 card
              </Link>
              <Link href={pathA5} className={layoutLinkClass(layout === "a5_foldable")}>
                A5 foldable badge
              </Link>
            </div>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {layout === "a5_foldable"
              ? "A5 portrait: fold along the dashed line. In print preview, choose A5; use small margins if your browser adds extra whitespace."
              : "Wallet card (ISO ID-1). In print preview, use the same size or scale to fit."}
          </p>
        </div>
      </div>

      <div className="mx-auto flex flex-col items-center gap-10 p-4 print:m-0 print:block print:gap-0 print:p-0">
        {layout === "a5_foldable" ? (
          <VisitorPassPrintA5View {...common} orgAddressBlock={orgAddressBlock} />
        ) : (
          <VisitorPassPrintView {...common} />
        )}
        <VisitorPrintPassToolbar />
      </div>
    </div>
  );
}
